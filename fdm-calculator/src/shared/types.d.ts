import type { FertilizerApplication } from "@nmi-agro/fdm-core"

export type CalculatorFertilizerApplication = Pick<
    FertilizerApplication,
    | "p_id"
    | "p_id_catalogue"
    | "p_name_nl"
    | "p_app_id"
    | "p_app_date"
    | "p_app_method"
    | "p_app_amount"
> &
    Partial<FertilizerApplication>
