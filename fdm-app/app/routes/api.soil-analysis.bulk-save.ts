import type { MultiPoint, MultiPolygon, Polygon } from "geojson"
import type { ActionFunctionArgs } from "react-router"
import { addSoilAnalysis, updateSoilAnalysis } from "@nmi-agro/fdm-core"
import { type FileUpload, parseFormData } from "@remix-run/form-data-parser"
import { fileTypeFromBuffer } from "file-type"
import { ReviewedUploadFormSchema } from "~/components/blocks/soil/formschema"
import { buildObjectKey, deleteObject, uploadObject } from "~/integrations/gcs.server"
import { captureEvent } from "~/lib/analytics.server"
import { getSession } from "~/lib/auth.server"
import { containsErrorMessage, PERMISSION_DENIED_MESSAGE, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { isExtraSoilParameter } from "~/lib/soil-upload.server"

/**
 * API route: save a batch of checked soil analyses from a bulk upload.
 *
 * The browser saves a large upload (often 100 or more PDFs) in small batches, one request at a
 * time, so that progress can be shown and a failure only affects the rows involved. Every row is
 * saved on its own and gets its own result; the browser keeps the rows that failed for another
 * try, so saving again never stores an analysis twice.
 *
 * Request (multipart): `rows` with a JSON array of {@link BulkSaveRow}, and the PDFs as
 * `file:<fileName>`. Response (JSON): `{ results: BulkSaveResult[] }`.
 */

/** A checked analysis to save. */
export interface BulkSaveRow {
  id: string
  fieldId: string
  fileName: string
  values: Record<string, string | number>
  extra: Record<string, string | number>
  geometries: {
    b_sampling_geometry: MultiPoint | null
    b_sampling_geometry_zone: Polygon | MultiPolygon | null
  }
}

/** The result of saving one row. */
export type BulkSaveResult =
  | { id: string; status: "saved"; a_id: string; pdfStored: boolean }
  | { id: string; status: "failed"; message: string }

const MAX_FILE_SIZE = 5 * 1024 * 1024

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request)

  let formData: FormData
  try {
    formData = await parseFormData(request, { maxFileSize: MAX_FILE_SIZE }, uploadPdf)
  } catch (error) {
    reportError(error, { scope: "soil-analysis-bulk-save" })
    return Response.json(
      { error: "De bestanden konden niet worden ontvangen. Probeer het opnieuw." },
      { status: 400 },
    )
  }

  let rows: BulkSaveRow[]
  try {
    const rowsField = formData.get("rows")
    rows = JSON.parse(typeof rowsField === "string" ? rowsField : "[]") as BulkSaveRow[]
    if (!Array.isArray(rows)) throw new Error("rows is not an array")
  } catch {
    return Response.json({ error: "Ongeldig verzoek." }, { status: 400 })
  }

  const results: BulkSaveResult[] = []
  // One row at a time: each analysis is checked for permission and saved on its own
  for (const row of rows) {
    results.push(await saveRow(session.principal_id, row, formData))
  }

  const savedCount = results.filter((result) => result.status === "saved").length
  if (savedCount > 0) {
    captureEvent(session.principal_id, "soil_analysis_saved", {
      method: "bulk",
      count: savedCount,
    })
  }

  return Response.json({ results })
}

/** Accepts only PDFs, checked by their content, and keeps them in memory. */
async function uploadPdf(fileUpload: FileUpload) {
  if (!fileUpload.fieldName.startsWith("file:")) return undefined
  const buffer = await fileUpload.arrayBuffer()
  const fileType = await fileTypeFromBuffer(buffer)
  if (fileType?.mime !== "application/pdf") return undefined
  return new File([buffer], fileUpload.name, { type: "application/pdf" })
}

async function saveRow(
  principal_id: string,
  row: BulkSaveRow,
  formData: FormData,
): Promise<BulkSaveResult> {
  const id = typeof row?.id === "string" ? row.id : ""
  try {
    if (!row || typeof row.fieldId !== "string" || !row.fieldId) {
      return { id, status: "failed", message: "Er is geen perceel gekoppeld." }
    }

    const parsed = ReviewedUploadFormSchema.safeParse(row.values ?? {})
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return { id, status: "failed", message: issue?.message ?? "De waarden zijn niet geldig." }
    }
    const { a_source, a_depth_lower, a_depth_upper, b_sampling_date, ...values } = parsed.data

    const extra = Object.fromEntries(
      Object.entries(row.extra ?? {}).filter(
        ([key, value]) =>
          isExtraSoilParameter(key) && (typeof value === "number" || typeof value === "string"),
      ),
    )
    const points = row.geometries?.b_sampling_geometry
    const zone = row.geometries?.b_sampling_geometry_zone

    const a_id = await addSoilAnalysis(
      fdm,
      principal_id,
      null,
      a_source,
      row.fieldId,
      a_depth_lower,
      b_sampling_date,
      {
        ...extra,
        ...values,
        b_sampling_geometry: points?.type === "MultiPoint" ? points : null,
        b_sampling_geometry_zone:
          zone?.type === "Polygon" || zone?.type === "MultiPolygon" ? zone : null,
      },
      a_depth_upper ?? 0,
    )

    const file = formData.get(`file:${row.fileName}`)
    let pdfStored = false
    if (file instanceof File) {
      const key = buildObjectKey("soil_analysis", a_id, "pdf")
      let uploaded = false
      try {
        await uploadObject(key, new Uint8Array(await file.arrayBuffer()), "application/pdf")
        uploaded = true
        await updateSoilAnalysis(fdm, principal_id, a_id, { a_file_path: key })
        pdfStored = true
      } catch (storeError) {
        if (uploaded) {
          try {
            await deleteObject(key)
          } catch (deleteError) {
            reportError(deleteError, { scope: "soil-analysis-bulk-save" })
          }
        }
        reportError(storeError, { scope: "soil-analysis-bulk-save" })
      }
    }

    return { id, status: "saved", a_id, pdfStored }
  } catch (error) {
    if (containsErrorMessage(error, PERMISSION_DENIED_MESSAGE)) {
      return {
        id,
        status: "failed",
        message: "Je hebt geen rechten om analyses aan dit perceel toe te voegen.",
      }
    }
    const errorId = reportError(error, { scope: "soil-analysis-bulk-save" })
    return {
      id,
      status: "failed",
      message: `Opslaan is niet gelukt (foutcode ${errorId}). Probeer het opnieuw.`,
    }
  }
}
