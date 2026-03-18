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
import { data, useLoaderData } from "react-router"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { columns, type FarmExtended } from "~/components/blocks/farms/columns"
import { DataTable } from "~/components/blocks/farms/table"
import { NoFarmsMessage } from "~/components/blocks/organization/no-farms-message"
import { auth } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import type { Route } from "./+types/organization.$slug.$calendar.farms._index"

// Meta
export const meta: Route.MetaFunction = () => {
    return [
        {
            title: `Bedrijven - Organisatie | ${clientConfig.name}`,
        },
        {
            name: "description",
            content:
                "Bekijk en beheer de bedrijven waartoe jouw organisatie toegang heeft.",
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
            throw data("Organisatie niet gevonden.", {
                status: 404,
                statusText: "Organisatie niet gevonden.",
            })
        }

        const farms = await getFarms(fdm, organization.id)

        const allFarms: FarmExtended[] = await Promise.all(
            farms.map(async (farm) => {
                const myOrganization = organization
                async function getOwners() {
                    const accessors = (
                        await listPrincipalsForFarm(
                            fdm,
                            myOrganization.id,
                            farm.b_id_farm,
                        )
                    ).filter((accessor) => accessor.type === "user")

                    return accessors.filter(
                        (accessor) => accessor.role === "owner",
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

                const ownersPromise = getOwners()
                const reduceFieldsPromise = reduceFields()

                return {
                    type: "farm",
                    b_id_farm: farm.b_id_farm,
                    b_name_farm: farm.b_name_farm,
                    owners: await ownersPromise,
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
            <FarmContent>
                {data.length > 0 ? (
                    <div className="flex flex-col space-y-8 pb-10 lg:flex-row lg:space-x-12 lg:space-y-0">
                        <DataTable columns={columns} data={data} />
                    </div>
                ) : (
                    <NoFarmsMessage
                        action={{
                            label: "Naar dashboard",
                            to: `/organization/${organization.slug}`,
                        }}
                    />
                )}
            </FarmContent>
        </main>
    )
}
