import { getPrincipal, lookupPrincipal } from "@nmi-agro/fdm-core"
import {
  addMessageFromInboundEmailUnchecked,
  assignTicketToAnAdmin,
  createTicketFromInboundEmail,
  getAssigneesForTicketsUnchecked,
  getMessagesForTicket,
  getTicket,
  tryToGetTicketByRefUnchecked,
  tryToGetTicketUnchecked,
  updateTicketSubjectAndPriorityUnchecked,
} from "@nmi-agro/fdm-helpdesk"
import crypto from "crypto"
import { serverConfig } from "~/lib/config.server"
import { PostmarkEmailSchema, sendHelpdeskNewMessageEmail } from "~/lib/email.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { performTicketTriage } from "~/lib/support.server"
import { Route } from "./+types/api.webhooks.inbound-email-ticket"

export function checkUsernameAndPassword(request: Request) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader) {
    return false
  }

  const basicAuthMatch = authHeader.match(/^Basic\s+(.+)$/i)
  if (!basicAuthMatch) {
    return false
  }

  const decodedCredentials = Buffer.from(basicAuthMatch[1], "base64").toString("utf8")
  const separatorIndex = decodedCredentials.indexOf(":")
  if (separatorIndex < 0) {
    return false
  }

  const username = decodedCredentials.substring(0, separatorIndex)
  const password = decodedCredentials.substring(separatorIndex + 1)

  const hashedPw = crypto.createHash("md5").update(password).digest("hex")
  return (
    username === serverConfig.mail?.postmark.inbound_email_auth_username &&
    hashedPw === serverConfig.mail.postmark.inbound_email_auth_password_hash
  )
}

export async function action({ request }: Route.ActionArgs) {
  try {
    if (
      !serverConfig.mail?.postmark.inbound_email_auth_username ||
      !serverConfig.mail?.postmark.inbound_email_auth_password_hash
    ) {
      return new Response("Not Implemented", {
        status: 501,
      })
    }

    if (!checkUsernameAndPassword(request)) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Inbound Email Webhook"' },
      })
    }

    const contentLength = parseInt(request.headers.get("content-length") ?? "0")
    if (contentLength > 30 * 1024 * 1024) {
      return new Response("Payload too large", { status: 413 })
    }

    let rawEmail: unknown
    try {
      rawEmail = await request.json()
      // oxlint-disable-next-line no-unused-vars handling json error
    } catch (_ignored) {
      return new Response("Bad Request", { status: 400, statusText: "Invalid JSON" })
    }

    const emailParsingResult = PostmarkEmailSchema.safeParse(rawEmail)
    if (!emailParsingResult.success) {
      return new Response("Bad Request", { status: 400, statusText: "Invalid JSON data" })
    }
    let email = emailParsingResult.data

    // Normalize the email address by removing any "+" tags before the "@" symbol
    const emailParts = email.FromFull.Email.split("@")
    if (emailParts.length !== 2) {
      throw new Error(`Invalid email address: ${email.FromFull.Email}`)
    }
    const plusIndex = emailParts[0].indexOf("+")
    if (plusIndex !== -1) {
      emailParts[0] = emailParts[0].substring(0, plusIndex)
    }
    const normalizedEmail = emailParts.join("@")

    // Try to find the ticket that the user is replying to, either from the ticket subject or the In-Reply-To header.
    const principals = await lookupPrincipal(fdm, email.FromFull.Email)
    const senderPrincipal = principals.find(
      (u) => u.email?.toLowerCase() === email.FromFull.Email.toLowerCase(),
    )
    const messageSubject = email.Subject ?? "Subject"
    const messageBody = email.TextBody ?? "Ticket"
    const MailboxHash =
      email.ToFull && email.ToFull.length > 0 ? (email.ToFull[0].MailboxHash ?? null) : null
    const ticketRef = /\[?(TK-[A-Z0-9]{6})\]?/.exec(messageSubject)?.[1]
    const ticket = ticketRef
      ? await tryToGetTicketByRefUnchecked(fdm, ticketRef)
      : MailboxHash
        ? await tryToGetTicketUnchecked(fdm, MailboxHash)
        : null

    // If the ticket is found and some of the information matches the sender, post a message instead.
    if (
      ticket &&
      ((senderPrincipal && senderPrincipal.id === ticket.requester_id) ||
        ticket.requester_email === email.FromFull.Email)
    ) {
      const ticket_id = await addMessageFromInboundEmailUnchecked(
        fdm,
        ticket.ticket_id,
        messageBody,
        senderPrincipal?.id,
      )

      try {
        const assignees =
          (await getAssigneesForTicketsUnchecked(fdm, [ticket.ticket_id])).get(ticket.ticket_id) ??
          []
        const primaryAssignee = assignees.find((a) => a.is_primary)
        if (primaryAssignee) {
          const assigneePrincipal = await getPrincipal(fdm, primaryAssignee.agent_id)
          const messages = await getMessagesForTicket(
            fdm,
            primaryAssignee.agent_id,
            ticket.ticket_id,
          )
          if (messages.length >= 1 && assigneePrincipal?.email) {
            await sendHelpdeskNewMessageEmail(
              assigneePrincipal.email,
              assigneePrincipal.displayUserName ?? assigneePrincipal.email,
              senderPrincipal?.displayUserName ?? normalizedEmail ?? "Een gebruiker",
              ticket.ticket_ref,
              ticket.subject ?? null,
              ticket_id,
              messages[0].message_id,
              messages[0].body,
            )
          }
        }
      } catch (err) {
        handleLoaderError(err)
      }
      return new Response("OK", { status: 200 })
    }

    // Create a new ticket
    const ticket_id = await createTicketFromInboundEmail(fdm, normalizedEmail, messageBody)
    if (email.Subject) {
      await updateTicketSubjectAndPriorityUnchecked(fdm, ticket_id, email.Subject)
    }

    // Perform ticket triage before notifying the agent
    try {
      if (serverConfig.helpdesk.enableTicketTriage && serverConfig.integrations.gemini) {
        await performTicketTriage(serverConfig.integrations.gemini.api_key, ticket_id, messageBody)
      }
    } catch (err) {
      handleLoaderError(err)
    }

    try {
      const assigned_agent_id = await assignTicketToAnAdmin(fdm, ticket_id)
      if (assigned_agent_id) {
        const ticket = await getTicket(fdm, assigned_agent_id, ticket_id)
        const messages = await getMessagesForTicket(fdm, assigned_agent_id, ticket_id)
        const agentPrincipal = await getPrincipal(fdm, assigned_agent_id)
        if (messages.length >= 1 && agentPrincipal?.email) {
          await sendHelpdeskNewMessageEmail(
            agentPrincipal.email,
            agentPrincipal.displayUserName ?? agentPrincipal.email,
            senderPrincipal?.displayUserName ?? normalizedEmail ?? "Een gebruiker",
            ticket.ticket_ref,
            ticket.subject,
            ticket_id,
            messages[0].message_id,
            messages[0].body,
          )
        }
      }
    } catch (err) {
      handleLoaderError(err)
    }

    return new Response("OK", { status: 200 })
  } catch (err) {
    handleLoaderError(err)
    return new Response("Internal Server Error", { status: 500 })
  }
}
