import { getPrincipals } from "@nmi-agro/fdm-core"
import {
  checkHelpdeskPermission,
  getSavedReplies,
  deleteSavedReply,
  getAgents,
} from "@nmi-agro/fdm-helpdesk"
import { useMemo } from "react"
import { useLoaderData } from "react-router"
import { dataWithSuccess } from "remix-toast"
import z from "zod"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { makeHelpdeskUser } from "~/components/blocks/helpdesk/helpdesk-user"
import { DeleteSavedReplySchema } from "~/components/blocks/helpdesk/saved-reply-schema"
import { HelpdeskSavedReplyTable } from "~/components/blocks/helpdesk/saved-reply-table"
import { HelpdeskUser } from "~/components/blocks/helpdesk/types"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/support.settings.saved-replies._index"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Opgeslagen reacties - Ondersteuning | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk de beschikbare opgeslagen reacties voor ondersteuningstickets.",
    },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)

    const [savedReplies, helpdeskWritePermission] = await Promise.all([
      getSavedReplies(fdm, session.principal_id),
      checkHelpdeskPermission(
        fdm,
        "helpdesk",
        "write",
        "",
        session.principal_id,
        "routes/support.settings.saved-replies",
        false,
      ),
    ])

    const principalIds = new Set(savedReplies.map((reply) => reply.created_by))

    const [agents, principals] = await Promise.all([
      getAgents(fdm, session.principal_id),
      getPrincipals(fdm, [...principalIds]),
    ])

    const helpdeskUsers: HelpdeskUser[] = agents.map((agent) => makeHelpdeskUser(agent, principals))

    return {
      savedReplies: savedReplies,
      helpdeskWritePermission: helpdeskWritePermission,
      principal_id: session.principal_id,
      helpdeskUsers: helpdeskUsers,
    }
  } catch (err) {
    throw handleLoaderError(err)
  }
}

const ActionSchema = z.discriminatedUnion("intent", [DeleteSavedReplySchema])

export async function action({ request }: Route.ActionArgs) {
  try {
    const session = await getSession(request)
    const formValues = await extractFormValuesFromRequest(request, ActionSchema)

    if (formValues.intent === "delete_saved_reply") {
      await deleteSavedReply(fdm, session.principal_id, formValues.reply_id)

      return dataWithSuccess(null, {
        message: "Opgeslagen antwoord is succesvol verwijderd!",
      })
    }
  } catch (err) {
    throw handleActionError(err)
  }
}

export default function HelpdeskTagsSettings() {
  const { savedReplies, helpdeskWritePermission, principal_id, helpdeskUsers } =
    useLoaderData<typeof loader>()

  const principalLookup = useMemo(() => {
    return new Map(helpdeskUsers.map((user) => [user.principal_id, user]))
  }, [helpdeskUsers])

  return (
    <main className="p-6">
      <FarmTitle
        title="Opgeslagen reacties"
        description="Beheer de beschikbare sjablonen voor ondersteuningsberichten. Sjablonen kunnen worden gebruikt om snel reacties te geven op veelgestelde vragen of om standaardreacties te bieden."
      />
      <HelpdeskSavedReplyTable
        savedReplies={savedReplies}
        principal_id={principal_id}
        isAdmin={helpdeskWritePermission}
        principalLookup={principalLookup}
      />
    </main>
  )
}
