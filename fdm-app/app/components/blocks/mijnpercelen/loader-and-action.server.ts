import type { RvoImportReviewItem } from "@nmi-agro/fdm-rvo/types"
import type { MetaFunction } from "react-router"
import { type Field, getCultivationsFromCatalogue, getFarm } from "@nmi-agro/fdm-core"
import { reviewShapefileImport } from "@nmi-agro/fdm-rvo"
import { createFsFileStorage } from "@remix-run/file-storage/fs"
import { type FileUpload, parseFormData } from "@remix-run/form-data-parser"
import fs from "node:fs/promises"
import { data } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import {
  getImportValidationMessage,
  ImportReviewChoicesSchema,
} from "~/components/blocks/rvo/schema"
import { captureEvent } from "~/lib/analytics.server"
import { getSession } from "~/lib/auth.server"
import { getCalendar } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { extractErrorMessage, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { saveRvoImport } from "~/lib/rvo-import.server"

export const handle = { hideNavigationProgress: true }

// Meta
export const meta: MetaFunction = () => {
  return [
    {
      title: `Shapefile uploaden - Bedrijf toevoegen | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Upload een shapefile om percelen te importeren.",
    },
  ]
}

interface MijnPercelenUploadServerContext {
  request: Request
  params: {
    b_id_farm: string
    calendar: string
  }
}
export async function loader({ request, params }: MijnPercelenUploadServerContext) {
  // Get the Id and name of the farm
  const b_id_farm = params.b_id_farm
  if (!b_id_farm) {
    throw data("Farm ID is required", {
      status: 400,
      statusText: "Farm ID is required",
    })
  }

  // Get the session
  const session = await getSession(request)

  const farm = await getFarm(fdm, session.principal_id, b_id_farm)
  if (!farm) {
    throw data("Farm not found", {
      status: 404,
      statusText: "Farm not found",
    })
  }

  const calendar = getCalendar(params)

  const cultivationsCatalogue = await getCultivationsFromCatalogue(
    fdm,
    session.principal_id,
    params.b_id_farm,
  )

  const cultivationOptions = cultivationsCatalogue.map((c) => ({
    value: c.b_lu_catalogue,
    label: c.b_lu_name,
  }))
  return { b_id_farm, b_name_farm: farm.b_name_farm, calendar, cultivationOptions }
}

export async function genericAction(
  { request, params }: MijnPercelenUploadServerContext,
  returnUrl: string,
): Promise<
  | Response
  | {
      success?: boolean
      message?: string
      suggestedYear?: number
      RvoImportReviewData?: RvoImportReviewItem<Field>[]
    }
> {
  const storageKeys: string[] = []
  const uploadRequestId = crypto.randomUUID()
  const fileStorage = createFsFileStorage(`./uploads/shapefiles/${uploadRequestId}`)
  try {
    const { b_id_farm, calendar: yearString } = params
    if (!b_id_farm || !yearString) {
      throw data(
        {
          message: "b_id_farm and calendar are required",
          success: false,
        },
        {
          status: 400,
        },
      )
    }
    const year = Number(yearString)
    if (!Number.isInteger(year)) {
      throw data({ message: "Ongeldig kalenderjaar", success: false }, { status: 400 })
    }

    const session = await getSession(request)

    // Parse form data with streaming
    const uploadHandler = async (fileUpload: FileUpload) => {
      const storageKey = crypto.randomUUID()
      storageKeys.push(storageKey)
      await fileStorage.set(storageKey, fileUpload)
      const file = await fileStorage.get(storageKey)
      if (file && "toFile" in file && typeof file.toFile === "function") {
        return (file as unknown as { toFile: () => File }).toFile()
      }
      return file
    }
    const formData = await parseFormData(request, { maxFileSize: 5 * 1024 * 1024 }, uploadHandler)
    const intent = formData.get("intent")

    if (intent === "upload") {
      const files = formData
        .getAll("shapefile")
        .filter((entry): entry is File => entry instanceof File)

      const shp_file = files.find((f) => f.name.endsWith(".shp"))
      const shx_file = files.find((f) => f.name.endsWith(".shx"))
      const dbf_file = files.find((f) => f.name.endsWith(".dbf"))
      const prj_file = files.find((f) => f.name.endsWith(".prj"))

      if (!shp_file || !shx_file || !dbf_file || !prj_file) {
        const message = "Een .shp, .shx, .dbf en .prj bestand zijn verplicht."
        return {
          message: message,
          success: false,
          RvoImportReviewData: undefined,
        }
      }

      // Same comparison as the REST API, including the buffer strip estimate.
      const review = await reviewShapefileImport(
        fdm,
        session.principal_id,
        b_id_farm,
        { shp: shp_file, shx: shx_file, dbf: dbf_file, prj: prj_file },
        year,
      )
      if (!review.valid) {
        return {
          success: false,
          message: `Het shapefile bevat percelen met een ingangsdatum in ${review.suggestedYear}, maar u uploadt voor kalenderjaar ${year}. Controleer of u het juiste shapefile heeft geselecteerd en het juiste jaar heeft gekozen.`,
          suggestedYear: review.suggestedYear,
          RvoImportReviewData: undefined,
        }
      }

      return {
        RvoImportReviewData: review.items,
        message: "Percelen zijn klaar voor beoordeling! 🎉",
        success: true,
      }
    }

    if (intent === "save_fields") {
      try {
        const fieldsToAddJson = formData.get("fieldsToAdd")
        const fieldsToRemoveJson = formData.get("fieldsToRemove")
        const fieldsToUpdateJson = formData.get("fieldsToUpdate")

        if (
          typeof fieldsToAddJson !== "string" ||
          typeof fieldsToRemoveJson !== "string" ||
          typeof fieldsToUpdateJson !== "string"
        ) {
          return {
            success: false,
            message: "Geen data gevonden om te verwerken. Upload het shapefile opnieuw.",
          }
        }

        const formValues = ImportReviewChoicesSchema.parse({
          fieldsToAdd: JSON.parse(fieldsToAddJson),
          fieldsToRemove: JSON.parse(fieldsToRemoveJson),
          fieldsToUpdate: JSON.parse(fieldsToUpdateJson),
        })

        const { created: addedFields } = await saveRvoImport(
          session.principal_id,
          b_id_farm,
          year,
          formValues,
        )

        captureEvent(session.principal_id, "fields_imported_rvo", {
          b_id_farm,
          field_count: addedFields.length,
          calendar: yearString,
        })

        return redirectWithSuccess(returnUrl, "Percelen zijn succesvol geïmporteerd! 🎉")
      } catch (e: any) {
        console.error("Error at saving RVO fields: ", e)
        return {
          success: false,
          message:
            getImportValidationMessage(e) ??
            `Het opslaan van de percelen is mislukt. Uw keuzes zijn bewaard, probeer het opnieuw. (${await extractErrorMessage(e)})`,
        }
      }
    }

    return {}
  } catch (e: any) {
    console.error("Error at saving RVO fields: ", e)
    return {
      success: false,
      message: `Error at saving RVO fields: ${await extractErrorMessage(e)}`,
    }
  } finally {
    // eslint-disable-next-line typescript/await-thenable -- Promise.allSettled is natively awaitable, but linter context can occasionally misidentify third-party promise types.
    await Promise.allSettled(storageKeys.map((storageKey) => fileStorage.remove(storageKey)))
    await fs
      .rm(`./uploads/shapefiles/${uploadRequestId}`, {
        recursive: true,
        force: true,
      })
      .catch((err: unknown) => {
        reportError(err, {
          uploadRequestId: uploadRequestId,
        })
      })
  }
}
