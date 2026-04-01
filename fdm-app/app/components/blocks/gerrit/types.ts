import type {
    NormFilling,
    NutrientAdvice,
    GebruiksnormResult,
    AggregatedNormFillingsToFarmLevel,
    AggregatedNormsToFarmLevel,
    NitrogenBalanceFieldNumeric,
    Dose,
} from "@nmi-agro/fdm-calculator"

export interface ParsedPlanApplication {
    p_id_catalogue: string
    p_app_amount: number
    p_app_date: string
    p_app_method?: string | null
    p_app_method_name?: string | null
}

export interface ParsedPlan {
    plan?: Array<{
        b_id: string
        applications: ParsedPlanApplication[]
        fieldMetrics?: FieldMetrics | null
    }>
    summary?: string
}

export interface FieldMetrics {
    normsFilling: {
        manure: NormFilling
        nitrogen: NormFilling
        phosphate: NormFilling
    }
    norms: {
        manure: GebruiksnormResult
        nitrogen: GebruiksnormResult
        phosphate: GebruiksnormResult
    }
    nBalance: Pick<
        NitrogenBalanceFieldNumeric,
        "balance" | "target" | "emission"
    > | null
    omBalance: number | null
    eomSupplyPerHa?: number
    advice: NutrientAdvice | null
    proposedDose: Dose
}

export interface PlanRow {
    b_id: string
    b_name: string | null
    b_lu_catalogue: string | null
    b_lu_name: string | null
    b_lu_croprotation: string | null
    b_area: number | null
    applications: Array<
        ParsedPlanApplication & {
            p_name_nl: string | null
            p_type: string
            p_app_method_name?: string | null
        }
    >
    fieldMetrics: FieldMetrics | null
}

export interface FarmTotals {
    normsFilling: AggregatedNormFillingsToFarmLevel
    norms: AggregatedNormsToFarmLevel
    nBalance: {
        balance: number
        target: number
        emission: { ammonia: { total: number }; nitrate: { total: number } }
    } | null
}
