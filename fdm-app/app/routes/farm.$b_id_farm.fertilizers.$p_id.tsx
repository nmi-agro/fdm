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
            content: "Bekij de details van deze meststof",
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
    const { fertilizer, fertilizerParameters, editable } = loaderData

    const form = useRemixForm<z.infer<typeof FormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(FormSchema),
        defaultValues: {
            p_name_nl: fertilizer.p_name_nl,
            p_type_rvo: fertilizer.p_type_rvo,
            p_dm: fertilizer.p_dm,
            p_density: fertilizer.p_density,
            p_om: fertilizer.p_om,
            p_a: fertilizer.p_a,
            p_hc: fertilizer.p_hc,
            p_eom: fertilizer.p_eom,
            p_eoc: fertilizer.p_eoc,
            p_c_rt: fertilizer.p_c_rt,
            p_c_of: fertilizer.p_c_of,
            p_c_if: fertilizer.p_c_if,
            p_c_fr: fertilizer.p_c_fr,
            p_cn_of: fertilizer.p_cn_of,
            p_n_rt: fertilizer.p_n_rt,
            p_n_if: fertilizer.p_n_if,
            p_n_of: fertilizer.p_n_of,
            p_n_wc: fertilizer.p_n_wc,
            p_no3_rt: fertilizer.p_no3_rt,
            p_nh4_rt: fertilizer.p_nh4_rt,
            p_p_rt: fertilizer.p_p_rt,
            p_k_rt: fertilizer.p_k_rt,
            p_mg_rt: fertilizer.p_mg_rt,
            p_ca_rt: fertilizer.p_ca_rt,
            p_ne: fertilizer.p_ne,
            p_s_rt: fertilizer.p_s_rt,
            p_s_wc: fertilizer.p_s_wc,
            p_cu_rt: fertilizer.p_cu_rt,
            p_zn_rt: fertilizer.p_zn_rt,
            p_na_rt: fertilizer.p_na_rt,
            p_si_rt: fertilizer.p_si_rt,
            p_b_rt: fertilizer.p_b_rt,
            p_mn_rt: fertilizer.p_mn_rt,
            p_ni_rt: fertilizer.p_ni_rt,
            p_fe_rt: fertilizer.p_fe_rt,
            p_mo_rt: fertilizer.p_mo_rt,
            p_co_rt: fertilizer.p_co_rt,
            p_as_rt: fertilizer.p_as_rt,
            p_cd_rt: fertilizer.p_cd_rt,
            p_cr_rt: fertilizer.p_cr_rt,
            p_cr_vi: fertilizer.p_cr_vi,
            p_pb_rt: fertilizer.p_pb_rt,
            p_hg_rt: fertilizer.p_hg_rt,
            p_cl_rt: fertilizer.p_cl_rt,
            p_app_method_options: fertilizer.p_app_method_options || [],
        },
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
                    title={loaderData.fertilizer.p_name_nl}
                    description={"Bekijk de eigenschappen van dit product"}
                />
                <div className="space-y-6 p-10 pb-0">
                    <FertilizerForm
                        fertilizerParameters={fertilizerParameters}
                        form={form}
                        editable={editable}
                    />
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
