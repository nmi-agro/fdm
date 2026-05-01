import {
    calculateNlvSupplyBySom,
    calculateWaterSupplyBySom,
    getRegion,
    isFieldInGWGBGebied,
    isFieldInNatura2000Gebied,
    isFieldInNVGebied,
} from "@nmi-agro/fdm-calculator"
import { getCultivationCatalogue } from "@nmi-agro/fdm-data"
import type { Feature, Point } from "geojson"
import { Map as MapIcon } from "lucide-react"
import { Suspense, use } from "react"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    NavLink,
    useLoaderData,
    useLocation,
} from "react-router"
import { CarbonSequestrationCard } from "~/components/blocks/atlas-fields/carbon-sequestration"
import type { AdvancedCultivationHistory } from "~/components/blocks/atlas-fields/cultivation-history-advanced"
import { CultivationHistoryToggle } from "~/components/blocks/atlas-fields/cultivation-history-toggle"
import { FieldDetailsCard } from "~/components/blocks/atlas-fields/field-details"
import { GroundwaterCard } from "~/components/blocks/atlas-fields/groundwater"
import { FieldDetailsAtlasLayout } from "~/components/blocks/atlas-fields/layout"
import { getFieldByCentroid } from "~/components/blocks/atlas-fields/query"
import { FieldDetailsAtlasSkeleton } from "~/components/blocks/atlas-fields/skeleton"
import { SoilTextureCard } from "~/components/blocks/atlas-fields/soil-texture"
import { ErrorBlock } from "~/components/custom/error"
import { Button } from "~/components/ui/button"
import {
    getNmiApiKey,
    getSoilParameterEstimates,
} from "~/integrations/nmi.server"
import { getCalendar } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Perceel | Atlas | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekijk de details van dit perceel",
        },
    ]
}

export async function loader({ params }: LoaderFunctionArgs) {
    // Validate params before try/catch so data() throws reach React Router directly
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
        throw data("Farm ID is required", {
            status: 400,
            statusText: "Farm ID is required",
        })
    }

    const centroid = params.centroid
    if (!centroid) {
        throw data("Centroid is required", {
            status: 400,
            statusText: "Centroid is required",
        })
    }
    const [longitude, latitude] = centroid.split(",").map(Number)
    if (Number.isNaN(longitude) || Number.isNaN(latitude)) {
        throw data("Invalid centroid format", {
            status: 400,
            statusText: "Centroid must be in format: longitude,latitude",
        })
    }

    try {
        // Get timeframe from calendar store
        const calendar = getCalendar(params)

        return {
            b_id_farm,
            calendar,
            centroid,
            asyncData: loadAsyncData(calendar, latitude, longitude),
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

function buildAdvancedCultivationHistory(
    rawAdvanced:
        | {
              year: number
              fields: {
                  b_lu_brp: number
                  b_area: number
                  b_area_overlap: number
              }[]
          }[]
        | undefined,
    catalogueMap: Map<
        string,
        { b_lu_name: string; b_lu_croprotation?: string }
    >,
    officialAreaHa: number,
    calendarYear: number,
): AdvancedCultivationHistory | null {
    if (!rawAdvanced || rawAdvanced.length === 0) return null

    const sortedYears = [...rawAdvanced].sort((a, b) => b.year - a.year)

    // Find the overlap sum for the year specified in the calendar.
    // This ensures that the scale factor is relative to the year the user actually selected.
    const selectedYearEntry =
        rawAdvanced.find((y) => y.year === calendarYear) || sortedYears[0]

    const selectedYearOverlapAreaHa = selectedYearEntry.fields.reduce(
        (sum, f) => sum + f.b_area_overlap,
        0,
    )
    if (selectedYearOverlapAreaHa <= 0) return null

    const scaleFactor =
        officialAreaHa > 0 ? officialAreaHa / selectedYearOverlapAreaHa : 1

    const enrichedHistory = sortedYears.map((yearEntry) => {
        const fields = yearEntry.fields.map((field) => {
            const b_lu_catalogue = `nl_${field.b_lu_brp}`
            const catalogueItem = catalogueMap.get(b_lu_catalogue)
            const scaledOverlap = field.b_area_overlap * scaleFactor
            return {
                b_lu_brp: field.b_lu_brp,
                b_lu_catalogue,
                b_lu_name: catalogueItem?.b_lu_name ?? "Onbekend gewas",
                b_lu_croprotation: catalogueItem?.b_lu_croprotation ?? "other",
                b_area: field.b_area,
                b_area_overlap: scaledOverlap,
                overlap_pct_of_selected:
                    field.b_area_overlap / selectedYearOverlapAreaHa,
                overlap_pct_of_historical:
                    field.b_area > 0 ? field.b_area_overlap / field.b_area : 0,
            }
        })
        const total_overlap_pct = fields.reduce(
            (sum, f) => sum + f.overlap_pct_of_selected,
            0,
        )
        return { year: yearEntry.year, fields, total_overlap_pct }
    })

    const history = enrichedHistory.map((yearEntry) => {
        const total_area_ha = yearEntry.fields.reduce(
            (sum, f) => sum + f.b_area_overlap,
            0,
        )
        return { ...yearEntry, total_area_ha }
    })

    return { selected_field_area_ha: officialAreaHa, history }
}

async function loadAsyncData(
    _calendar: string,
    latitude: number,
    longitude: number,
) {
    try {
        const latestStatusYear = "2025"
        const fieldPromise = getFieldByCentroid(
            longitude,
            latitude,
            latestStatusYear,
        )
        const field = {
            type: "Feature",
            properties: {},
            geometry: {
                type: "Point",
                coordinates: [longitude, latitude],
            },
        } as Feature<Point>
        const nmiApiKey = getNmiApiKey()

        const estimatesPromise = getSoilParameterEstimates(field, nmiApiKey)
        const cultivationCataloguePromise = getCultivationCatalogue("brp")

        const fieldDetailsPromise = Promise.all([
            getRegion([longitude, latitude]),
            isFieldInNVGebied([longitude, latitude]),
            isFieldInGWGBGebied([longitude, latitude]),
            isFieldInNatura2000Gebied([longitude, latitude]),
        ])

        const [
            estimates,
            cultivationCatalogue,
            fieldDetailsData,
            queriedField,
        ] = await Promise.all([
            estimatesPromise,
            cultivationCataloguePromise,
            fieldDetailsPromise,
            fieldPromise,
        ])

        const [regionTable2, isNvGebied, isGWBGGebied, isNatura2000Area] =
            fieldDetailsData

        const cultivationCatalogueMap = new Map(
            cultivationCatalogue.map((item: { b_lu_catalogue: string }) => [
                item.b_lu_catalogue,
                item,
            ]),
        )

        const officialAreaHa = queriedField?.properties?.b_area
            ? Math.round((queriedField.properties.b_area / 10000) * 100) / 100
            : 0

        const cultivationHistory = estimates.cultivations
            .map((cultivation) => {
                const b_lu_catalogue = `nl_${cultivation.b_lu_brp}`
                const catalogueItem =
                    cultivationCatalogueMap.get(b_lu_catalogue)
                return {
                    year: cultivation.year,
                    b_lu_catalogue,
                    b_lu_name: catalogueItem?.b_lu_name ?? "Onbekend gewas",
                    b_lu_croprotation:
                        catalogueItem?.b_lu_croprotation ?? "other",
                    b_lu_rest_oravib: catalogueItem?.b_lu_rest_oravib ?? false,
                }
            })
            // Sort by descending year
            .sort((c1, c2) => c2.year - c1.year)

        const advancedCultivationHistory = buildAdvancedCultivationHistory(
            estimates.cultivations_advanced,
            cultivationCatalogueMap,
            officialAreaHa,
            Number.parseInt(latestStatusYear, 10),
        )

        return {
            cultivationHistory,
            advancedCultivationHistory,
            groundwaterEstimates: {
                b_gwl_class: estimates.b_gwl_class,
                b_gwl_ghg: estimates.b_gwl_ghg,
                b_gwl_glg: estimates.b_gwl_glg,
            },
            soilParameterEstimates: {
                a_clay_mi: Math.round(estimates.a_clay_mi),
                a_silt_mi: Math.round(estimates.a_silt_mi),
                a_sand_mi: Math.round(estimates.a_sand_mi),
            },
            carbonEstimates: {
                a_som_loi: estimates.a_som_loi,
                b_som_potential: estimates.b_som_potential,
                b_c_st03: estimates.b_c_st03,
                b_c_st03_potential: estimates.b_c_st03_potential,
                b_c_delta: estimates.b_c_delta,
                extraWaterStorage: Math.round(
                    calculateWaterSupplyBySom({
                        a_clay_mi: estimates.a_clay_mi,
                        a_silt_mi: estimates.a_silt_mi,
                        a_sand_mi: estimates.a_sand_mi,
                        a_som_loi: estimates.a_som_loi,
                        b_som_potential: estimates.b_som_potential,
                    }),
                ),
                extraNMineralization: Math.round(
                    calculateNlvSupplyBySom({
                        a_clay_mi: estimates.a_clay_mi,
                        a_cn_fr: estimates.a_cn_fr,
                        a_som_loi: estimates.a_som_loi,
                        b_som_potential: estimates.b_som_potential,
                    }),
                ),
            },
            fieldDetails: {
                b_area: officialAreaHa,
                isNvGebied,
                isGWBGGebied,
                isNatura2000Area,
                regionTable2,
            },
        }
    } catch (error) {
        return { errorMessage: String(error).replace("Error: ", "") }
    }
}

export default function FieldDetailsAtlasBlock() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <Suspense
            key={`${loaderData.calendar}#${loaderData.centroid}`}
            fallback={<FieldDetailsAtlasSkeleton />}
        >
            <FieldDetailsAtlas {...loaderData} />
        </Suspense>
    )
}

/**
 * Renders the page elements with asynchronously loaded data
 *
 * This has to be extracted into a separate component because of the `use(...)` hook.
 * React will not render the component until `asyncData` resolves, but React Router
 * handles it nicely via the `Suspense` component and server-to-client data streaming.
 * If `use(...)` was added to `FieldDetailsAtlasBlock` instead, the Suspense
 * would not render until `asyncData` resolves and the fallback would never be shown.
 */
function FieldDetailsAtlas({
    b_id_farm,
    calendar,
    asyncData,
}: Awaited<ReturnType<typeof loader>>) {
    const {
        fieldDetails,
        cultivationHistory,
        advancedCultivationHistory,
        groundwaterEstimates,
        soilParameterEstimates,
        carbonEstimates,
        errorMessage,
    } = use(asyncData)

    const location = useLocation()

    if (typeof errorMessage === "string") {
        return (
            <ErrorBlock
                page={location.pathname}
                timestamp={new Date().toISOString()}
                status={500}
                message={errorMessage}
                stacktrace={undefined}
            />
        )
    }

    return (
        <>
            <FieldDetailsAtlasLayout
                cultivationHistory={
                    <CultivationHistoryToggle
                        cultivationHistory={cultivationHistory}
                        advancedCultivationHistory={
                            advancedCultivationHistory ?? null
                        }
                    />
                }
                fieldDetails={<FieldDetailsCard fieldDetails={fieldDetails} />}
                carbon={
                    <CarbonSequestrationCard
                        carbonEstimates={carbonEstimates}
                    />
                }
                soilTexture={
                    <SoilTextureCard
                        soilParameterEstimates={soilParameterEstimates}
                    />
                }
                groundWater={
                    <GroundwaterCard
                        groundwaterEstimates={groundwaterEstimates}
                    />
                }
            />
            <div className="fixed bottom-6 right-6 z-50">
                <Button asChild size="lg" className="rounded-full shadow-lg">
                    <NavLink to={`/farm/${b_id_farm}/${calendar}/atlas/fields`}>
                        <MapIcon className="mr-2 h-4 w-4" />
                        Terug naar kaart
                    </NavLink>
                </Button>
            </div>
        </>
    )
}
