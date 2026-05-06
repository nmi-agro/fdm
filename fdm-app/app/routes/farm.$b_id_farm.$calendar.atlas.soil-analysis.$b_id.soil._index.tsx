import {
    getCurrentSoilData,
    getField,
    getSoilAnalyses,
    getSoilParametersDescription,
} from "@nmi-agro/fdm-core"
import {
    data,
    type LoaderFunctionArgs,
    NavLink,
    useFetcher,
    useLoaderData,
} from "react-router"
import { SoilDataCards } from "~/components/blocks/soil/cards"
import { SoilAnalysesList } from "~/components/blocks/soil/list"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

/**
 * Loader function for the soil data page of a specific farm field.
 *
 * This function fetches the necessary data for rendering the soil data page, including
 * field details, soil analyses, current soil data, and soil parameter descriptions.
 * It validates the presence of the farm ID (`b_id_farm`) and field ID (`b_id`) in the
 * route parameters and retrieves the user session.
 *
 * @param request - The HTTP request object.
 * @param params - The route parameters, including `b_id_farm` and `b_id`.
 * @returns An object containing the field details, current soil data, soil parameter descriptions, and soil analyses.
 *
 * @throws {Response} If the farm ID is missing (HTTP 400).
 * @throws {Error} If the field ID is missing (HTTP 400).
 * @throws {Error} If the field is not found (HTTP 404).
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the farm id
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", {
                status: 400,
                statusText: "Farm ID is required",
            })
        }

        // Get the field id
        const b_id = params.b_id
        if (!b_id) {
            throw data("Field ID is required", {
                status: 400,
                statusText: "Field ID is required",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get timeframe from calendar store
        const timeframe = getTimeframe(params)

        // Get details of field
        const field = await getField(fdm, session.principal_id, b_id)
        if (!field) {
            throw data("Field is not found", {
                status: 404,
                statusText: "Field is not found",
            })
        }

        // Get the soil analyses
        const soilAnalyses = await getSoilAnalyses(
            fdm,
            session.principal_id,
            b_id,
            {
                start: null,
                end: timeframe.end,
            },
        )

        // Get current soil data
        const currentSoilData = await getCurrentSoilData(
            fdm,
            session.principal_id,
            b_id,
            timeframe,
        )

        // Get soil parameter descriptions
        const soilParameterDescription = getSoilParametersDescription()

        // Return user information from loader
        return {
            field: field,
            currentSoilData: currentSoilData,
            soilParameterDescription: soilParameterDescription,
            soilAnalyses: soilAnalyses,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Component that renders the soil data overview for a farm field..
 *
 * This component displays the soil data section, including a title, description, and
 * a list of soil data cards. It also handles the case where no soil analyses are available.
 *
 */
export default function FarmFieldSoilOverviewBlock() {
    const loaderData = useLoaderData<typeof loader>()
    const fetcher = useFetcher()

    return (
        <Tabs defaultValue="parameters" className="p-6">
            <div className="space-y-4">
                <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                    <div className="space-y-0.5 min-w-0 flex-1">
                        <h2 className="text-2xl font-bold tracking-tight truncate xl:whitespace-normal">
                            Bodem - {loaderData.field.b_name}
                        </h2>
                        <p className="text-muted-foreground wrap-break-word">
                            In de gegevens hieronder vind je de meest recente
                            waarde gemeten voor elke bodemparameter
                        </p>
                    </div>{" "}
                    <div className="ml-auto">
                        <Button asChild>
                            <NavLink to={"../soil-analysis"}>
                                Terug naar kaart
                            </NavLink>
                        </Button>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="parameters">Parameters</TabsTrigger>
                        <TabsTrigger value="analyses">Analyses</TabsTrigger>
                    </TabsList>
                </div>
            </div>
            <Separator className="mt-4 mb-6" />
            <TabsContent value="parameters">
                {loaderData.soilAnalyses.length === 0 ? (
                    <div className="mx-auto flex h-full w-full items-center flex-col justify-center space-y-6 sm:w-[350px]">
                        <div className="flex flex-col space-y-2 text-center">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Dit perceel heeft nog geen bodemanalyse
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Voeg een analyse toe om gegevens over de bodem
                                bij te houden
                            </p>
                        </div>
                    </div>
                ) : (
                    <SoilDataCards
                        currentSoilData={loaderData.currentSoilData}
                        soilParameterDescription={
                            loaderData.soilParameterDescription
                        }
                    />
                )}
            </TabsContent>
            <TabsContent value="analyses">
                <SoilAnalysesList
                    soilAnalyses={loaderData.soilAnalyses}
                    soilParameterDescription={
                        loaderData.soilParameterDescription
                    }
                    fetcher={fetcher}
                />
            </TabsContent>
        </Tabs>
    )
}
