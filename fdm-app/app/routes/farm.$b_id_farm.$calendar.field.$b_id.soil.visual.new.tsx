import {
    addVisualSoilAnalysis,
    checkPermission,
    getField,
} from "@nmi-agro/fdm-core"
import { ArrowLeft } from "lucide-react"
import {
    data,
    type ActionFunctionArgs,
    type LoaderFunctionArgs,
    NavLink,
    redirect,
    useLoaderData,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { VisualAssessmentForm } from "~/components/blocks/soil-visual/visual-assessment-form"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { getSession } from "~/lib/auth.server"
import { calculateBcs } from "~/lib/bcs-calculation"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) throw data("Farm ID is required", { status: 400 })

        const b_id = params.b_id
        if (!b_id) throw data("Field ID is required", { status: 400 })

        const session = await getSession(request)

        await checkPermission(
            fdm,
            "field",
            "write",
            b_id,
            session.principal_id,
            "soil.visual.new",
        )

        const field = await getField(fdm, session.principal_id, b_id)
        if (!field) throw data("Field is not found", { status: 404 })

        return { field, b_id_farm, b_id }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) throw data("Farm ID is required", { status: 400 })

        const b_id = params.b_id
        if (!b_id) throw data("Field ID is required", { status: 400 })

        const session = await getSession(request)
        const formData = await request.formData()

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

        const a_id_visual = await addVisualSoilAnalysis(fdm, session.principal_id, {
            b_id,
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
        })

        // Persist computed scores
        await import("@nmi-agro/fdm-core").then(({ updateVisualSoilAnalysis }) =>
            updateVisualSoilAnalysis(fdm, session.principal_id, a_id_visual, {
                d_bcs,
                i_bcs,
            }),
        )

        return redirectWithSuccess(
            `/farm/${b_id_farm}/${params.calendar}/field/${b_id}/soil/visual/${a_id_visual}`,
            "Visuele beoordeling opgeslagen",
        )
    } catch (error) {
        throw handleActionError(error)
    }
}

/**
 * Page for creating a new BCS visual soil assessment.
 */
export default function NewVisualSoilAnalysis() {
    const { field, b_id_farm, b_id } = useLoaderData<typeof loader>()

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <NavLink to="..">
                        <ArrowLeft className="h-4 w-4" />
                    </NavLink>
                </Button>
                <div>
                    <h3 className="text-lg font-medium">
                        Nieuwe visuele beoordeling
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {field.b_name}
                    </p>
                </div>
            </div>

            <Separator />

            <VisualAssessmentForm
                b_id={b_id}
                action=""
                editable
            />
        </div>
    )
}
