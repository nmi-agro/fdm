import { getPrincipal, lookupPrincipal } from "@nmi-agro/fdm-core"
import {
  addMessageFromInboundEmailUnchecked,
  assignTicketToAnAdmin,
  autoAssignTicket,
  createTicketFromInboundEmail,
  getAssigneesForTicketsUnchecked,
  getMatchingEmailBlock,
  getMessagesForTicket,
  getTicket,
  markTicketAsNotViewedByAll,
  tryToGetTicketByRefUnchecked,
  tryToGetTicketUnchecked,
  updateTicketSubjectAndPriorityUnchecked,
} from "@nmi-agro/fdm-helpdesk"
import { serverConfig } from "~/lib/config.server"
import { PostmarkEmailSchema, sendHelpdeskNewMessageEmail } from "~/lib/email.server"
import { handleActionError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { checkRateLimit } from "~/lib/rate-limit.server"
import { performTicketTriage } from "~/lib/support.server"
import { Route } from "./+types/api.webhooks.inbound-email-ticket.$secret"

// Per-sender-email rate limit for the inbound email webhook, so a single
// mailbox (compromised, misconfigured autoresponder, or malicious) can't
// spam ticket creation / triage / outbound notification emails.
const INBOUND_EMAIL_RATE_LIMIT_WINDOW_MS = 1000
const INBOUND_EMAIL_RATE_LIMIT_MAX = 10

// Maximum HTTP request body size for inbound email webhook.
const MAX_INBOUND_EMAIL_BODY_BYTES = 30 * 1024 * 1024

async function parseJsonBodyWithLimit(request: Request, maxBytes: number): Promise<unknown> {
  const contentLength = request.headers.get("content-length")
  if (contentLength) {
    const contentLengthN = Number.parseInt(contentLength, 10)
    if (Number.isNaN(contentLengthN)) {
      throw new Response("Bad Request", { status: 400 })
    }
    if (contentLengthN > maxBytes) {
      throw new Response("Payload too large", { status: 413 })
    }
  }

  if (!request.body) {
    throw new Response("Bad Request", { status: 400, statusText: "Invalid JSON" })
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        throw new Response("Payload too large", { status: 413 })
      }

      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bodyText = new TextDecoder().decode(
    chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, totalBytes),
  )

  try {
    return JSON.parse(bodyText)
  } catch {
    throw new Response("Bad Request", { status: 400, statusText: "Invalid JSON" })
  }
}

export async function action({ params, request }: Route.ActionArgs) {
  try {
    if (!serverConfig.mail?.postmark.inbound_email_auth_secret) {
      return new Response("Not Implemented", {
        status: 501,
      })
    }

    if (params.secret !== serverConfig.mail.postmark.inbound_email_auth_secret) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Inbound Email Webhook"' },
      })
    }

    let rawEmail: unknown
    try {
      rawEmail = await parseJsonBodyWithLimit(request, MAX_INBOUND_EMAIL_BODY_BYTES)
    } catch (error) {
      if (error instanceof Response) {
        return error
      }

      return new Response("Bad Request", { status: 400, statusText: "Invalid JSON" })
    }

    const emailParsingResult = PostmarkEmailSchema.safeParse(rawEmail)
    if (!emailParsingResult.success) {
      return new Response("Bad Request", { status: 400, statusText: "Invalid JSON data" })
    }
    let email = emailParsingResult.data

    // Normalize the email if needed
    const normalizedEmail = email.FromFull.Email

    const emailBlock = await getMatchingEmailBlock(fdm, normalizedEmail)

    if (emailBlock) {
      return new Response("Forbidden", {
        status: 403,
      })
    }

    const rateLimitResult = await checkRateLimit(
      `inbound-email-ticket:${normalizedEmail.toLowerCase()}`,
      INBOUND_EMAIL_RATE_LIMIT_WINDOW_MS,
      INBOUND_EMAIL_RATE_LIMIT_MAX,
    )
    if (!rateLimitResult.allowed) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(rateLimitResult.resetIn, 1)),
          "RateLimit-Limit": String(INBOUND_EMAIL_RATE_LIMIT_MAX),
          "RateLimit-Remaining": "0",
          "RateLimit-Reset": String(Math.max(rateLimitResult.resetIn, 1)),
        },
      })
    }

    // Try to find the ticket that the user is replying to, either from the ticket subject or the In-Reply-To header.
    const principals = await lookupPrincipal(fdm, normalizedEmail)
    const senderPrincipal = principals.find(
      (u) => u.email?.toLowerCase() === normalizedEmail.toLowerCase(),
    )
    const messageSubject = email.Subject ?? "Subject"
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
        ticket.requester_email?.toLowerCase() === normalizedEmail.toLowerCase())
    ) {
      const messageBody =
        typeof email.StrippedTextReply === "string" && email.StrippedTextReply.length > 0
          ? email.StrippedTextReply
          : (email.TextBody ?? "Ticket")
      const ticket_id = await addMessageFromInboundEmailUnchecked(
        fdm,
        ticket.ticket_id,
        messageBody,
        senderPrincipal?.id,
      )
      try {
        await markTicketAsNotViewedByAll(fdm, ticket.ticket_id)
      } catch (unreadError) {
        // Marking as not read failed, but continue
        void handleActionError(unreadError)
      }
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
        handleActionError(err)
      }
      return new Response("OK", { status: 200 })
    }

    // Create a new ticket
    // For new tickets use the entire email body in case it contains further context in quotes
    const messageBody = email.TextBody ?? "Ticket"
    const ticket_id = await createTicketFromInboundEmail(
      fdm,
      normalizedEmail,
      messageBody,
      senderPrincipal?.id,
    )
    if (email.Subject) {
      await updateTicketSubjectAndPriorityUnchecked(fdm, ticket_id, email.Subject)
    }

    // Perform ticket triage before notifying the agent
    try {
      if (serverConfig.helpdesk.enableTicketTriage && serverConfig.integrations.gemini) {
        await performTicketTriage(serverConfig.integrations.gemini.api_key, ticket_id, messageBody)
      }
    } catch (err) {
      handleActionError(err)
    }

    // Assign the ticket to an agent and send an email to them
    try {
      let assigned_agent_id: string | null = null

      // First try to assign based on agent availability
      try {
        const auto_assignment_result = await autoAssignTicket(fdm, ticket_id, new Date())
        assigned_agent_id = auto_assignment_result.assigned ? auto_assignment_result.agent_id : null
      } catch (autoAssignError) {
        handleActionError(autoAssignError)
      }

      // If auto assigning doesn't work due to error or no agent being available, assign to an admin
      if (!assigned_agent_id) {
        assigned_agent_id = await assignTicketToAnAdmin(fdm, ticket_id)
      }

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
      handleActionError(err)
    }

    return new Response("OK", { status: 200 })
  } catch (err) {
    handleActionError(err)
    return new Response("Internal Server Error", { status: 500 })
  }
}
