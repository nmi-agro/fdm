import {
    type CultivationCatalogue,
    checkPermission,
    getCultivations,
    getCultivationsFromCatalogue,
    getCurrentSoilData,
    getFarms,
    getFertilizerApplications,
    getFertilizers,
    getFields,
    getHarvests,
    updateCultivation,
} from "@nmi-agro/fdm-core"
import {
    type MetaFunction,
    NavLink,
    Outlet,
    redirect,
    useLoaderData,
} from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import {
    type CropRow,
    columns,
    type RotationExtended,
} from "~/components/blocks/rotation/columns"
import { RotationTableFormSchema } from "~/components/blocks/rotation/schema"
import { DataTable } from "~/components/blocks/rotation/table"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { cn } from "~/lib/utils"
import type { Route } from "./+types/farm.$b_id_farm.$calendar.rotation"

export const meta: MetaFunction = () => {
    return [
        { title: `Perceel | ${clientConfig.name}` },
        {
            name: "description",
            content:
                "Beheer al uw percelen op één plek. Bekijk een overzicht van alle percelen binnen uw bedrijf met hun belangrijkste kenmerken.",
        },
    ]
}

/**
 * Retrieves and processes farm and field options for the specified farm ID based on the current user session.
 *
 * This loader function extracts the active farm ID from the route parameters and uses the user's session to:
 * - Fetch all farms associated with the user, redirecting to the farms overview if none exist.
 * - Validate and map the farms into selectable options.
 * - Retrieve and validate the fields for the active farm, rounding each field's area and sorting the fields alphabetically.
 *
 * @throws {Response} When the required farm ID is missing from the route parameters.
 * @throws {Error} When a farm or field lacks the necessary data structure.
 *
 * @returns An object containing:
 * - b_id_farm: The active farm ID.
 * - farmOptions: An array of validated farm options.
 * - fieldOptions: A sorted array of processed field options.
 * - userName: The name of the current user.
 * - farmWritePermission: A Boolean indicating if the user is able to add things to the farm. Set to true if the information could not be obtained.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
    try {
        // Get the active farm
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw new Response("Not Found", {
                status: 404,
                statusText: "Not Found",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get calendar and timeframe from calendar store
        const calendar = getCalendar(params)
        const timeframe = getTimeframe(params)

        // Get a list of possible farms of the user
        const farms = await getFarms(fdm, session.principal_id)

        // Redirect to farms overview if user has no farm
        if (farms.length === 0) {
            return redirect("./farm")
        }

        // Get farms to be selected
        const farmOptions = farms.map((farm) => {
            if (!farm?.b_id_farm || !farm?.b_name_farm) {
                throw new Error("Invalid farm data structure")
            }
            return {
                b_id_farm: farm.b_id_farm,
                b_name_farm: farm.b_name_farm,
            }
        })

        // Get the fields to be selected
        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )
        const fieldOptions = fields.map((field) => {
            if (!field?.b_id || !field?.b_name) {
                throw new Error("Invalid field data structure")
            }
            return {
                b_id: field.b_id,
                b_name: field.b_name,
                b_area: Math.round((field.b_area ?? 0) * 10) / 10,
            }
        })

        const fertilizers = await getFertilizers(
            fdm,
            session.principal_id,
            b_id_farm,
        )

        const cultivationCatalogue = await getCultivationsFromCatalogue(
            fdm,
            session.principal_id,
            b_id_farm,
        )

        function getHarvestabilityFromCatalogue(b_lu_catalogue: string) {
            return (
                cultivationCatalogue.find(
                    (item: { b_lu_catalogue: string }) =>
                        item.b_lu_catalogue === b_lu_catalogue,
                )?.b_lu_harvestable ?? "once"
            )
        }

        const fieldsExtended = await Promise.all(
            fields.map(async (field) => {
                const cultivations = await getCultivations(
                    fdm,
                    session.principal_id,
                    field.b_id,
                    timeframe,
                )

                const harvests = (
                    await Promise.all(
                        cultivations.map(async (cultivation) => {
                            const b_lu_harvestable =
                                getHarvestabilityFromCatalogue(
                                    cultivation.b_lu_catalogue,
                                )

                            return getHarvests(
                                fdm,
                                session.principal_id,
                                cultivation.b_lu,
                                b_lu_harvestable === "once"
                                    ? undefined
                                    : timeframe,
                            )
                        }),
                    )
                ).flat()

                const fertilizerApplications = await getFertilizerApplications(
                    fdm,
                    session.principal_id,
                    field.b_id,
                    timeframe,
                )

                const fertilizerApplicationIds = new Set(
                    fertilizerApplications.map((app) => app.p_id),
                )

                const fertilizersFiltered = fertilizers.filter((fertilizer) =>
                    fertilizerApplicationIds.has(fertilizer.p_id),
                )

                const currentSoilData = await getCurrentSoilData(
                    fdm,
                    session.principal_id,
                    field.b_id,
                    timeframe,
                )
                const a_som_loi =
                    currentSoilData.find(
                        (item: { parameter: string }) =>
                            item.parameter === "a_som_loi",
                    )?.value ?? null
                const b_soiltype_agr =
                    currentSoilData.find(
                        (item: { parameter: string }) =>
                            item.parameter === "b_soiltype_agr",
                    )?.value ?? null

                return {
                    b_id: field.b_id,
                    b_name: field.b_name,
                    cultivations: cultivations,
                    harvests: harvests,
                    fertilizerApplications: fertilizerApplications,
                    fertilizers: fertilizersFiltered,
                    a_som_loi: a_som_loi,
                    b_soiltype_agr: b_soiltype_agr,
                    b_area: Math.round((field.b_area ?? 0) * 10) / 10,
                    b_bufferstrip: field.b_bufferstrip,
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

        type FieldsExtended = typeof fieldsExtended

        const collectUniqueDates = (dates: (Date | null | undefined)[]) => {
            return [
                ...new Set(
                    dates.flatMap((date) => (date ? [date.getTime()] : [])),
                ),
            ].map((timestamp) => new Date(timestamp))
        }

        const transformFieldsToRotationExtended = (
            fieldsExtended: FieldsExtended, // TODO: Define a proper type for fieldsExtended
            _cultivationCatalogue: CultivationCatalogue[],
        ): CropRow[] => {
            const cultivationsInRotation: string[] = [
                ...new Set(
                    fieldsExtended.flatMap(
                        (field: {
                            cultivations: { b_lu_catalogue: string }[]
                        }) => {
                            return field.cultivations.flatMap((cultivation) => {
                                return cultivation.b_lu_catalogue
                            })
                        },
                    ),
                ),
            ]

            return cultivationsInRotation.map((b_lu_catalogue) => {
                const cultivationsForCatalogue = fieldsExtended.flatMap(
                    (field) =>
                        field.cultivations.filter(
                            (cultivation: { b_lu_catalogue: string }) =>
                                cultivation.b_lu_catalogue === b_lu_catalogue,
                        ),
                )

                const fieldsWithThisCultivation = fieldsExtended.filter(
                    (field) =>
                        field.cultivations.some(
                            (cultivation: { b_lu_catalogue: string }) =>
                                cultivation.b_lu_catalogue === b_lu_catalogue,
                        ),
                )

                const b_lu = cultivationsForCatalogue.map(
                    (cultivation: { b_lu: string }) => cultivation.b_lu,
                )

                const b_lu_eom_residue =
                    cultivationsForCatalogue[0]?.b_lu_eom_residue
                const b_lu_harvestable =
                    getHarvestabilityFromCatalogue(b_lu_catalogue)
                return {
                    type: "crop",
                    canModify: farmWritePermission,
                    b_lu_catalogue: b_lu_catalogue,
                    b_lu: b_lu,
                    b_lu_name: cultivationsForCatalogue[0]?.b_lu_name ?? "",
                    b_lu_variety_options:
                        cultivationCatalogue
                            .find(
                                (item: { b_lu_catalogue: string }) =>
                                    item.b_lu_catalogue === b_lu_catalogue,
                            )
                            ?.b_lu_variety_options?.map((option: string) => ({
                                value: option,
                                label: option,
                            })) ?? null,
                    b_lu_croprotation:
                        cultivationsForCatalogue[0]?.b_lu_croprotation ?? "",
                    b_lu_eom_residue: b_lu_eom_residue,
                    b_lu_harvestable: b_lu_harvestable,
                    calendar: calendar,
                    fields: fieldsWithThisCultivation.map((field, _i) => ({
                        // TODO: Define a proper type for field
                        type: "field",
                        canModify: farmWritePermission,
                        b_id: field.b_id,
                        b_name: field.b_name,
                        b_area: field.b_area,
                        b_bufferstrip: field.b_bufferstrip,
                        a_som_loi: field.a_som_loi ?? 0,
                        b_soiltype_agr: field.b_soiltype_agr ?? "",
                        b_lu_start: collectUniqueDates(
                            field.cultivations
                                .filter(
                                    (cultivation) =>
                                        cultivation.b_lu_catalogue ===
                                            b_lu_catalogue &&
                                        cultivation.b_lu_start,
                                )
                                .map((cultivation) => cultivation.b_lu_start),
                        ),
                        b_lu_end: collectUniqueDates(
                            field.cultivations
                                .filter(
                                    (cultivation) =>
                                        cultivation.b_lu_catalogue ===
                                        b_lu_catalogue,
                                )
                                .map((cultivation) => cultivation.b_lu_end),
                        ),
                        harvests: field.harvests
                            .filter((harvest: { b_lu: string }) =>
                                b_lu.includes(harvest.b_lu),
                            )
                            .map((harvest) => {
                                return {
                                    b_lu: harvest.b_lu,
                                    b_id_harvesting: harvest.b_id_harvesting,
                                    b_lu_harvest_date:
                                        harvest.b_lu_harvest_date,
                                }
                            }),
                        b_lu_harvestable: b_lu_harvestable,
                        b_lu_variety: Object.entries(
                            field.cultivations
                                .filter(
                                    (cultivation) =>
                                        cultivation.b_lu_catalogue ===
                                        b_lu_catalogue,
                                )
                                .flatMap(
                                    (cultivation: {
                                        b_lu_variety: string | null
                                    }) =>
                                        cultivation.b_lu_variety
                                            ? [cultivation.b_lu_variety]
                                            : [],
                                )
                                .reduce(
                                    (counts, variety) => {
                                        counts[variety] =
                                            (counts[variety] ?? 0) + 1
                                        return counts
                                    },
                                    {} as Record<string, number>,
                                ),
                        ).sort((a, b) => b[1] - a[1]),
                        b_lu_catalogue: b_lu_catalogue,
                        b_lu_croprotation:
                            cultivationsForCatalogue[0]?.b_lu_croprotation ??
                            "",
                        m_cropresidue: (() => {
                            const cultivations = field.cultivations.filter(
                                (cultivation) =>
                                    cultivation.b_lu_catalogue ===
                                    b_lu_catalogue,
                            )

                            return cultivations.every(
                                (cultivation) => cultivation.m_cropresidue,
                            )
                                ? "all"
                                : cultivations.some(
                                        (cultivation) =>
                                            cultivation.m_cropresidue,
                                    )
                                  ? "some"
                                  : "none"
                        })(),
                        m_cropresidue_ending: field.cultivations
                            .filter(
                                (cultivation) =>
                                    cultivation.b_lu_catalogue ===
                                        b_lu_catalogue && cultivation.b_lu_end,
                            )
                            .map((cultivation) => [
                                cultivation.b_lu_end as Date,
                                cultivation.m_cropresidue ?? false,
                            ]),
                        b_lu_eom_residue: b_lu_eom_residue,
                        calendar: calendar,
                        fertilizerApplications:
                            field.fertilizerApplications.map((app) => ({
                                p_name_nl: app.p_name_nl,
                                p_id: app.p_id,
                            })),
                        fertilizers: field.fertilizers.map((app) => ({
                            p_name_nl: app.p_name_nl,
                            p_id: app.p_id,
                            p_type: app.p_type,
                        })),
                    })),
                }
            })
        }

        const rotationExtended: RotationExtended[] =
            transformFieldsToRotationExtended(
                fieldsExtended,
                cultivationCatalogue,
            )

        // Return user information from loader
        return {
            b_id_farm: b_id_farm,
            calendar: calendar,
            farmOptions: farmOptions,
            fieldOptions: fieldOptions,
            rotationExtended: rotationExtended, // Return filtered data
            userName: session.userName,
            farmWritePermission: farmWritePermission,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders a user interface for selecting or creating a field within a farm.
 *
 * This component retrieves loader data to access the available farm options, field options, and user information.
 * Depending on whether fields exist, it either displays:
 * - A welcome screen prompting the user to create a new field if no fields are present.
 * - A list of existing fields with selection controls and a time-based greeting for navigation.
 *
 * @example
 * <FarmFieldIndex />
 */
export default function FarmRotationIndex() {
    const loaderData = useLoaderData<typeof loader>()

    const currentFarmName =
        loaderData.farmOptions.find(
            (farm) => farm.b_id_farm === loaderData.b_id_farm,
        )?.b_name_farm ?? ""

    return (
        <SidebarInset>
            <Header
                action={{
                    to: `/farm/${loaderData.b_id_farm}`,
                    label: "Terug naar bedrijf",
                    disabled: false,
                }}
            >
                <HeaderFarm
                    b_id_farm={loaderData.b_id_farm}
                    farmOptions={loaderData.farmOptions}
                />

                <BreadcrumbSeparator />
                <BreadcrumbItem className="hidden md:block">
                    Bouwplan
                </BreadcrumbItem>
            </Header>
            <main className="min-w-0">
                {loaderData.fieldOptions.length === 0 ? (
                    <>
                        <FarmTitle
                            title={`Bouwplan van ${currentFarmName}`}
                            description="Dit bedrijf heeft nog geen bouwplan"
                        />
                        <div className="mx-auto flex h-full w-full items-center flex-col justify-center space-y-6 sm:w-[350px]">
                            <div className="flex flex-col space-y-2 text-center">
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    Het lijkt erop dat je nog geen bouwplan hebt
                                    :(
                                </h1>
                            </div>
                            <div className="flex flex-col items-center relative">
                                <Button
                                    asChild
                                    className={cn(
                                        !loaderData.farmWritePermission
                                            ? "invisible"
                                            : "",
                                    )}
                                >
                                    <NavLink to="../field/new">
                                        Maak een perceel
                                    </NavLink>
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <FarmTitle
                            title={`Bouwplan van ${currentFarmName}`}
                            description="Bekijk het bouwplan en voeg gegevens toe."
                        />
                        <FarmContent>
                            <div className="flex flex-col space-y-8 pb-10 lg:flex-row lg:space-x-12 lg:space-y-0">
                                <DataTable
                                    columns={columns}
                                    data={loaderData.rotationExtended}
                                    canAddItem={loaderData.farmWritePermission}
                                />
                            </div>
                        </FarmContent>
                    </>
                )}
            </main>
            <Outlet />
        </SidebarInset>
    )
}

export async function action({ params, request }: Route.ActionArgs) {
    try {
        const session = await getSession(request)
        const timeframe = getTimeframe(params)
        const b_id_farm = params.b_id_farm

        const searchParams = new URL(request.url).searchParams

        const fieldIdsParam = searchParams.get("fieldIds") ?? ""
        const cultivationIdsParam = searchParams.get("cultivationIds") ?? ""

        if (!fieldIdsParam?.length) {
            return dataWithError(null, { message: "fieldIds is verplicht." })
        }

        if (!cultivationIdsParam?.length) {
            return dataWithError(null, {
                message: "cultivationIds is verplicht.",
            })
        }

        const fieldIds = new Set(fieldIdsParam.split(","))
        const cultivationIds = new Set(cultivationIdsParam.split(","))

        // Determine what needs to be done
        const cultivationUpdates = await extractFormValuesFromRequest(
            request,
            RotationTableFormSchema,
        )

        if (
            Object.keys(cultivationUpdates).length > 0 &&
            Object.values(cultivationUpdates).some(
                (val) => typeof val !== "undefined",
            )
        ) {
            // Perform the cultivation updates
            const fields = (
                await getFields(fdm, session.principal_id, b_id_farm, timeframe)
            ).filter((field) => fieldIds.has(field.b_id))
            await Promise.all(
                fields.map(async (field) => {
                    const cultivations = (
                        await getCultivations(
                            fdm,
                            session.principal_id,
                            field.b_id,
                            timeframe,
                        )
                    ).filter((cultivation) =>
                        cultivationIds.has(cultivation.b_lu_catalogue),
                    )

                    return Promise.all(
                        cultivations.map((cultivation) => {
                            return updateCultivation(
                                fdm,
                                session.principal_id,
                                cultivation.b_lu,
                                undefined,
                                cultivationUpdates.b_lu_start,
                                cultivationUpdates.b_lu_end,
                                cultivationUpdates.m_cropresidue,
                                cultivationUpdates.b_lu_variety,
                            )
                        }),
                    )
                }),
            )
        }

        return dataWithSuccess(null, {
            message: "Succesvol bijgewerkt.",
        })
    } catch (e) {
        throw handleActionError(e)
    }
}
