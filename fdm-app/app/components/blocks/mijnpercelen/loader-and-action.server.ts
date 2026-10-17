import type { RvoImportReviewItem } from "@nmi-agro/fdm-rvo/types"
import type { MetaFunction } from "react-router"
import {
  addCultivation,
  addField,
  addSoilAnalysis,
  determineIfFieldIsBuffer,
  type Field,
  type FieldGeometry,
  getCultivationsForFarm,
  getCultivationsFromCatalogue,
  getDefaultDatesOfCultivation,
  getFarm,
  getFields,
  removeCultivation,
  removeField,
  updateField,
} from "@nmi-agro/fdm-core"
import { createFsFileStorage } from "@remix-run/file-storage/fs"
import { type FileUpload, parseFormData } from "@remix-run/form-data-parser"
import area from "@turf/area"
import { lineString } from "@turf/helpers"
import { length } from "@turf/length"
import fs from "node:fs/promises"
import { data } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { ImportReviewChoicesSchema } from "~/components/blocks/rvo/schema"
import { getNmiApiKey, getSoilParameterEstimatesForGeometry } from "~/integrations/nmi.server"
import { captureEvent } from "~/lib/analytics.server"
import { getSession } from "~/lib/auth.server"
import { getCalendar } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { extractErrorMessage, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
  compareFields,
  getRvoFieldsFromShapefile,
  RvoImportReviewStatus,
  validateShapefileYear,
} from "~/lib/rvo.server"

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
      // Prepare existing fields for comparison
      const fields = await getFields(fdm, session.principal_id, b_id_farm)
      const allCultivations = await getCultivationsForFarm(fdm, session.principal_id, b_id_farm)
      const fieldsExtended = fields.map((field) => ({
        ...field,
        cultivations: allCultivations.get(field.b_id) ?? [],
      }))
      const cultivationsCatalogue = await getCultivationsFromCatalogue(
        fdm,
        session.principal_id,
        b_id_farm,
      )

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

      const rvoFields = await getRvoFieldsFromShapefile(shp_file, shx_file, dbf_file, prj_file)

      // Validate that no field has a BeginDate year greater than the selected calendar year
      const yearValidation = validateShapefileYear(rvoFields, year)
      if (!yearValidation.valid) {
        return {
          success: false,
          message: `Het shapefile bevat percelen met een ingangsdatum in ${yearValidation.maxYear}, maar u uploadt voor kalenderjaar ${year}. Controleer of u het juiste shapefile heeft geselecteerd en het juiste jaar heeft gekozen.`,
          suggestedYear: yearValidation.maxYear,
          RvoImportReviewData: undefined,
        }
      }

      /** Calculates the perimeter of the given polygon geometry in meters */
      function perimeter(geometry: FieldGeometry) {
        if (geometry.type === "Polygon") {
          return length(lineString(geometry.coordinates[0]), {
            units: "meters",
          })
        }
        if (geometry.type === "MultiPolygon") {
          return geometry.coordinates
            .map((polygon) => length(lineString(polygon[0]), { units: "meters" }))
            .reduce((a, b) => a + b, 0)
        }
        return 0
      }

      const RvoImportReviewData = compareFields(
        fieldsExtended,
        rvoFields,
        year,
        cultivationsCatalogue,
      )

      // Determine if any imported field might be a buffer strip and add it since shapefiles don't have this information
      for (const item of rvoFields) {
        item.properties.mestData = {
          IndBufferstrook: determineIfFieldIsBuffer(
            area(item.geometry) / 10000, // m2 to ha
            perimeter(item.geometry), // already in meters
            item.properties.CropFieldDesignator,
          )
            ? "J"
            : "N",
        }
      }

      // Override each local field's corresponding RVO field buffer strip status
      for (const item of RvoImportReviewData) {
        item.diffs = item.diffs.filter((diff) => diff !== "b_bufferstrip")
        // b_bufferstrip should no longer be considered a difference
        if (item.diffs.length === 0 && item.status === RvoImportReviewStatus.CONFLICT) {
          item.status = RvoImportReviewStatus.MATCH
        }
        if (item.localField && item.rvoField?.properties.mestData) {
          item.rvoField.properties.mestData.IndBufferstrook = item.localField.b_bufferstrip
            ? "J"
            : "N"
        }
      }

      return {
        RvoImportReviewData: RvoImportReviewData,
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
            message: "Geen data gevonden om te verwerken. Start de RVO import opnieuw.",
          }
        }

        const formValues = ImportReviewChoicesSchema.parse({
          fieldsToAdd: JSON.parse(fieldsToAddJson),
          fieldsToRemove: JSON.parse(fieldsToRemoveJson),
          fieldsToUpdate: JSON.parse(fieldsToUpdateJson),
        })

        const addedFields: { b_id: string; geometry: FieldGeometry }[] = []

        await fdm.transaction(async (tx) => {
          for (const field of formValues.fieldsToAdd) {
            const b_id = await addField(
              tx,
              session.principal_id,
              b_id_farm,
              field.b_name,
              field.b_id_source,
              field.b_geometry as unknown as FieldGeometry,
              field.b_start,
              field.b_acquiring_method,
              field.b_end,
              field.b_bufferstrip,
            )

            if (typeof field.b_lu_catalogue === "string") {
              const defaultDates = await getDefaultDatesOfCultivation(
                tx,
                session.principal_id,
                b_id_farm,
                field.b_lu_catalogue,
                year,
              )

              await addCultivation(
                tx,
                session.principal_id,
                field.b_lu_catalogue,
                b_id,
                defaultDates.b_lu_start,
                defaultDates.b_lu_end,
              )

              addedFields.push({
                b_id: b_id,
                geometry: field.b_geometry as unknown as FieldGeometry,
              })
            }
          }

          for (const field of formValues.fieldsToUpdate) {
            const b_id = field.b_id
            const b_bufferstrip = field.b_bufferstrip

            await updateField(
              tx,
              session.principal_id,
              b_id,
              field.b_name ?? undefined,
              field.b_id_source,
              field.b_geometry as unknown as FieldGeometry,
              field.b_start,
              field.b_acquiring_method,
              field.b_end,
              b_bufferstrip,
            )

            if (typeof field.b_lu_catalogue !== "undefined") {
              if (field.b_lu) {
                // Always remove the existing cultivation
                await removeCultivation(tx, session.principal_id, field.b_lu)
              }

              if (field.b_lu_catalogue) {
                // Add the new cultivation if not null
                const b_lu_catalogue = field.b_lu_catalogue
                const defaultDates = await getDefaultDatesOfCultivation(
                  tx,
                  session.principal_id,
                  b_id_farm,
                  field.b_lu_catalogue,
                  year,
                )

                await addCultivation(
                  tx,
                  session.principal_id,
                  b_lu_catalogue,
                  b_id,
                  defaultDates.b_lu_start,
                  defaultDates.b_lu_end,
                )
              }
            }
          }

          for (const b_id of formValues.fieldsToRemove) {
            await removeField(tx, session.principal_id, b_id)
          }
        })

        const nmiApiKey = getNmiApiKey()
        if (nmiApiKey) {
          const chunkSize = 10
          const chunkedFeatures: { b_id: string; geometry: FieldGeometry }[][] = []
          for (let i = 0; i < addedFields.length; i += chunkSize) {
            chunkedFeatures.push(addedFields.slice(i, i + chunkSize))
          }
          for (const chunk of chunkedFeatures) {
            await Promise.all(
              chunk.map(async ({ b_id, geometry }) => {
                try {
                  const soilEstimates = await getSoilParameterEstimatesForGeometry(
                    fdm,
                    geometry,
                    nmiApiKey,
                  )
                  await addSoilAnalysis(
                    fdm,
                    session.principal_id,
                    undefined,
                    "nl-other-nmi",
                    b_id,
                    soilEstimates.a_depth_lower ?? 30,
                    undefined,
                    soilEstimates,
                    soilEstimates.a_depth_upper,
                  )
                } catch (e) {
                  console.warn(`Failed to fetch soil estimates for field ${b_id}:`, e)
                }
              }),
            )
          }
        }

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
          message: `Error at saving RVO fields: ${await extractErrorMessage(e)}`,
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
