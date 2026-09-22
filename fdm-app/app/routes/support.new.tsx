import { getFarms, getPrincipal } from "@nmi-agro/fdm-core"
import {
  assignTicketToAnAdmin,
  autoAssignTicket,
  createTicket,
  getMessagesForTicket,
  getTicket,
} from "@nmi-agro/fdm-helpdesk"
import { FileUpload, parseFormData } from "@remix-run/form-data-parser"
import { useLoaderData } from "react-router"
import { dataWithError, dataWithWarning, redirectWithSuccess } from "remix-toast"
import type { FarmOptions } from "~/components/blocks/farm/farm"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { AttachmentGridItem } from "~/components/blocks/helpdesk/attachment-grid"
import { attachFiles } from "~/components/blocks/helpdesk/attachment.server"
import { TicketComposer } from "~/components/blocks/helpdesk/ticket-composer"
import { TicketSchema } from "~/components/blocks/helpdesk/ticket-schema"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { serverConfig } from "~/lib/config.server"
import { sendHelpdeskNewMessageEmail } from "~/lib/email.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { checkRateLimit } from "~/lib/rate-limit.server"
import { performTicketTriage } from "~/lib/support.server"
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS,
  sanitizeAttachmentFileName,
} from "~/lib/upload-utils"
import {
  ATTACHMENT_UPLOAD_RATE_LIMIT_MAX,
  ATTACHMENT_UPLOAD_RATE_LIMIT_WINDOW_MS,
  readAndValidateAttachmentUpload,
} from "~/lib/upload-utils.server"
import type { Route } from "./+types/support.new"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Nieuw ticket - Ondersteuning | ${clientConfig.name}`,
    },
    {
      name: "description",
      content:
        "Stel een vraag of meld een probleem. Een medewerker neemt binnen enkele werkdagen contact met u op.",
    },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    let farmOptions: FarmOptions = []
    const url = new URL(request.url)

    try {
      const session = await getSession(request)
      const farms = await getFarms(fdm, session.principal_id)

      farmOptions = farms.map((farm) => ({
        b_id_farm: farm.b_id_farm,
        b_name_farm: farm.b_name_farm,
      }))
    } catch (err) {
      handleLoaderError(err)
    }

    return {
      farmOptions: farmOptions,
      initial_context_farm_id: url.searchParams.get("context_farm_id"),
    }
  } catch (err) {
    throw handleLoaderError(err)
  }
}

export async function action({ request }: Route.ActionArgs) {
  try {
    const session = await getSession(request)

    const files: { name: string; buffer: Buffer; mime: string }[] = []

    const uploadHandler = async (fileUpload: FileUpload) => {
      if (fileUpload.fieldName !== "attachments") return undefined

      const rateLimitResult = await checkRateLimit(
        `helpdesk-attachment-upload:${session.principal_id}`,
        ATTACHMENT_UPLOAD_RATE_LIMIT_WINDOW_MS,
        ATTACHMENT_UPLOAD_RATE_LIMIT_MAX,
      )
      if (!rateLimitResult.allowed) {
        throw new Error("U heeft te veel bestanden geüpload. Probeer het later opnieuw.")
      }

      const result = await readAndValidateAttachmentUpload(
        fileUpload,
        ALLOWED_ATTACHMENT_MIME_TYPES,
      )

      files.push({ name: sanitizeAttachmentFileName(fileUpload.name), ...result })
    }

    let formData: FormData
    try {
      formData = await parseFormData(
        request,
        { maxFileSize: MAX_ATTACHMENT_SIZE, maxFiles: MAX_ATTACHMENTS },
        uploadHandler,
      )
    } catch (error) {
      console.error("Failed to parse form data for profile picture upload:", error)
      const message = error instanceof Error ? error.message : "Invalid upload"
      return dataWithError(null, message)
    }

    const actionSchemaResult = TicketSchema.safeParse(Object.fromEntries(formData.entries()))

    if (actionSchemaResult.error) {
      console.error(
        "Action validation failed for the new support ticket page:",
        actionSchemaResult.error,
      )
      return dataWithError(null, "De ingevoerde gegevens zijn ongeldig.")
    }

    const ticketCreateInfo = actionSchemaResult.data

    const ticket_id = await createTicket(fdm, session.principal_id, ticketCreateInfo.body, {
      context: {
        b_id_farm: ticketCreateInfo.context_farm_id,
      },
    })

    // Add the attachments
    let attachedFiles: AttachmentGridItem[] = []
    // An empty file input causes a single file with no content to be submitted.
    const filesToAttach = files.filter((f) => f.buffer.byteLength > 0).slice(0, MAX_ATTACHMENTS)
    // Add the attachments
    if (filesToAttach.length > 0) {
      try {
        const ticketMessages = await getMessagesForTicket(fdm, session.principal_id, ticket_id)
        if (ticketMessages.length > 0) {
          attachedFiles = await attachFiles(
            fdm,
            session.principal_id,
            ticketMessages[0].message_id,
            filesToAttach,
          )
        }
      } catch (err) {
        handleActionError(err)
      }
    }

    // Assign the ticket to an agent and send an email to them
    try {
      let assigned_agent_id: string | null = null

      // First try to assign based on agent availability
      try {
        const auto_assignment_result = await autoAssignTicket(fdm, ticket_id, new Date())
        assigned_agent_id = auto_assignment_result.assigned ? auto_assignment_result.agent_id : null
      } catch (autoAssignError) {
        void handleActionError(autoAssignError)
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
            session.user.displayUsername ?? "Een gebruiker",
            ticket.ticket_ref,
            ticket.subject,
            ticket_id,
            messages[0].message_id,
            messages[0].body,
            attachedFiles,
          )
        }
      }
    } catch (assignmentError) {
      void handleActionError(assignmentError)
    }

    // Generate subject and priority if Gemini is configured
    if (serverConfig.helpdesk.enableTicketTriage && serverConfig.integrations.gemini) {
      // If it is slow you can remove the await in the beginning
      await performTicketTriage(
        serverConfig.integrations.gemini.api_key,
        ticket_id,
        ticketCreateInfo.body,
        attachedFiles,
      )
    }

    if (attachedFiles.length < filesToAttach.length) {
      return dataWithWarning(
        {
          resetMessageForm: true,
        },
        {
          message:
            "We hebben uw vraag ontvangen. Niet alle bijlagen konden worden geüpload. Een collega neemt binnenkort contact met u op.",
        },
      )
    }

    return redirectWithSuccess(
      `/support/ticket/${ticket_id}`,
      "We hebben uw vraag ontvangen. Een collega neemt binnenkort contact met u op.",
    )
  } catch (err) {
    return handleActionError(err)
  }
}

export default function NewTicket() {
  const { farmOptions, initial_context_farm_id } = useLoaderData<typeof loader>()
  return (
    <main className="p-6">
      <FarmTitle
        title="Nieuw ticket"
        description="Stel uw vraag of meld een probleem. Een medewerker neemt doorgaans binnen enkele werkdagen contact met u op."
      />
      <TicketComposer farmOptions={farmOptions} initial_context_farm_id={initial_context_farm_id} />
    </main>
  )
}
