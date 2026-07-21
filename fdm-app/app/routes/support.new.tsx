import { getFarms, getPrincipal } from "@nmi-agro/fdm-core"
import {
  assignTicketToAnAdmin,
  createTicket,
  getMessagesForTicket,
  getTicket,
} from "@nmi-agro/fdm-helpdesk"
import { useLoaderData } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import type { FarmOptions } from "~/components/blocks/farm/farm"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { TicketComposer } from "~/components/blocks/helpdesk/ticket-composer"
import { TicketSchema } from "~/components/blocks/helpdesk/ticket-schema"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { serverConfig } from "~/lib/config.server"
import { sendHelpdeskNewMessageEmail } from "~/lib/email.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { performTicketTriage } from "~/lib/support.server"
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

    const ticketCreateInfo = await extractFormValuesFromRequest(request, TicketSchema)

    const ticket_id = await createTicket(fdm, session.principal_id, ticketCreateInfo.body, {
      context: {
        b_id_farm: ticketCreateInfo.context_farm_id,
      },
    })

    // Assign the ticket to an admin and send an email to them
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
            session.user.displayUsername ?? "Een gebruiker",
            ticket.ticket_ref,
            ticket.subject,
            ticket_id,
            messages[0].message_id,
            messages[0].body,
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
