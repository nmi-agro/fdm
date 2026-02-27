import {
    type Cultivation,
    type Fertilizer,
    getCultivations,
    getFarms,
    getFertilizerApplications,
    getFertilizers,
    getFields,
    listPrincipalsForFarm,
} from "@nmi-agro/fdm-core"
import { data, NavLink, useLoaderData } from "react-router"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { columns, type FarmExtended } from "~/components/blocks/farms/columns"
import { DataTable } from "~/components/blocks/farms/table"
import { Button } from "~/components/ui/button"
import { auth } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import type { Route } from "./+types/organization.$slug.$calendar.farms"

// Meta
export const meta: Route.MetaFunction = () => {
    return [
        {
            title: `Bedrijven - Organisatie | ${clientConfig.name}`,
        },
        {
            name: "description",
            content:
                "Bekijk en beheer de bedrijven waartoe jouw organisatie toagang heeft.",
        },
    ]
}

export async function loader({ params, request }: Route.LoaderArgs) {
    try {
        const timeframe = getTimeframe(params)

        const organizations = await auth.api.listOrganizations({
            headers: request.headers,
        })
        const organization = organizations.find(
            (org) => org.slug === params.slug,
        )

        if (!organization) {
            throw data("Organisatie niet gevonden.", 404)
        }

        const farms = await getFarms(fdm, organization.id)

        const allFarms: FarmExtended[] = await Promise.all(
            farms.map(async (farm) => {
                const myOrganization = organization
                async function getOwner() {
                    const accessors = (
                        await listPrincipalsForFarm(
                            fdm,
                            myOrganization.id,
                            farm.b_id_farm,
                        )
                    ).filter((accessor) => accessor.type === "user")

                    return (
                        accessors.find(
                            (accessor) => accessor.role === "owner",
                        ) ??
                        accessors.find(
                            (accessor) => accessor.role === "advisor",
                        )
                    )
                }

                async function reduceFields() {
                    const fields = await getFields(
                        fdm,
                        myOrganization.id,
                        farm.b_id_farm,
                        timeframe,
                    )

                    // Total area
                    let b_area = 0
                    fields.forEach((field) => {
                        b_area += field.b_area ?? 0
                    })

                    const fertilizers = await getFertilizers(
                        fdm,
                        myOrganization.id,
                        farm.b_id_farm,
                    )

                    const fieldsExtended: FarmExtended[] = await Promise.all(
                        fields.map(async (field) => {
                            const cultivations = getCultivations(
                                fdm,
                                myOrganization.id,
                                field.b_id,
                                timeframe,
                            )

                            const fertilizerApplications =
                                getFertilizerApplications(
                                    fdm,
                                    myOrganization.id,
                                    field.b_id,
                                    timeframe,
                                )

                            const collectedCultivations: Record<
                                string,
                                Pick<
                                    Cultivation,
                                    | "b_lu_catalogue"
                                    | "b_lu_name"
                                    | "b_lu_croprotation"
                                >
                            > = {}

                            const collectedFertilizers: Record<
                                string,
                                Pick<
                                    Fertilizer,
                                    "p_id" | "p_name_nl" | "p_type"
                                >
                            > = {}

                            ;(await cultivations).forEach((cultivation) => {
                                collectedCultivations[
                                    cultivation.b_lu_catalogue
                                ] ??= {
                                    b_lu_catalogue: cultivation.b_lu_catalogue,
                                    b_lu_name: cultivation.b_lu_name,
                                    b_lu_croprotation:
                                        cultivation.b_lu_croprotation,
                                }
                            })

                            ;(await fertilizerApplications).forEach(
                                (fertilizerApplication) => {
                                    const fertilizer = fertilizers.find(
                                        (fertilizer) =>
                                            fertilizer.p_id ===
                                            fertilizerApplication.p_id,
                                    )

                                    if (fertilizer) {
                                        collectedFertilizers[fertilizer.p_id] =
                                            {
                                                p_id: fertilizer.p_id,
                                                p_name_nl: fertilizer.p_name_nl,
                                                p_type: fertilizer.p_type,
                                            }
                                    }
                                },
                            )

                            return {
                                type: "field",
                                b_id_farm: field.b_id,
                                b_name_farm: field.b_name,
                                owner: null,
                                b_area: field.b_area,
                                cultivations: Object.values(
                                    collectedCultivations,
                                ),
                                fertilizers:
                                    Object.values(collectedFertilizers),
                            }
                        }),
                    )

                    const collectedCultivations: Record<
                        string,
                        Pick<
                            Cultivation,
                            "b_lu_catalogue" | "b_lu_name" | "b_lu_croprotation"
                        >
                    > = {}

                    const collectedFertilizers: Record<
                        string,
                        Pick<Fertilizer, "p_id" | "p_name_nl" | "p_type">
                    > = {}

                    for (const field of fieldsExtended) {
                        field.cultivations.forEach((cultivation) => {
                            collectedCultivations[
                                cultivation.b_lu_catalogue
                            ] ??= cultivation
                        })
                        field.fertilizers.forEach((fertilizer) => {
                            collectedFertilizers[fertilizer.p_id] ??= fertilizer
                        })
                    }

                    return {
                        fields: fieldsExtended,
                        b_area: b_area,
                        cultivations: Object.values(collectedCultivations),
                        fertilizers: Object.values(collectedFertilizers),
                    }
                }

                const ownerPromise = getOwner()
                const reduceFieldsPromise = reduceFields()

                return {
                    type: "farm",
                    b_id_farm: farm.b_id_farm,
                    b_name_farm: farm.b_name_farm,
                    owner: await ownerPromise,
                    ...(await reduceFieldsPromise),
                }
            }),
        )

        return {
            data: allFarms,
            organization,
        }
    } catch (e) {
        throw handleLoaderError(e)
    }
}
export default function OrganizationFarmsPage() {
    const { data, organization } = useLoaderData<typeof loader>()
    return (
        <main>
            <FarmTitle
                title={`Bedrijven met toegang door ${organization.name}`}
                description="Klik op een bedrijfsnaam voor meer informatie."
                action={{
                    label: "Terug naar overzicht",
                    to: `/organization/${organization.slug}`,
                }}
            />
            {data.length > 0 ? (
                <FarmContent>
                    <div className="flex flex-col space-y-8 pb-10 lg:flex-row lg:space-x-12 lg:space-y-0">
                        <DataTable columns={columns} data={data} />
                    </div>
                </FarmContent>
            ) : (
                <div className="mx-auto flex h-full w-full items-center flex-col justify-center text-center space-y-6 sm:w-87.5">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Het lijkt erop dat jouw organisatie tot geen bedrijven
                        toegang heeft. :(
                    </h1>
                    <p>
                        Neem contact op met bedrijven om toegang tot hen te
                        krijgen.
                    </p>
                    <p className="flex flex-col space-y-4 items-center">
                        Wellicht heeft jouw organisatie uitnodigingen ontvangen.
                        <Button asChild>
                            <NavLink to={`/organization/${organization.slug}`}>
                                Naar dashboard
                            </NavLink>
                        </Button>
                    </p>
                </div>
            )}
        </main>
    )
}
