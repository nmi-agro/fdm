import {
    checkPermission,
    getField,
    getSoilAnalyses,
} from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { Plus } from "lucide-react"
import {
    data,
    type LoaderFunctionArgs,
    NavLink,
    useLoaderData,
} from "react-router"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { getSession } from "~/lib/auth.server"
import { calculateBcs } from "~/lib/bcs-calculation"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { cn } from "~/lib/utils"

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", { status: 400 })
        }

        const b_id = params.b_id
        if (!b_id) {
            throw data("Field ID is required", { status: 400 })
        }

        const session = await getSession(request)
        const pathname = new URL(request.url).pathname

        const field = await getField(fdm, session.principal_id, b_id)
        if (!field) {
            throw data("Field is not found", { status: 404 })
        }

        const analyses = await getSoilAnalyses(
            fdm,
            session.principal_id,
            b_id,
        )

        // Only keep analyses that have at least one BCS score set
        const assessments = analyses.filter((a) =>
            a.a_ss_bcs != null ||
            a.a_sc_bcs != null ||
            a.a_rd_bcs != null ||
            a.a_ew_bcs != null ||
            a.a_cc_bcs != null ||
            a.a_gs_bcs != null ||
            a.a_p_bcs != null ||
            a.a_c_bcs != null ||
            a.a_rt_bcs != null,
        )

        const fieldWritePermission = await checkPermission(
            fdm,
            "field",
            "write",
            b_id,
            session.principal_id,
            pathname,
            false,
        )

        return {
            field,
            assessments,
            fieldWritePermission,
            b_id_farm,
            b_id,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Lists all visual soil assessments (soil analyses with BCS scores) for a field.
 */
export default function VisualSoilAnalysisIndex() {
    const { assessments, fieldWritePermission, b_id_farm, b_id } =
        useLoaderData<typeof loader>()

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Visuele bodembeoordelingen</h3>
                    <p className="text-sm text-muted-foreground">
                        BCS-beoordelingen uitgevoerd in het veld
                    </p>
                </div>
                <Button
                    asChild
                    className={cn(!fieldWritePermission ? "invisible" : "")}
                >
                    <NavLink to="./new">
                        <Plus />
                        Nieuwe beoordeling
                    </NavLink>
                </Button>
            </div>

            <Separator />

            {assessments.length === 0 ? (
                <div className="mx-auto flex h-full w-full items-center flex-col justify-center space-y-6 sm:w-[350px] py-12">
                    <div className="flex flex-col space-y-2 text-center">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Nog geen visuele beoordelingen
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Voer een BCS-beoordeling uit om de bodemkwaliteit visueel te
                            beoordelen
                        </p>
                    </div>
                    <Button
                        asChild
                        className={cn(!fieldWritePermission ? "invisible" : "")}
                    >
                        <NavLink to="./new">Eerste beoordeling toevoegen</NavLink>
                    </Button>
                </div>
            ) : (
                <div className="space-y-2">
                    {assessments.map((assessment) => {
                        const { i_bcs } = calculateBcs(assessment)
                        return (
                            <NavLink
                                key={assessment.a_id}
                                to={`./${assessment.a_id}`}
                                className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors"
                            >
                                <div className="space-y-1">
                                    <p className="font-medium">
                                        {assessment.a_date
                                            ? format(new Date(assessment.a_date), "d MMMM yyyy")
                                            : "Datum onbekend"}
                                    </p>
                                    {assessment.a_assessor_id && (
                                        <p className="text-sm text-muted-foreground">
                                            {assessment.a_assessor_id}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right">
                                    {i_bcs != null ? (
                                        <>
                                            <p className="text-lg font-bold">
                                                {(i_bcs * 100).toFixed(0)}%
                                            </p>
                                            <p className="text-xs text-muted-foreground">I_BCS</p>
                                        </>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            Niet gescoord
                                        </p>
                                    )}
                                </div>
                            </NavLink>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
