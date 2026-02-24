import {
    getFarm,
    getFields,
    getSoilParametersDescription,
    addSoilAnalysis,
} from "@nmi-agro/fdm-core"
import { fdm } from "~/lib/fdm.server"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError, handleActionError } from "~/lib/error"
import {
    data,
    type LoaderFunctionArgs,
    type ActionFunctionArgs,
    useLoaderData,
    useNavigation,
    useSubmit,
} from "react-router"
import { useState } from "react"
import { BulkSoilAnalysisUploadForm } from "~/components/blocks/soil/bulk-upload-form"
import {
    BulkSoilAnalysisReview,
    type ProcessedAnalysis,
} from "~/components/blocks/soil/bulk-upload-review"
import { extractBulkSoilAnalyses } from "~/integrations/nmi"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarmCreate } from "~/components/blocks/header/create-farm"
import { SidebarInset } from "~/components/ui/sidebar"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { Spinner } from "~/components/ui/spinner"
import { redirectWithSuccess, dataWithSuccess } from "remix-toast"
import { matchAnalysesToFields } from "~/components/blocks/soil/bulk-upload-match"

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) throw data("Farm ID is required", { status: 400 })

        const session = await getSession(request)
        const farm = await getFarm(fdm, session.principal_id, b_id_farm)

        const calendar = getCalendar(params)
        const timeframe = getTimeframe(params)
        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )

        // Get soil parameter descriptions
        const soilParameterDescription = getSoilParametersDescription()

        return {
            b_id_farm,
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
    const { b_name_farm, fields, soilParameterDescription } =
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
            <Header action={undefined}>
                <HeaderFarmCreate b_name_farm={b_name_farm} />
            </Header>
            <main>
                <div className="space-y-6 p-10 pb-16">
                    <div className="space-y-0.5">
                        <h2 className="text-2xl font-bold tracking-tight">
                            Upload bodemanalyses
                        </h2>
                        <p className="text-muted-foreground">
                            {step === "upload"
                                ? "Upload meerdere bodemanalyses tegelijkertijd en koppel ze aan je percelen."
                                : "Controleer de resultaten en bevestig de koppelingen."}
                        </p>
                    </div>
                    <div className="pt-6">
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
            const analysesData = JSON.parse(
                formData.get("analysesData") as string,
            )

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

            return redirectWithSuccess(
                `/farm/create/${b_id_farm}/${calendar}/fields`,
                {
                    message: "Bodemanalyses succesvol opgeslagen",
                },
            )
        }

        return data({ message: "Invalid request" }, { status: 400 })
    } catch (error) {
        return handleActionError(error)
    }
}
