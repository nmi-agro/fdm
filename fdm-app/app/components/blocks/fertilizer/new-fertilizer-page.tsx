import { zodResolver } from "@hookform/resolvers/zod"
import type { Fertilizer, FertilizerParameterDescriptionItem } from "@nmi-agro/fdm-core"
import type { ComponentProps } from "react"
import { useRemixForm } from "remix-hook-form"
import type { z } from "zod"
import { FertilizerForm } from "~/components/blocks/fertilizer/form"
import { FormSchema } from "~/components/blocks/fertilizer/formschema"
import { buildFertilizerDefaults } from "~/components/blocks/fertilizer/utils"

interface FarmNewFertilizerBlockLoaderData {
  fertilizer: Partial<Fertilizer>
  fertilizerParameters: FertilizerParameterDescriptionItem[]
  editable?: boolean
  rvoLabels?: Record<string, string>
  rvoToType?: Record<string, string>
  clearName?: boolean
}

/**
 * Inner component holding the form, keyed by fertilizer identity so it
 * remounts (re-initialising defaultValues) when the fertilizer changes.
 */
function FarmNewFertilizerFormBlock({
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
    resolver: zodResolver(FormSchema) as never,
    defaultValues: buildFertilizerDefaults(fertilizer, clearName),
  })

  return (
    <FertilizerForm
      fertilizerParameters={fertilizerParameters}
      form={form as ComponentProps<typeof FertilizerForm>["form"]}
      editable={editable}
      p_type={fertilizer.p_type}
      rvoLabels={rvoLabels}
      rvoToType={rvoToType}
    />
  )
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
  return (
    <FarmNewFertilizerFormBlock
      key={loaderData.fertilizer.p_id ?? "custom"}
      loaderData={loaderData}
    />
  )
}
