import {
    checkPermission,
    getFarm,
    getFarms,
    getFertilizerParametersDescription,
    getFertilizers,
} from "@nmi-agro/fdm-core"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import {
    columns,
    type Fertilizer,
} from "~/components/blocks/fertilizer/columns"
import { DataTable } from "~/components/blocks/fertilizer/table"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { HeaderFertilizer } from "~/components/blocks/header/fertilizer"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import type { Route } from "./+types/farm.$b_id_farm.fertilizers._index"

export const meta: MetaFunction = () => {
    return [
        { title: `Meststoffen | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekij de lijst van meststoffen beschikbaar.",
        },
    ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the farm id
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("invalid: b_id_farm", {
                status: 400,
                statusText: "invalid: b_id_farm",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get details of farm
        const farm = await getFarm(fdm, session.principal_id, b_id_farm)
        if (!farm) {
            throw data("not found: b_id_farm", {
                status: 404,
                statusText: "not found: b_id_farm",
            })
        }

        // Get a list of possible farms of the user
        const farms = await getFarms(fdm, session.principal_id)
        if (!farms || farms.length === 0) {
            throw data("not found: farms", {
                status: 404,
                statusText: "not found: farms",
            })
        }

        const farmOptions = farms.map((farm) => {
            return {
                b_id_farm: farm.b_id_farm,
                b_name_farm: farm.b_name_farm,
            }
        })

        // Get the options for p_type_rvo
        const fertilizerParameterDescription =
            await getFertilizerParametersDescription("NL-nl")
        const p_type_rvo_options =
            fertilizerParameterDescription.find(
                (x: { parameter: string }) => x.parameter === "p_type_rvo",
            )?.options ?? []
        const rvoLabelByValue = new Map(
            p_type_rvo_options.map((opt: { value: string; label: string }) => [
                String(opt.value),
                opt.label,
            ]),
        )

        // Get the available fertilizers and the label for p_type_rvo
        const fertilizers: Fertilizer[] = await getFertilizers(
            fdm,
            session.principal_id,
            b_id_farm,
        ).then((fertilizers) =>
            fertilizers.map((fertilizer) => ({
                ...fertilizer,
                p_type_rvo_label:
                    rvoLabelByValue.get(String(fertilizer.p_type_rvo)) ?? null,
            })),
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

        // Return user information from loader
        return {
            farm: farm,
            b_id_farm: b_id_farm,
            farmOptions: farmOptions,
            fertilizers: fertilizers,
            farmWritePermission: farmWritePermission,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function FarmFertilizersIndexPage({
    params,
}: Route.ComponentProps) {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarm
                    b_id_farm={loaderData.b_id_farm}
                    farmOptions={loaderData.farmOptions}
                />
                <HeaderFertilizer
                    b_id_farm={loaderData.b_id_farm}
                    p_id={undefined}
                    fertilizerOptions={loaderData.fertilizers}
                />
            </Header>
            <main>
                <FarmTitle
                    title={"Meststoffen"}
                    description={"Beheer de meststoffen van dit bedrijf"}
                />
                <div className="space-y-6 p-10 pb-0">
                    <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
                        <div className="flex-1">
                            <DataTable
                                columns={columns}
                                data={loaderData.fertilizers}
                                canAddItem={loaderData.farmWritePermission}
                            />
                        </div>
                    </div>
                </div>
            </main>
        </SidebarInset>
    )
}
