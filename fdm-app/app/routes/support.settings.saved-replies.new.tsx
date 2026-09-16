import { checkHelpdeskPermission, createSavedReply } from "@nmi-agro/fdm-helpdesk"
import { redirectWithSuccess } from "remix-toast"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { SavedReplyEditor } from "~/components/blocks/helpdesk/saved-reply-editor"
import { CreateSavedReplySchema } from "~/components/blocks/helpdesk/saved-reply-schema"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { Route } from "./+types/support.settings.saved-replies.new"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Nieuwe opgeslagen reactie - Ondersteuning | ${clientConfig.name}`,
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
    await checkHelpdeskPermission(
      fdm,
      "helpdesk",
      "read",
      "",
      session.principal_id,
      "routes/support.settings.saved-replies.new",
      true,
    )
  } catch (err) {
    throw handleLoaderError(err)
  }
}

export async function action({ request }: Route.ActionArgs) {
  try {
    const formValues = await extractFormValuesFromRequest(request, CreateSavedReplySchema)

    const session = await getSession(request)

    await createSavedReply(
      fdm,
      formValues.title,
      formValues.body,
      session.principal_id,
      "generic",
      formValues.is_shared,
    )

    return redirectWithSuccess("/support/settings/saved-replies", {
      message: "Het sjabloon is succesvol aangemaakt! 🎉",
    })
  } catch (err) {
    throw handleActionError(err)
  }
}

export default function NewSavedReply() {
  return (
    <>
      <FarmTitle
        title="Nieuw sjabloon"
        description="Hier kun je een nieuw sjabloon aanmaken."
        action={{ to: "/support/settings/saved-replies", label: "Terug" }}
      />
      <SavedReplyEditor canModify={true} />
    </>
  )
}
