import {
  checkHelpdeskPermission,
  createTag,
  deleteTag,
  getTags,
  updateTag,
} from "@nmi-agro/fdm-helpdesk"
import { useLoaderData } from "react-router"
import { dataWithSuccess, dataWithWarning } from "remix-toast"
import z from "zod"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { HelpdeskTagManager } from "~/components/blocks/helpdesk/tag-manager"
import { TagSchema, UpdateTagSchema } from "~/components/blocks/helpdesk/tag-schema"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/support.settings.tags"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Tags - Ondersteuning | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk de beschikbare tags voor ondersteuningstickets.",
    },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)

    const [availableTags, helpdeskWritePermission] = await Promise.all([
      getTags(fdm),
      checkHelpdeskPermission(
        fdm,
        "helpdesk",
        "write",
        "",
        session.principal_id,
        "routes/support.settings.tags",
        false,
      ),
    ])

    return {
      availableTags: availableTags,
      helpdeskWritePermission: helpdeskWritePermission,
    }
  } catch (err) {
    throw handleLoaderError(err)
  }
}

const ActionSchema = z.discriminatedUnion("intent", [
  TagSchema.extend({ intent: z.literal("create_tag") }),
  UpdateTagSchema.extend({ intent: z.literal("update_tag") }),
  z.object({ intent: z.literal("delete_tag"), tag_id: z.string() }),
])

function isNameCollisionError(err: unknown) {
  const MESSAGE = "Another tag with name already exists"
  return (
    (err as Error)?.message === MESSAGE || ((err as Error)?.cause as Error)?.message === MESSAGE
  )
}
const nameCollisionMessageNL = "Er bestaat nog een tag met dezelfde naam."

export async function action({ request }: Route.ActionArgs) {
  try {
    const session = await getSession(request)
    const formValues = await extractFormValuesFromRequest(request, ActionSchema)

    if (formValues.intent === "create_tag") {
      try {
        await createTag(
          fdm,
          session.principal_id,
          formValues.name,
          formValues.color,
          formValues.description,
        )
      } catch (err) {
        if (isNameCollisionError(err)) {
          return dataWithWarning(
            {
              errors: {
                name: { message: nameCollisionMessageNL },
              },
            },
            nameCollisionMessageNL,
          )
        }
        throw err
      }

      return dataWithSuccess(null, {
        message: "Tag is successvol aangemaakt!",
      })
    }

    if (formValues.intent === "update_tag") {
      try {
        await updateTag(
          fdm,
          session.principal_id,
          formValues.tag_id,
          formValues.name,
          formValues.color,
          formValues.description,
        )
      } catch (err) {
        if (isNameCollisionError(err)) {
          return dataWithWarning(
            {
              errors: {
                [`${formValues.tag_id}.name`]: {
                  message: nameCollisionMessageNL,
                },
              },
            },
            nameCollisionMessageNL,
          )
        }
        throw err
      }

      return dataWithSuccess(null, {
        message: "Tag is successvol bijgewerkt!",
      })
    }

    if (formValues.intent === "delete_tag") {
      await deleteTag(fdm, session.principal_id, formValues.tag_id)

      return dataWithSuccess(null, {
        message: "Tag is successvol verwijdert!",
      })
    }
  } catch (err) {
    return handleActionError(err)
  }
}

export default function HelpdeskTagsSettings() {
  const { availableTags, helpdeskWritePermission } = useLoaderData<typeof loader>()

  return (
    <main className="p-6">
      <FarmTitle
        title="Tags"
        description={
          helpdeskWritePermission
            ? "Beheer de beschikbare tags voor ondersteuningstickets. Gebruikers en medewerkers kunnen naar tickets met een tag zoeken."
            : "Bekijk de beschikbare tags voor ondersteuningstickets."
        }
      />
      <HelpdeskTagManager availableTags={availableTags} canModify={helpdeskWritePermission} />
    </main>
  )
}
