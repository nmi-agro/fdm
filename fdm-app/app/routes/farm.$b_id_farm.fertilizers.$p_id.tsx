import { zodResolver } from "@hookform/resolvers/zod"
import {
    checkPermission,
    getFarm,
    getFarms,
    getFertilizer,
    getFertilizerParametersDescription,
    getFertilizers,
    updateFertilizerFromCatalogue,
} from "@nmi-agro/fdm-core"
import { useEffect } from "react"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { useRemixForm } from "remix-hook-form"
import { dataWithSuccess } from "remix-toast"
import type { z } from "zod"
import { FertilizerForm } from "@/app/components/blocks/fertilizer/form"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { FormSchema } from "~/components/blocks/fertilizer/formschema"
import {
    buildFertilizerDefaults,
    getRvoMappings,
} from "~/components/blocks/fertilizer/utils"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { HeaderFertilizer } from "~/components/blocks/header/fertilizer"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"

export const meta: MetaFunction = () => {
    return [
        { title: `Meststof | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekijk de details van deze meststof",
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

        // Get the fertilizer id
        const p_id = params.p_id
        if (!p_id) {
            throw data("invalid: p_id", {
                status: 400,
                statusText: "invalid: p_id",
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

        // Get selected fertilizer
        const fertilizer = await getFertilizer(fdm, p_id)
        const fertilizerParameters = getFertilizerParametersDescription()

        // Get the available fertilizers
        const fertilizers = await getFertilizers(
            fdm,
            session.principal_id,
            b_id_farm,
        )
        const fertilizerOptions = fertilizers.map((fertilizer) => {
            return {
                p_id: fertilizer.p_id,
                p_name_nl: fertilizer.p_name_nl || "",
            }
        })

        const { rvoLabels, rvoToType } = await getRvoMappings(fertilizers)

        // Set editable status
        let editable = false
        if (fertilizer.p_source === b_id_farm) {
            editable = true
        }
        if (
            editable &&
            !(await checkPermission(
                fdm,
                "farm",
                "write",
                b_id_farm,
                session.principal_id,
                new URL(request.url).pathname,
                false,
            ))
        ) {
            editable = false
        }

        // Return user information from loader
        return {
            farm: farm,
            p_id: p_id,
            b_id_farm: b_id_farm,
            farmOptions: farmOptions,
            fertilizerOptions: fertilizerOptions,
            fertilizer: fertilizer,
            editable: editable,
            fertilizerParameters: fertilizerParameters,
            rvoLabels,
            rvoToType,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the form to edit an existing fertilizer.
 *
 * This component displays the fertilizer header and a form to edit the properties of the fertilizer.
 * The form will not be editable if the displayed fertilizer is a builtin.
 */
export default function FarmFertilizerBlock() {
    const loaderData = useLoaderData<typeof loader>()
    const { fertilizer, fertilizerParameters, editable, rvoLabels, rvoToType } =
        loaderData

    const form = useRemixForm<z.infer<typeof FormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(FormSchema),
        defaultValues: buildFertilizerDefaults(fertilizer),
    })

    return (
        <SidebarInset>
            <Header
                action={{
                    to: "../fertilizers",
                    label: "Terug naar overzicht",
                    disabled: false,
                }}
            >
                <HeaderFarm
                    b_id_farm={loaderData.b_id_farm}
                    farmOptions={loaderData.farmOptions}
                />
                <HeaderFertilizer
                    b_id_farm={loaderData.b_id_farm}
                    p_id={loaderData.p_id}
                    fertilizerOptions={loaderData.fertilizerOptions}
                />
            </Header>
            <main>
                <FarmTitle
                    title={
                        loaderData.fertilizer.p_name_nl || "Naamloze meststof"
                    }
                    description={
                        editable
                            ? "Pas de gehaltes en eigenschappen van deze meststof aan."
                            : "Bekijk de gehaltes en eigenschappen van dit product uit de catalogus."
                    }
                />
                <div className="space-y-6 p-4 md:p-8 pb-0">
                    <div className="mx-auto max-w-6xl w-full">
                        <FertilizerForm
                            fertilizerParameters={fertilizerParameters}
                            form={form}
                            editable={editable}
                            p_type={fertilizer.p_type}
                            rvoLabels={rvoLabels}
                            rvoToType={rvoToType}
                        />
                    </div>
                </div>
            </main>
        </SidebarInset>
    )
}

export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        const p_id = params.p_id

        if (!b_id_farm) {
            throw new Error("missing: b_id_farm")
        }
        if (!p_id) {
            throw new Error("missing: p_id")
        }

        const session = await getSession(request)
        const formValues = await extractFormValuesFromRequest(
            request,
            FormSchema,
        )

        const fertilizer = await getFertilizer(fdm, p_id)
        if (fertilizer.p_source !== b_id_farm) {
            throw new Error("Forbidden")
        }
        const p_id_catalogue = fertilizer.p_id_catalogue

        await updateFertilizerFromCatalogue(
            fdm,
            session.principal_id,
            b_id_farm,
            p_id_catalogue,
            formValues,
        )

        return dataWithSuccess(
            { result: "Data saved successfully" },
            { message: "Meststof is bijgewerkt! 🎉" },
        )
    } catch (error) {
        throw handleActionError(error)
    }
}
