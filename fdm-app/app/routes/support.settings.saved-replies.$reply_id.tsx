import { checkHelpdeskPermission, getSavedReply, updateSavedReply } from "@nmi-agro/fdm-helpdesk"
import { useLoaderData } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { SavedReplyEditor } from "~/components/blocks/helpdesk/saved-reply-editor"
import { CreateSavedReplySchema } from "~/components/blocks/helpdesk/saved-reply-schema"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { Route } from "./+types/support.settings.saved-replies.$reply_id"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Opgeslagen reacties beheren - Ondersteuning | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk de beschikbare opgeslagen reacties voor ondersteuningsreacties.",
    },
  ]
}

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)
    const savedReply = await getSavedReply(fdm, session.principal_id, params.reply_id)
    const savedReplyWritePermission = await checkHelpdeskPermission(
      fdm,
      "saved_reply",
      "write",
      params.reply_id,
      session.principal_id,
      "routes/support.settings.saved-replies.$reply_id",
      false,
    )

    return { savedReply, savedReplyWritePermission }
  } catch (err) {
    throw handleLoaderError(err)
  }
}

export async function action({ params, request }: Route.ActionArgs) {
  try {
    const formValues = await extractFormValuesFromRequest(request, CreateSavedReplySchema)

    const session = await getSession(request)

    await updateSavedReply(
      fdm,
      session.principal_id,
      params.reply_id,
      formValues.title,
      formValues.body,
      undefined,
      formValues.is_shared,
    )

    return redirectWithSuccess("/support/settings/saved-replies", {
      message: "Het sjabloon is bijgewerkt.",
    })
  } catch (err) {
    throw handleActionError(err)
  }
}

export default function ExistingSavedReply() {
  const { savedReply, savedReplyWritePermission } = useLoaderData<typeof loader>()

  return (
    <>
      <FarmTitle
        title={
          savedReplyWritePermission ? "Opgeslagen reactie bijwerken" : "Opgeslagen reactie bekijken"
        }
        description={`Hier kun je de titel, tekst en andere instellingen van het sjabloon ${savedReplyWritePermission ? "bijwerken" : "bekijken"}.`}
        action={{ to: "/support/settings/saved-replies", label: "Terug" }}
      />
      <SavedReplyEditor reply={savedReply} canModify={savedReplyWritePermission} />
    </>
  )
}
