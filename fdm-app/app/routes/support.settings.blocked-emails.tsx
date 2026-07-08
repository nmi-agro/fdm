import {
  addEmailBlock,
  checkHelpdeskPermission,
  getAgents,
  getEmailBlock,
  getEmailBlocks,
  removeEmailBlock,
} from "@nmi-agro/fdm-helpdesk"
import { useLoaderData } from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import z from "zod"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import {
  BlockedEmailsManager,
  EmailBlockExtended,
} from "~/components/blocks/helpdesk/blocked-email-manager"
import {
  AddBlockedEmailSchema,
  RemoveBlockedEmailSchema,
} from "~/components/blocks/helpdesk/blocked-email-schema"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/support.settings.blocked-emails"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Geblokkeerde e-mailadressen - Ondersteuning | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk de e-mailadressen waarvandaan geen e-mails verzonden mogen worden.",
    },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)

    const blockedEmails = await getEmailBlocks(fdm, session.principal_id)

    // What is above would only succeed if the principal was an admin
    const helpdeskWritePermission = true

    let blockedEmailsExtended: EmailBlockExtended[] = []
    if (blockedEmails.length > 0) {
      const agents = await getAgents(fdm, session.principal_id)
      const agentsMap = new Map(agents.map((agent) => [agent.agent_id, agent]))
      blockedEmailsExtended = blockedEmails.map((block) => ({
        ...block,
        blocked_by_name: agentsMap.get(block.blocked_by)?.display_name ?? null,
      }))
    }

    return {
      blockedEmails: blockedEmailsExtended,
      helpdeskWritePermission: helpdeskWritePermission,
    }
  } catch (err) {
    throw handleLoaderError(err)
  }
}

const ActionSchema = z.discriminatedUnion("intent", [
  AddBlockedEmailSchema,
  RemoveBlockedEmailSchema,
])

export async function action({ request }: Route.ActionArgs) {
  try {
    const session = await getSession(request)

    const formValues = await extractFormValuesFromRequest(request, ActionSchema)

    if (formValues.intent === "add_email_block") {
      await checkHelpdeskPermission(
        fdm,
        "helpdesk",
        "write",
        "",
        session.principal_id,
        "routes/support.settings.blocked-emails",
      )

      if (await getEmailBlock(fdm, formValues.email)) {
        return dataWithError("Dit emailadres is al geblokkeerd.", {
          message: "Dit emailadres is al geblokkeerd.",
        })
      }

      await addEmailBlock(fdm, session.principal_id, formValues.email, formValues.reason)

      return dataWithSuccess("Email is succesvol geblokkeerd!", {
        message: "Email is succesvol geblokkeerd!",
      })
    }

    if (formValues.intent === "remove_email_block") {
      await removeEmailBlock(fdm, session.principal_id, formValues.email)

      return dataWithSuccess("Email is succesvol ongeblokkeerd!", {
        message: "Email is succesvol ongeblokkeerd!",
      })
    }
  } catch (err) {
    throw handleActionError(err)
  }
}

export default function HelpdeskAgentSettings() {
  const { blockedEmails, helpdeskWritePermission } = useLoaderData<typeof loader>()

  return (
    <main className="p-6">
      <FarmTitle
        title="Geblokkeerde e-mailadressen"
        description="Bekijk de e-mailadressen waarvandaan geen e-mails verzonden mogen worden."
      />
      <BlockedEmailsManager blockedEmails={blockedEmails} canModify={helpdeskWritePermission} />
    </main>
  )
}
