import {
    addSoilAnalysis,
    checkPermission,
    getField,
    getSoilAnalysis,
    updateSoilAnalysis,
} from "@nmi-agro/fdm-core"
import { ArrowLeft } from "lucide-react"
import {
    data,
    type ActionFunctionArgs,
    type LoaderFunctionArgs,
    NavLink,
    useLoaderData,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { BcsWizard } from "~/components/blocks/soil-visual/bcs-wizard"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { getSession } from "~/lib/auth.server"
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
            "bcs.new",
        )

        const field = await getField(fdm, session.principal_id, b_id)
        if (!field) throw data("Field is not found", { status: 404 })

        return { field, b_id_farm, b_id, calendar: params.calendar ?? "" }
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
        const intent = formData.get("intent")?.toString()

        if (intent === "create-draft") {
            const a_id = await addSoilAnalysis(
                fdm,
                session.principal_id,
                new Date(),
                "other",
                b_id,
                30,
                new Date(),
                {},
            )
            const analysis = await getSoilAnalysis(fdm, session.principal_id, a_id)
            return data({ a_id, b_id_sampling: analysis?.b_id_sampling ?? null })
        }

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

        const a_date = parseOptionalDate("a_date")
        const a_depth_lower = Number(formData.get("a_depth_lower")) || 30
        const existingAnalysisId = formData.get("a_id")?.toString()

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

        const a_id = existingAnalysisId
            ? existingAnalysisId
            : await addSoilAnalysis(
                  fdm,
                  session.principal_id,
                  a_date ?? new Date(),
                  "other",
                  b_id,
                  a_depth_lower,
                  a_date ?? new Date(),
                  scores,
              )

        if (existingAnalysisId) {
            await updateSoilAnalysis(fdm, session.principal_id, existingAnalysisId, {
                a_date,
                ...scores,
            })
        }

        return redirectWithSuccess(
            `/farm/${b_id_farm}/${params.calendar}/field/${b_id}/bcs/${a_id}`,
            existingAnalysisId
                ? "Visuele beoordeling opgeslagen"
                : "Visuele beoordeling opgeslagen",
        )
    } catch (error) {
        throw handleActionError(error)
    }
}

/**
 * Page for creating a new BCS visual soil assessment.
 */
export default function NewVisualSoilAnalysis() {
    const { field, b_id_farm, b_id, calendar } = useLoaderData<typeof loader>()

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

            <BcsWizard
                b_id={b_id}
                b_id_farm={b_id_farm}
                calendar={calendar}
                action=""
            />
        </div>
    )
}
