import {
  addSoilAnalysis,
  getFarms,
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
import { dataWithError, redirectWithSuccess } from "remix-toast"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { BulkSoilAnalysisUploadForm } from "~/components/blocks/soil/bulk-upload-form"
import { matchAnalysesToFields } from "~/components/blocks/soil/bulk-upload-match"
import {
  BulkSoilAnalysisReview,
  type ProcessedAnalysis,
} from "~/components/blocks/soil/bulk-upload-review"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { SidebarInset } from "~/components/ui/sidebar"
import { Spinner } from "~/components/ui/spinner"
import { captureEvent } from "~/lib/analytics.server"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { validateBulkAnalyses } from "~/lib/soil-analysis-bulk"
import { buildObjectKey, deleteObject, uploadObject } from "../integrations/gcs.server"

export const handle = { hideNavigationProgress: true }

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const farms = await getFarms(fdm, session.principal_id)
    const fields = await getFields(fdm, session.principal_id, b_id_farm)

    const farmOptions = farms.map((farm) => ({
      b_id_farm: farm.b_id_farm,
      b_name_farm: farm.b_name_farm,
    }))

    // Get soil parameter descriptions
    const soilParameterDescription = getSoilParametersDescription()

    return {
      b_id_farm,
      farmOptions,
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

export default function BulkSoilAnalysisUploadPage() {
  const { b_id_farm, farmOptions, fields, soilParameterDescription } =
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
          to: `/farm/${b_id_farm}`,
          label: "Terug naar dashboard",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbItem className="hidden md:block">Upload bodemanalyses</BreadcrumbItem>
      </Header>
      <main>
        <FarmTitle
          title="Upload bodemanalyses"
          description={
            step === "upload"
              ? "Upload meerdere bodemanalyses tegelijkertijd en koppel ze aan je percelen."
              : "Controleer de resultaten en bevestig de koppelingen."
          }
        />
        <FarmContent>
          <div className="space-y-6">
            {isSaving ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-12">
                <Spinner className="text-primary h-8 w-8" />
                <p className="text-muted-foreground">Opslaan en koppelen...</p>
              </div>
            ) : step === "upload" ? (
              <BulkSoilAnalysisUploadForm
                onSuccess={handleUploadSuccess}
                files={files}
                onFilesChange={setFiles}
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
        </FarmContent>
      </main>
    </SidebarInset>
  )
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) throw data("Farm ID is required", { status: 400 })

    const session = await getSession(request)
    const formData = await request.formData()

    // Handle final save
    if (formData.has("matches")) {
      const matchesRaw = formData.get("matches") as string
      const analysesDataRaw = formData.get("analysesData") as string

      const matches = JSON.parse(matchesRaw)
      const analysesData = JSON.parse(analysesDataRaw)

      const uploadedPdfs = new Map<string, File>()
      for (const file of formData.getAll("soilAnalysisFile")) {
        if (file instanceof File && file.type === "application/pdf") {
          uploadedPdfs.set(file.name.toLowerCase(), file)
        }
      }

      // Validate the whole batch before inserting anything, so a bad row cannot leave a partial save.
      const validation = validateBulkAnalyses(matches, analysesData)
      if (!validation.valid) {
        captureEvent(session.principal_id, "soil_analysis_bulk_rejected", {
          b_id_farm,
          method: "bulk",
          count: validation.invalidFiles.length,
        })
        return dataWithError(null, validation.message, { status: 400 })
      }

      const results = await Promise.all(
        validation.analyses.map(
          async ({ match, analysis, a_depth_lower, a_depth_upper, b_sampling_date }) => {
            const depthLower = a_depth_lower
            const depthUpper = a_depth_upper
            const samplingDate = b_sampling_date
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
                  void handleActionError(deleteError)
                }
                void handleActionError(gcsSaveError)
              }
            }

            return soilAnalysisId
          },
        ),
      )

      const savedCount = results.filter(Boolean).length
      captureEvent(session.principal_id, "soil_analysis_saved", {
        b_id_farm,
        method: "bulk",
        count: savedCount,
      })

      return redirectWithSuccess(`/farm/${b_id_farm}`, {
        message: "Bodemanalyses succesvol opgeslagen",
      })
    }

    return data({ message: "Invalid request" }, { status: 400 })
  } catch (error) {
    return handleActionError(error)
  }
}
