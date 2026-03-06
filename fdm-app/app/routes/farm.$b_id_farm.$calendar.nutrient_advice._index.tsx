import { checkPermission, getCultivations, getFields } from "@nmi-agro/fdm-core"
import { BookOpenText } from "lucide-react"
import {
    type LoaderFunctionArgs,
    type MetaFunction,
    NavLink,
    useLoaderData,
} from "react-router"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "~/components/ui/empty"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { getDefaultCultivation } from "~/lib/cultivation-helpers"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { cn } from "~/lib/utils"

// Meta
export const meta: MetaFunction = () => {
    return [
        {
            title: `Bemestingsadvies | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bekijk je Bemestingsadvies",
        },
    ]
}

/**
 * Loads the user's session and associated fields for a specified farm.
 * It also fetches the main cultivation for each field to display in the overview.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw new Error("b_id_farm is required")
        }

        // Get the session
        const session = await getSession(request)

        // Get timeframe from calendar store
        const timeframe = getTimeframe(params)
        const calendar = getCalendar(params)

        // Get the fields of the farm
        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )

        // Fetch cultivations for each field and determine the main one
        const fieldsWithCultivation = await Promise.all(
            fields.map(async (field) => {
                const cultivations = await getCultivations(
                    fdm,
                    session.principal_id,
                    field.b_id,
                    timeframe,
                )
                const mainCultivation =
                    getDefaultCultivation(cultivations, calendar) ||
                    cultivations[0]
                return {
                    ...field,
                    cultivations,
                    mainCultivation,
                }
            }),
        )

        const farmWritePermission = await checkPermission(
            fdm,
            "farm",
            "write",
            b_id_farm,
            session.principal_id,
            new URL(request.url).pathname,
            false,
        )

        return {
            fields: fieldsWithCultivation,
            b_id_farm: b_id_farm,
            calendar: calendar,
            farmWritePermission,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function FieldNutrientAdviceIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const { fields, b_id_farm, calendar } = loaderData

    if (fields.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <BookOpenText />
                    </EmptyMedia>
                    <EmptyTitle>Geen percelen gevonden</EmptyTitle>
                    <EmptyDescription>
                        Het lijkt erop dat er nog geen percelen zijn
                        geregistreerd voor dit bedrijf.
                        {loaderData.farmWritePermission
                            ? " Voeg een nieuw perceel toe om bemestingsadvies te kunnen bekijken."
                            : null}
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <div className="flex gap-2">
                        <Button
                            variant="default"
                            className={cn(
                                !loaderData.farmWritePermission ? "hidden" : "",
                            )}
                            asChild
                        >
                            <NavLink
                                to={`/farm/${b_id_farm}/${calendar}/field/new`}
                            >
                                Nieuw perceel
                            </NavLink>
                        </Button>
                        <Button variant="outline" asChild>
                            <NavLink to="../">Naar bedrijfsoverzicht</NavLink>
                        </Button>
                    </div>
                </EmptyContent>
            </Empty>
        )
    }

    return (
        <div className="px-10">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {fields.map((field) => (
                    <Card
                        key={field.b_id}
                        className="relative hover:bg-muted/50 transition-colors"
                    >
                        <CardHeader>
                            <CardTitle>
                                <NavLink
                                    to={`./${field.b_id}${field.mainCultivation ? `?cultivation=${field.mainCultivation.b_lu}` : ""}`}
                                    className="after:absolute after:inset-0"
                                >
                                    {field.b_name}
                                </NavLink>
                            </CardTitle>
                            <CardDescription>{field.b_area} ha</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-4">
                                {field.mainCultivation ? (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">
                                            Hoofdteelt
                                        </p>
                                        <Badge
                                            style={{
                                                backgroundColor:
                                                    getCultivationColor(
                                                        field.mainCultivation
                                                            .b_lu_croprotation,
                                                    ),
                                            }}
                                            className="text-white hover:opacity-90"
                                            variant="default"
                                        >
                                            {field.mainCultivation.b_lu_name}
                                        </Badge>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground text-sm italic">
                                        Geen gewas
                                    </span>
                                )}

                                {field.cultivations.length >
                                    (field.mainCultivation ? 1 : 0) && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">
                                            Overige teelten
                                        </p>
                                        <div className="flex flex-wrap gap-2 relative z-10">
                                            {field.cultivations
                                                .filter(
                                                    (c) =>
                                                        c.b_lu !==
                                                        field.mainCultivation
                                                            ?.b_lu,
                                                )
                                                .map((c) => (
                                                    <NavLink
                                                        key={c.b_lu}
                                                        to={`./${field.b_id}?cultivation=${c.b_lu}`}
                                                    >
                                                        <Badge
                                                            style={{
                                                                backgroundColor:
                                                                    getCultivationColor(
                                                                        c.b_lu_croprotation,
                                                                    ),
                                                            }}
                                                            className="text-white hover:opacity-90"
                                                            variant="default"
                                                        >
                                                            {c.b_lu_name}
                                                        </Badge>
                                                    </NavLink>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
