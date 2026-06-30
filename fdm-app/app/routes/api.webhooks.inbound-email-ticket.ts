import { getPrincipal } from "@nmi-agro/fdm-core"
import {
  assignTicketToAnAdmin,
  createTicketFromInboundEmail,
  getTicket,
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

    const ticketBody = email.TextBody ?? "Ticket"

    const ticket_id = await createTicketFromInboundEmail(fdm, email.FromFull.Email, ticketBody)
    if (email.Subject) {
      await updateTicketSubjectAndPriorityUnchecked(fdm, ticket_id, email.Subject)
    }
    try {
      const assigned_agent_id = await assignTicketToAnAdmin(fdm, ticket_id)
      if (assigned_agent_id) {
        const ticket = await getTicket(fdm, assigned_agent_id, ticket_id)
        const agentPrincipal = await getPrincipal(fdm, assigned_agent_id)
        if (agentPrincipal?.email) {
          await sendHelpdeskNewMessageEmail(
            agentPrincipal.email,
            agentPrincipal.displayUserName ?? agentPrincipal.email,
            email.FromFull.Name ?? "Een gebruiker",
            ticket.ticket_ref,
            ticket.subject,
            ticket_id,
            email.TextBody ?? "",
          )
        }
      }
    } catch (err) {
      handleLoaderError(err)
    }
    try {
      if (serverConfig.helpdesk.enableTicketTriage && serverConfig.integrations.gemini) {
        await performTicketTriage(serverConfig.integrations.gemini.api_key, ticket_id, ticketBody)
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
