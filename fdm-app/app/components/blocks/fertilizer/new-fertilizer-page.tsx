import { zodResolver } from "@hookform/resolvers/zod"
import type { Fertilizer } from "@nmi-agro/fdm-core"
import { useEffect } from "react"
import { useRemixForm } from "remix-hook-form"
import type { z } from "zod"
import {
    FertilizerForm,
    type FertilizerParameterDescriptionItem,
} from "@/app/components/blocks/fertilizer/form"
import { FormSchema } from "~/components/blocks/fertilizer/formschema"
import { buildFertilizerDefaults } from "~/components/blocks/fertilizer/utils"

interface FarmNewFertilizerBlockLoaderData {
    fertilizer: Partial<Fertilizer> & {
        p_name_nl?: string | null
        p_type_rvo?: string | null
        p_app_method_options?: string[] | null
        p_type?: "manure" | "compost" | "mineral" | null
    }
    fertilizerParameters: FertilizerParameterDescriptionItem[]
    editable?: boolean
    rvoLabels?: Record<string, string>
    rvoToType?: Record<string, string>
    clearName?: boolean
}

/**
 * Renders the new fertilizer form.
 * Can be used for both creating from scratch and basing off an existing fertilizer.
 */
export function FarmNewFertilizerBlock({
    loaderData,
}: {
    loaderData: FarmNewFertilizerBlockLoaderData
}) {
    const {
        fertilizer,
        fertilizerParameters,
        editable = true,
        rvoLabels,
        rvoToType,
        clearName = false,
    } = loaderData

    const form = useRemixForm<z.infer<typeof FormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(FormSchema),
        defaultValues: buildFertilizerDefaults(fertilizer, clearName),
    })

    useEffect(() => {
        form.reset(buildFertilizerDefaults(fertilizer, clearName))
    }, [fertilizer, form, clearName])

    return (
        <FertilizerForm
            fertilizerParameters={fertilizerParameters}
            form={form}
            editable={editable}
            p_type={fertilizer.p_type}
            rvoLabels={rvoLabels}
            rvoToType={rvoToType}
        />
    )
}
