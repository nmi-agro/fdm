import type {
    Fertilizer,
    FertilizerApplication,
    Field,
} from "@nmi-agro/fdm-core"
import { NutrientCard } from "./cards"
import {
    NutrientKPICardForNutrientDeficit,
    NutrientKPICardForNutrientExcess,
    NutrientKPICardForTotalApplications,
} from "./kpi"
import type { NutrientDescription } from "./types"

type Dose = any
interface AsyncData {
    nutrientAdvice: any
    doses: { dose: Dose; applications: Dose[] }
    fertilizerApplications: FertilizerApplication[]
    fertilizers: Fertilizer[]
}

export function NutrientAdviceSection({
    field,
    calendar,
    nutrients,
    asyncData,
}: {
    field: Field
    calendar: string
    nutrients: NutrientDescription[]
    asyncData: AsyncData
}) {
    const { fertilizers, fertilizerApplications, nutrientAdvice, doses } =
        asyncData

    return nutrients.map((nutrient: NutrientDescription) => (
        <NutrientCard
            key={nutrient.symbol}
            description={nutrient}
            advice={nutrientAdvice[nutrient.adviceParameter]}
            doses={doses}
            fertilizerApplications={fertilizerApplications}
            fertilizers={fertilizers}
            to={`/farm/${field.b_id_farm}/${calendar}/field/${field.b_id}/fertilizer`}
        />
    ))
}

export function KPISection({
    asyncData,
    nutrientsDescription,
}: {
    asyncData: AsyncData
    nutrientsDescription: NutrientDescription[]
}) {
    const { doses, fertilizerApplications, nutrientAdvice } = asyncData
    return (
        <>
            <NutrientKPICardForTotalApplications
                doses={doses}
                fertilizerApplications={fertilizerApplications}
            />

            <NutrientKPICardForNutrientDeficit
                descriptions={nutrientsDescription}
                advices={nutrientAdvice}
                doses={doses}
            />

            <NutrientKPICardForNutrientExcess
                descriptions={nutrientsDescription}
                advices={nutrientAdvice}
                doses={doses}
            />
        </>
    )
}
