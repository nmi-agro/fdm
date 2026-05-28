import {
    checkPermission,
    getVisualSoilAnalysis,
    removeVisualSoilAnalysis,
    updateVisualSoilAnalysis,
    addImageAnnotation,
    removeVisualSoilImage,
} from "@nmi-agro/fdm-core"
import { ArrowLeft, Trash2 } from "lucide-react"
import {
    data,
    type ActionFunctionArgs,
    type LoaderFunctionArgs,
    NavLink,
    useFetcher,
    useLoaderData,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { VisualAssessmentForm } from "~/components/blocks/soil-visual/visual-assessment-form"
import { ImageGallery } from "~/components/blocks/soil-visual/image-gallery"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { getSession } from "~/lib/auth.server"
import { calculateBcs } from "~/lib/bcs-calculation"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { uploadVisualSoilImage } from "~/lib/image-upload.client"
import { useState } from "react"
import { cn } from "~/lib/utils"

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) throw data("Farm ID is required", { status: 400 })

        const b_id = params.b_id
        if (!b_id) throw data("Field ID is required", { status: 400 })

        const a_id_visual = params.a_id_visual
        if (!a_id_visual) throw data("Visual analysis ID is required", { status: 400 })

        const session = await getSession(request)
        const pathname = new URL(request.url).pathname

        const assessment = await getVisualSoilAnalysis(
            fdm,
            session.principal_id,
            a_id_visual,
        )
        if (!assessment) throw data("Assessment not found", { status: 404 })

        const writePermission = await checkPermission(
            fdm,
            "soil_analysis_visual",
            "write",
            a_id_visual,
            session.principal_id,
            pathname,
            false,
        )

        return { assessment, writePermission, b_id_farm, b_id, a_id_visual }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        const b_id = params.b_id
        const a_id_visual = params.a_id_visual
        if (!b_id_farm || !b_id || !a_id_visual) {
            throw data("Missing required params", { status: 400 })
        }

        const session = await getSession(request)
        const formData = await request.formData()
        const intent = formData.get("intent")?.toString()

        if (intent === "delete") {
            await removeVisualSoilAnalysis(fdm, session.principal_id, a_id_visual)
            return redirectWithSuccess(
                `/farm/${b_id_farm}/${params.calendar}/field/${b_id}/soil/visual`,
                "Beoordeling verwijderd",
            )
        }

        if (intent === "delete-image") {
            const a_id_image = formData.get("a_id_image")?.toString()
            if (!a_id_image) throw data("Image ID is required", { status: 400 })
            await removeVisualSoilImage(fdm, session.principal_id, a_id_image)
            return data({ success: true })
        }

        if (intent === "add-annotation") {
            const a_id_image = formData.get("a_id_image")?.toString()
            const type = formData.get("type")?.toString()
            const annotation_data = formData.get("data_json")?.toString()
            if (!a_id_image || !type || !annotation_data) {
                throw data("Missing annotation data", { status: 400 })
            }
            await addImageAnnotation(fdm, session.principal_id, a_id_image, {
                type: type as "pin" | "circle" | "arrow" | "freehand",
                data_json: annotation_data,
                text: formData.get("text")?.toString() || undefined,
                indicator: formData.get("indicator")?.toString() as
                    | "A_SS_BCS" | "A_SC_BCS" | "A_RD_BCS" | "A_EW_BCS"
                    | "A_CC_BCS" | "A_GS_BCS" | "A_P_BCS" | "A_C_BCS"
                    | "A_RT_BCS" | undefined,
            })
            return data({ success: true })
        }

        // Default intent: update scores + metadata
        const parseScore = (key: string) => {
            const val = formData.get(key)
            if (val === null || val === "") return null
            const n = Number(val)
            return Number.isNaN(n) ? null : n
        }

        const parseOptionalDate = (key: string) => {
            const val = formData.get(key)?.toString()
            if (!val) return undefined
            const d = new Date(val)
            return Number.isNaN(d.getTime()) ? undefined : d
        }

        const scores = {
            a_ss_bcs: parseScore("a_ss_bcs"),
            a_sc_bcs: parseScore("a_sc_bcs"),
            a_rd_bcs: parseScore("a_rd_bcs"),
            a_ew_bcs: parseScore("a_ew_bcs"),
            a_cc_bcs: parseScore("a_cc_bcs"),
            a_gs_bcs: parseScore("a_gs_bcs"),
            a_p_bcs: parseScore("a_p_bcs"),
            a_c_bcs: parseScore("a_c_bcs"),
            a_rt_bcs: parseScore("a_rt_bcs"),
        }

        const { d_bcs, i_bcs } = calculateBcs(scores)

        await updateVisualSoilAnalysis(fdm, session.principal_id, a_id_visual, {
            date: parseOptionalDate("date"),
            assessor_name: formData.get("assessor_name")?.toString() || undefined,
            assessment_type: (formData.get("assessment_type")?.toString() as
                | "kuilmeting"
                | "bedrijfsmeting"
                | undefined) || undefined,
            weather_conditions:
                formData.get("weather_conditions")?.toString() || undefined,
            notes: formData.get("notes")?.toString() || undefined,
            ...scores,
            d_bcs,
            i_bcs,
        })

        return redirectWithSuccess(
            `/farm/${b_id_farm}/${params.calendar}/field/${b_id}/soil/visual/${a_id_visual}`,
            "Beoordeling bijgewerkt",
        )
    } catch (error) {
        throw handleActionError(error)
    }
}

/**
 * Detail/edit page for a visual soil assessment.
 * Shows the assessment form, photo gallery with annotation canvas, and delete option.
 */
export default function VisualSoilAnalysisDetail() {
    const { assessment, writePermission, b_id_farm, b_id, a_id_visual } =
        useLoaderData<typeof loader>()
    const fetcher = useFetcher()
    const [uploading, setUploading] = useState(false)

    const handleUpload = async (file: File) => {
        setUploading(true)
        try {
            await uploadVisualSoilImage(file, b_id_farm, a_id_visual)
            // Revalidate to show new image
            fetcher.load("")
        } catch (err) {
            console.error("Upload failed", err)
        } finally {
            setUploading(false)
        }
    }

    const handleImageDelete = async (a_id_image: string) => {
        const fd = new FormData()
        fd.append("intent", "delete-image")
        fd.append("a_id_image", a_id_image)
        fetcher.submit(fd, { method: "post" })
    }

    const handleAnnotationAdd = async (
        a_id_image: string,
        annotation: { type: string; data_json: string; text?: string; indicator?: string },
    ) => {
        const fd = new FormData()
        fd.append("intent", "add-annotation")
        fd.append("a_id_image", a_id_image)
        fd.append("type", annotation.type)
        fd.append("data_json", annotation.data_json)
        if (annotation.text) fd.append("text", annotation.text)
        if (annotation.indicator) fd.append("indicator", annotation.indicator)
        fetcher.submit(fd, { method: "post" })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <NavLink to="..">
                            <ArrowLeft className="h-4 w-4" />
                        </NavLink>
                    </Button>
                    <div>
                        <h3 className="text-lg font-medium">Visuele beoordeling</h3>
                        {assessment.assessor_name && (
                            <p className="text-sm text-muted-foreground">
                                {assessment.assessor_name}
                            </p>
                        )}
                    </div>
                </div>

                {writePermission && (
                    <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="delete" />
                        <Button
                            type="submit"
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                                if (
                                    !confirm(
                                        "Weet je zeker dat je deze beoordeling wilt verwijderen?",
                                    )
                                ) {
                                    e.preventDefault()
                                }
                            }}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Verwijderen
                        </Button>
                    </fetcher.Form>
                )}
            </div>

            <Separator />

            <Tabs defaultValue="scores">
                <TabsList>
                    <TabsTrigger value="scores">Scores</TabsTrigger>
                    <TabsTrigger value="photos">
                        Foto's
                        {assessment.images.length > 0 && (
                            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                                {assessment.images.length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="scores" className="mt-6">
                    <VisualAssessmentForm
                        assessment={assessment}
                        b_id={b_id}
                        action=""
                        editable={writePermission}
                    />
                </TabsContent>

                <TabsContent value="photos" className="mt-6">
                    <ImageGallery
                        images={assessment.images}
                        b_id_farm={b_id_farm}
                        readOnly={!writePermission}
                        uploading={uploading}
                        onUpload={writePermission ? handleUpload : undefined}
                        onDelete={writePermission ? handleImageDelete : undefined}
                        onAnnotationAdd={
                            writePermission ? handleAnnotationAdd : undefined
                        }
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}
