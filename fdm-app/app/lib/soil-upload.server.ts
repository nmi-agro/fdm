import type { MultiPoint, MultiPolygon, Polygon } from "geojson"
import { addSoilAnalysis, updateSoilAnalysis } from "@nmi-agro/fdm-core"
import { createFsFileStorage } from "@remix-run/file-storage/fs"
import {
  type FileUpload,
  MaxFileSizeExceededError,
  parseFormData,
} from "@remix-run/form-data-parser"
import { fileTypeFromBuffer } from "file-type"
import { data } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { FormSchema as UploadFormSchema } from "~/components/blocks/soil/form-upload"
import { ReviewedUploadFormSchema } from "~/components/blocks/soil/formschema"
import { REQUIRED_SAMPLING_PARAMETERS } from "~/components/blocks/soil/parameter-groups"
import { buildObjectKey, deleteObject, uploadObject } from "~/integrations/gcs.server"
import { extractSoilAnalysisAndBuffer } from "~/integrations/nmi.server"
import { getSession } from "~/lib/auth.server"
import { handleActionError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromFormData } from "~/lib/form"

/** Maximum size of an uploaded soil analysis PDF. */
const MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * The values read from an uploaded soil analysis PDF, for the user to check before saving.
 */
export interface SoilAnalysisReview {
  /** Identifies this reading, so that the review resets when another PDF is read. */
  id: string
  /** The soil parameters read from the PDF; dates as ISO strings. */
  values: Record<string, string | number>
  /**
   * Soil parameters read from the PDF that are not on the form. They are saved as read, so that no
   * data from the report is lost.
   */
  extra: Record<string, string | number>
  /** Required sampling parameters that were not found in the PDF. */
  missing: string[]
  /** Where the field was sampled, as read from the PDF. */
  geometries: SamplingGeometries
}

/** The sampling geometries of a soil analysis. */
interface SamplingGeometries {
  b_sampling_geometry: MultiPoint | null
  b_sampling_geometry_zone: Polygon | MultiPolygon | null
}

/**
 * Parses a multipart request with a soil analysis PDF. The file must be a PDF by both its MIME type
 * and its content, and at most 5 MB.
 *
 * @param request - The request with the `soilAnalysisFile` field.
 * @returns The parsed form data, including the file.
 * @throws {Error} When the file is not a PDF.
 */
export async function parseSoilAnalysisUpload(request: Request): Promise<FormData> {
  const fileStorage = createFsFileStorage("./uploads/soil_analysis")

  const uploadHandler = async (fileUpload: FileUpload) => {
    if (fileUpload.fieldName === "soilAnalysisFile" && fileUpload.type === "application/pdf") {
      // Check file type based on magic bytes
      const fileBuffer = await fileUpload.arrayBuffer()
      const fileType = await fileTypeFromBuffer(fileBuffer)

      if (fileType?.mime !== "application/pdf") {
        throw new Error("Invalid file type (magic bytes check)")
      }

      const file = new File([fileBuffer], fileUpload.name, { type: fileUpload.type })
      const storageKey = crypto.randomUUID()
      await fileStorage.set(storageKey, file)

      const storedFile = await fileStorage.get(storageKey)
      if (storedFile && "toFile" in storedFile && typeof storedFile.toFile === "function") {
        return (storedFile as unknown as { toFile: () => File }).toFile()
      }
      return storedFile
    }
    throw new Error("Invalid file type (mime check)")
  }

  const formData = await parseFormData(request, { maxFileSize: MAX_FILE_SIZE }, uploadHandler)

  const parsedFile = UploadFormSchema.safeParse({
    soilAnalysisFile: formData.get("soilAnalysisFile"),
  })
  if (!parsedFile.success) {
    throw new Error("Invalid file type (schema check)")
  }

  return formData
}

/**
 * Returns what an upload request asks for: reading the PDF (`extract`, the first step) or saving
 * the checked values (`save`).
 */
export function getSoilAnalysisUploadIntent(formData: FormData): "extract" | "save" {
  const intent = formData.get("intent")
  const value = typeof intent === "string" ? intent.replace(/['"]+/g, "").trim() : ""
  return value === "save" ? "save" : "extract"
}

/**
 * Reads the soil analysis from the uploaded PDF without saving anything, so that the user can
 * check and complete the values first.
 *
 * @param formData - Form data with the `soilAnalysisFile` PDF.
 * @returns The values that were read and the required values that are missing.
 */
export async function extractSoilAnalysisForReview(
  formData: FormData,
): Promise<SoilAnalysisReview> {
  const { soilAnalysis } = await extractSoilAnalysisAndBuffer(formData)

  const schemaKeys = new Set(Object.keys(ReviewedUploadFormSchema.shape))
  const values: Record<string, string | number> = {}
  const extra: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(soilAnalysis)) {
    if (value === null || value === undefined || value === "") continue
    if (schemaKeys.has(key)) {
      if (value instanceof Date) {
        if (!Number.isNaN(value.getTime())) values[key] = value.toISOString()
      } else if (typeof value === "number" || typeof value === "string") {
        values[key] = value
      }
    } else if (
      isExtraSoilParameter(key) &&
      (typeof value === "number" || typeof value === "string")
    ) {
      extra[key] = value
    }
  }

  return {
    id: crypto.randomUUID(),
    values,
    extra,
    missing: REQUIRED_SAMPLING_PARAMETERS.filter((parameter) => !(parameter in values)),
    geometries: {
      b_sampling_geometry: (soilAnalysis.b_sampling_geometry as MultiPoint | undefined) ?? null,
      b_sampling_geometry_zone:
        (soilAnalysis.b_sampling_geometry_zone as Polygon | MultiPolygon | undefined) ?? null,
    },
  }
}

/**
 * Saves a soil analysis from checked upload values and stores its PDF.
 *
 * The values are validated with the soil analysis form schema, without the usual ranges: the lab
 * report is the source and the user has checked the values. The sampling geometries are taken
 * from the review that the client submits back as JSON in `review`. When storing the PDF fails, the
 * soil analysis is kept without a PDF.
 *
 * @param principal_id - The user who saves the analysis.
 * @param b_id - The field of the analysis.
 * @param formData - Form data with the checked values, the PDF and the sampling geometries.
 * @returns The id and source of the new soil analysis.
 */
export async function saveReviewedSoilAnalysis(
  principal_id: string,
  b_id: string,
  formData: FormData,
): Promise<{ a_id: string; a_source: string }> {
  const file = formData.get("soilAnalysisFile")
  if (!(file instanceof File)) {
    throw data("No file uploaded", { status: 400 })
  }
  const review = parseSubmittedReview(formData)
  const geometries = review?.geometries ?? {
    b_sampling_geometry: null,
    b_sampling_geometry_zone: null,
  }

  const valuesFormData = new FormData()
  for (const [key, value] of formData.entries()) {
    if (key === "soilAnalysisFile" || key === "intent" || key === "review") continue
    valuesFormData.append(key, value)
  }
  const values = await extractFormValuesFromFormData(valuesFormData, ReviewedUploadFormSchema)
  const { a_source, a_depth_lower, a_depth_upper, b_sampling_date, ...soilAnalysisData } = values

  const a_id = await addSoilAnalysis(
    fdm,
    principal_id,
    null,
    a_source,
    b_id,
    a_depth_lower,
    b_sampling_date,
    // Parameters that are not on the form are saved as read; the checked values take precedence
    { ...review?.extra, ...soilAnalysisData, ...geometries },
    a_depth_upper ?? 0,
  )

  const objectKey = buildObjectKey("soil_analysis", a_id, "pdf")
  let uploaded = false
  try {
    await uploadObject(objectKey, new Uint8Array(await file.arrayBuffer()), "application/pdf")
    uploaded = true
    await updateSoilAnalysis(fdm, principal_id, a_id, { a_file_path: objectKey })
  } catch (gcsSaveError) {
    try {
      if (uploaded) {
        await deleteObject(objectKey)
      }
    } catch (deleteError) {
      void handleActionError(deleteError)
    }
    void handleActionError(gcsSaveError)
  }

  return { a_id, a_source }
}

/**
 * Returns a user-facing message for an error while reading an uploaded soil analysis PDF, or
 * `null` when the error is not specific to the upload.
 */
export function getSoilAnalysisUploadErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null
  if (error.message.startsWith("Invalid file type")) {
    return "Dit bestand is geen geldige PDF. Kies het PDF-rapport van het lab, van maximaal 5 MB."
  }
  if (error instanceof MaxFileSizeExceededError) {
    return "Dit bestand is groter dan 5 MB. Kies een kleiner PDF-bestand."
  }
  if (error.message.toLowerCase().includes("nmi api key")) {
    return "Het automatisch uitlezen van PDF's is hier niet beschikbaar. Voer de analyse handmatig in."
  }
  if (
    error.message.startsWith("Invalid soil analysis") ||
    error.message.startsWith("Invalid API response") ||
    error.message.startsWith("Invalid depth format") ||
    error.message.startsWith("Invalid numeric depth") ||
    error.message === "Request to NMI API failed"
  ) {
    return "Het is niet gelukt om deze PDF uit te lezen. Controleer of het een rapport is van een van de ondersteunde labs, of voer de analyse handmatig in."
  }
  return null
}

/**
 * Reads the review that the client submits back with the checked values. Only geometries of the
 * expected types are kept; fdm-core validates their coordinates when saving.
 */
function parseSubmittedReview(formData: FormData): SoilAnalysisReview | null {
  const value = formData.get("review")
  if (typeof value !== "string" || value === "") return null
  try {
    const parsed = JSON.parse(value) as Partial<SoilAnalysisReview> | null
    if (!parsed || typeof parsed !== "object" || typeof parsed.id !== "string") return null
    const points = parsed.geometries?.b_sampling_geometry
    const zone = parsed.geometries?.b_sampling_geometry_zone
    const extra = Object.fromEntries(
      Object.entries(parsed.extra && typeof parsed.extra === "object" ? parsed.extra : {}).filter(
        ([key, value]) =>
          isExtraSoilParameter(key) && (typeof value === "number" || typeof value === "string"),
      ),
    )
    return {
      id: parsed.id,
      values: parsed.values && typeof parsed.values === "object" ? parsed.values : {},
      extra,
      missing: Array.isArray(parsed.missing) ? parsed.missing : [],
      geometries: {
        b_sampling_geometry: points?.type === "MultiPoint" ? points : null,
        b_sampling_geometry_zone:
          zone?.type === "Polygon" || zone?.type === "MultiPolygon" ? zone : null,
      },
    }
  } catch {
    return null
  }
}

/**
 * Whether a key read from a PDF is a soil parameter that may be saved as read. Only analysis values
 * (`a_` prefix) qualify; identifiers and the file path never come from the report.
 */
export function isExtraSoilParameter(key: string): boolean {
  return /^a_[a-z0-9_]+$/.test(key) && key !== "a_id" && key !== "a_file_path" && key !== "a_source"
}

/** Whether a caught value is a response created with `data()`, such as a validation error. */
function isDataResponse(value: unknown): value is { data: unknown; init: unknown } {
  return typeof value === "object" && value !== null && "data" in value && "init" in value
}

/**
 * Handles the action of a page where a soil analysis is added from a PDF.
 *
 * - `intent=extract` (the first step) reads the PDF and returns `{ review }` with the values to
 *   check, or `{ uploadError }` when the PDF could not be read. Nothing is saved.
 * - `intent=save` saves the checked values and the PDF, then redirects. When saving fails, the
 *   submitted review is returned with the error, so that the user keeps the values they checked.
 *
 * @param request - The multipart request.
 * @param b_id - The field to add the soil analysis to.
 * @param redirectTo - Where to go after saving, given the id of the new soil analysis.
 * @param onSaved - Called after saving, for example to record an analytics event.
 */
export async function handleSoilAnalysisUploadAction({
  request,
  b_id,
  redirectTo,
  onSaved,
}: {
  request: Request
  b_id: string
  redirectTo: (a_id: string) => string
  onSaved?: (principal_id: string, saved: { a_id: string; a_source: string }) => void
}) {
  let review: SoilAnalysisReview | null = null
  try {
    const session = await getSession(request)
    const formData = await parseSoilAnalysisUpload(request)

    if (getSoilAnalysisUploadIntent(formData) === "save") {
      review = parseSubmittedReview(formData)
      const saved = await saveReviewedSoilAnalysis(session.principal_id, b_id, formData)
      onSaved?.(session.principal_id, saved)
      return redirectWithSuccess(redirectTo(saved.a_id), { message: "Bodemanalyse toegevoegd" })
    }

    return data({ review: await extractSoilAnalysisForReview(formData) })
  } catch (error) {
    const uploadError = review ? null : getSoilAnalysisUploadErrorMessage(error)
    if (uploadError) {
      return data({ uploadError })
    }

    const response = isDataResponse(error) ? error : await handleActionError(error)
    // Keep the review on screen, with the values the user checked, when saving fails
    if (review && isDataResponse(response) && typeof response.data === "object" && response.data) {
      ;(response.data as Record<string, unknown>).review = review
    }
    return response
  }
}
