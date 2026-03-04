import {
    addSoilAnalysis,
    getFarms,
    getFields,
    getSoilParametersDescription,
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
import { SidebarInset } from "~/components/ui/sidebar"
import { Spinner } from "~/components/ui/spinner"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

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
    const [processedAnalyses, setProcessedAnalyses] = useState<
        ProcessedAnalysis[]
    >([])
    const [step, setStep] = useState<"upload" | "review">("upload")
    const navigation = useNavigation()
    const submit = useSubmit()

    const isSaving =
        navigation.state !== "idle" &&
        navigation.formMethod?.toLowerCase() === "post"

    const handleUploadSuccess = (analyses: any[]) => {
        const matchedAnalyses = matchAnalysesToFields(analyses, fields)
        setProcessedAnalyses(matchedAnalyses)
        setStep("review")
    }

    const handleSave = (
        matches: { analysisId: string; fieldId: string }[],
        updatedAnalyses: ProcessedAnalysis[],
    ) => {
        const formData = new FormData()
        // Filter out "none" selections
        const validMatches = matches.filter(
            (m) => m.fieldId !== "none" && m.fieldId !== "",
        )
        formData.append("matches", JSON.stringify(validMatches))
        formData.append("analysesData", JSON.stringify(updatedAnalyses))

        submit(formData, { method: "post" })
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
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <Spinner className="h-8 w-8 text-primary" />
                                <p className="text-muted-foreground">
                                    Opslaan en koppelen...
                                </p>
                            </div>
                        ) : step === "upload" ? (
                            <BulkSoilAnalysisUploadForm
                                onSuccess={handleUploadSuccess}
                            />
                        ) : (
                            <BulkSoilAnalysisReview
                                analyses={processedAnalyses}
                                fields={fields}
                                soilParameterDescription={
                                    soilParameterDescription
                                }
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

            await Promise.all(
                matches.map(
                    async (match: { analysisId: string; fieldId: string }) => {
                        const analysis = analysesData.find(
                            (a: any) => a.id === match.analysisId,
                        )
                        if (analysis) {
                            // Validate depth fields before processing
                            const depthLower = Number(analysis.a_depth_lower)
                            const depthUpper = Number(
                                analysis.a_depth_upper ?? 0,
                            )
                            if (
                                Number.isNaN(depthLower) ||
                                Number.isNaN(depthUpper)
                            ) {
                                throw new Error(
                                    `Analysis ${match.analysisId}: invalid depth values (lower: ${analysis.a_depth_lower}, upper: ${analysis.a_depth_upper})`,
                                )
                            }

                            const samplingDate = analysis.b_sampling_date
                                ? new Date(analysis.b_sampling_date)
                                : undefined
                            if (
                                !samplingDate ||
                                Number.isNaN(samplingDate.getTime())
                            ) {
                                throw new Error(
                                    `Analysis ${match.analysisId}: invalid b_sampling_date (${analysis.b_sampling_date})`,
                                )
                            }
                            // Strip UI-only and redundant properties before saving to DB
                            const {
                                id,
                                location,
                                a_source,
                                matchedFieldId,
                                matchReason,
                                filename,
                                b_name,
                                b_sampling_date,
                                a_depth_upper,
                                a_depth_lower,
                                data: _data, // Strip raw data
                                ...dbAnalysis
                            } = analysis

                            return addSoilAnalysis(
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
                        }
                    },
                ),
            )

            return redirectWithSuccess(`/farm/${b_id_farm}`, {
                message: "Bodemanalyses succesvol opgeslagen",
            })
        }

        return data({ message: "Invalid request" }, { status: 400 })
    } catch (error) {
        return handleActionError(error)
    }
}
