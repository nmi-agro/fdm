import type {
  AppAmountUnit,
  FertilizerApplication as CoreFertilizerApplication,
} from "@nmi-agro/fdm-core"
import type { ApplicationMethods } from "@nmi-agro/fdm-data"

export type FertilizerApplication = CoreFertilizerApplication & {
  p_app_ids?: string[]
}

export interface FertilizerOption {
  value: string
  label: string
  applicationMethodOptions: {
    value: ApplicationMethods
    label: string
  }[]
  p_app_amount_unit: AppAmountUnit
  /**
   * Maximum applied amount in `p_app_amount_unit` (100,000 kg/ha converted to that unit).
   * `null` or absent when it cannot be computed, for example without a density.
   */
  p_app_amount_display_max?: number | null
  /** RVO manure code of the fertilizer, used to decide whether the origin is asked. */
  p_type_rvo?: string | null
}

export interface FertilizerApplicationsFormProps {
  fertilizerApplications: FertilizerApplication[]
  options: FertilizerOption[]
  defaultValue?: string
  action: string
}

export interface FertilizerApplicationsCardProps {
  title: string
  shortname: string
  value: number
  unit: string
  limit: number | undefined
  advice: number | undefined
}
