import {
    checkPermission,
    getField,
    getVisualSoilAnalyses,
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

        const assessments = await getVisualSoilAnalyses(
            fdm,
            session.principal_id,
            b_id,
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
 * Lists all visual soil assessments for a field.
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
                    {assessments.map((assessment) => (
                        <NavLink
                            key={assessment.a_id_visual}
                            to={`./${assessment.a_id_visual}`}
                            className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors"
                        >
                            <div className="space-y-1">
                                <p className="font-medium">
                                    {assessment.date
                                        ? format(new Date(assessment.date), "d MMMM yyyy")
                                        : "Datum onbekend"}
                                </p>
                                <div className="flex gap-2 text-sm text-muted-foreground">
                                    {assessment.assessor_name && (
                                        <span>{assessment.assessor_name}</span>
                                    )}
                                    {assessment.assessment_type && (
                                        <>
                                            <span>·</span>
                                            <span className="capitalize">
                                                {assessment.assessment_type}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                {assessment.i_bcs != null ? (
                                    <>
                                        <p className="text-lg font-bold">
                                            {(assessment.i_bcs * 100).toFixed(0)}%
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
                    ))}
                </div>
            )}
        </div>
    )
}
