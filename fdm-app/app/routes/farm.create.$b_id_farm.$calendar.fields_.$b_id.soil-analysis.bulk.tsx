import {
  addSoilAnalysis,
  getFarm,
  getFields,
  getSoilParametersDescription,
  updateSoilAnalysis,
} from "@nmi-agro/fdm-core"
import { useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarmCreate } from "~/components/blocks/header/create-farm"
import { BulkSoilAnalysisUploadForm } from "~/components/blocks/soil/bulk-upload-form"
import { matchAnalysesToFields } from "~/components/blocks/soil/bulk-upload-match"
import {
  BulkSoilAnalysisReview,
  type ProcessedAnalysis,
} from "~/components/blocks/soil/bulk-upload-review"
import { SidebarInset } from "~/components/ui/sidebar"
import { Spinner } from "~/components/ui/spinner"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { buildObjectKey, deleteObject, uploadObject } from "../integrations/gcs.server"
import { captureEvent } from "../lib/analytics.server"

export const handle = { hideNavigationProgress: true }

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) throw data("Farm ID is required", { status: 400 })

    const b_id = params.b_id
    if (!b_id) throw data("Field ID is required", { status: 400 })

    const session = await getSession(request)
    const farm = await getFarm(fdm, session.principal_id, b_id_farm)

    const calendar = getCalendar(params)
    const timeframe = getTimeframe(params)
    const fields = await getFields(fdm, session.principal_id, b_id_farm, timeframe)

    // Get soil parameter descriptions
    const soilParameterDescription = getSoilParametersDescription()

    return {
      b_id_farm,
      b_id,
      b_name_farm: farm.b_name_farm,
      calendar,
      fields: fields.map((f) => ({
        b_id: f.b_id,
        b_name: f.b_name,
        geometry: f.b_geometry,
      })),
      soilParameterDescription,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function BulkSoilAnalysisUploadWizardPage() {
  const { b_id_farm, b_id, b_name_farm, calendar, fields, soilParameterDescription } =
    useLoaderData<typeof loader>()
  const [processedAnalyses, setProcessedAnalyses] = useState<ProcessedAnalysis[]>([])
  const [step, setStep] = useState<"upload" | "review">("upload")
  const navigation = useNavigation()
  const submit = useSubmit()

  const [files, setFiles] = useState<File[]>([])

  const isSaving = navigation.state !== "idle" && navigation.formMethod?.toLowerCase() === "post"

  const handleUploadSuccess = (analyses: any[]) => {
    const matchedAnalyses = matchAnalysesToFields(analyses, fields)
    setProcessedAnalyses(matchedAnalyses)
    setStep("review")
  }

  const handleSave = (
    matches: { analysisId: string; fieldId: string; filename?: string }[],
    updatedAnalyses: ProcessedAnalysis[],
  ) => {
    const formData = new FormData()
    // Filter out "none" selections
    const validMatches = matches.filter((m) => m.fieldId !== "none" && m.fieldId !== "")
    const validMatchFiles = new Set(
      validMatches
        .map((match) => match.filename?.toLowerCase())
        .filter((filename) => typeof filename === "string"),
    )
    formData.append("matches", JSON.stringify(validMatches))
    formData.append("analysesData", JSON.stringify(updatedAnalyses))
    for (const file of files) {
      if (validMatchFiles.has(file.name.toLowerCase())) {
        formData.append("soilAnalysisFile", file)
      }
    }

    void submit(formData, { method: "post", encType: "multipart/form-data" })
  }

  return (
    <SidebarInset>
      <Header
        action={{
          to: `/farm/create/${b_id_farm}/${calendar}/fields/${b_id}`,
          label: "Terug naar percelen",
          disabled: false,
        }}
      >
        <HeaderFarmCreate b_name_farm={b_name_farm} />
      </Header>
      <main>
        <div className="space-y-6 p-10 pb-16">
          <div className="space-y-0.5">
            <h2 className="text-2xl font-bold tracking-tight">Upload bodemanalyses</h2>
            <p className="text-muted-foreground">
              {step === "upload"
                ? "Upload meerdere bodemanalyses tegelijkertijd en koppel ze aan je percelen."
                : "Controleer de resultaten en bevestig de koppelingen."}
            </p>
          </div>
          <div className="pt-6">
            {isSaving ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-12">
                <Spinner className="text-primary h-8 w-8" />
                <p className="text-muted-foreground">Opslaan en koppelen...</p>
              </div>
            ) : step === "upload" ? (
              <BulkSoilAnalysisUploadForm
                files={files}
                onFilesChange={setFiles}
                onSuccess={handleUploadSuccess}
              />
            ) : (
              <BulkSoilAnalysisReview
                analyses={processedAnalyses}
                fields={fields}
                soilParameterDescription={soilParameterDescription}
                onSave={handleSave}
                onCancel={() => setStep("upload")}
              />
            )}
          </div>
        </div>
      </main>
    </SidebarInset>
  )
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) throw data("Farm ID is required", { status: 400 })

    const session = await getSession(request)
    const calendar = getCalendar(params)
    const formData = await request.formData()

    if (formData.has("matches")) {
      const matches = JSON.parse(formData.get("matches") as string)
      const analysesData = JSON.parse(formData.get("analysesData") as string)

      const uploadedPdfs = new Map<string, File>()
      for (const file of formData.getAll("soilAnalysisFile")) {
        if (file instanceof File && file.type === "application/pdf") {
          uploadedPdfs.set(file.name.toLowerCase(), file)
        }
      }

      const results = await Promise.all(
        matches.map(async (match: { analysisId: string; fieldId: string }) => {
          const analysis = analysesData.find((a: any) => a.id === match.analysisId)
          if (analysis) {
            // Validate depth fields before processing
            const depthLower = Number(analysis.a_depth_lower)
            const depthUpper = Number(analysis.a_depth_upper ?? 0)
            if (Number.isNaN(depthLower) || Number.isNaN(depthUpper)) {
              throw new Error(
                `Analysis ${match.analysisId}: invalid depth values (lower: ${analysis.a_depth_lower}, upper: ${analysis.a_depth_upper})`,
              )
            }

            const samplingDate = analysis.b_sampling_date
              ? new Date(analysis.b_sampling_date)
              : undefined
            if (!samplingDate || Number.isNaN(samplingDate.getTime())) {
              throw new Error(
                `Analysis ${match.analysisId}: invalid b_sampling_date (${analysis.b_sampling_date})`,
              )
            }
            // Strip UI-only and redundant properties before saving to DB
            const {
              id: _id,
              location: _location,
              a_source: _a_source,
              matchedFieldId: _matchedFieldId,
              matchReason: _matchReason,
              b_name: _b_name,
              b_sampling_date: _b_sampling_date,
              a_depth_upper: _a_depth_upper,
              a_depth_lower: _a_depth_lower,
              data: _data, // Strip raw data
              filename,
              ...dbAnalysis
            } = analysis

            const soilAnalysisId = await addSoilAnalysis(
              fdm,
              session.principal_id,
              null,
              analysis.a_source || "other",
              match.fieldId,
              depthLower,
              samplingDate,
              dbAnalysis,
              depthUpper,
            )

            const file = uploadedPdfs.get(filename.toLowerCase())

            if (file) {
              const key = buildObjectKey("soil_analysis", soilAnalysisId, "pdf")
              let uploaded = false
              try {
                await uploadObject(key, file.stream(), "application/pdf")
                uploaded = true
                await updateSoilAnalysis(fdm, session.principal_id, soilAnalysisId, {
                  a_file_path: key,
                })
              } catch (gcsSaveError) {
                try {
                  if (uploaded) {
                    await deleteObject(key)
                  }
                } catch (deleteError) {
                  handleActionError(deleteError)
                }
                handleActionError(gcsSaveError)
              }
            }

            return soilAnalysisId
          }
        }),
      )

      const savedCount = results.filter(Boolean).length
      captureEvent(session.principal_id, "soil_analysis_saved", {
        b_id_farm,
        method: "bulk",
        count: savedCount,
      })

      return redirectWithSuccess(`/farm/create/${b_id_farm}/${calendar}/fields`, {
        message: "Bodemanalyses succesvol opgeslagen",
      })
    }

    return data({ message: "Invalid request" }, { status: 400 })
  } catch (error) {
    return handleActionError(error)
  }
}
