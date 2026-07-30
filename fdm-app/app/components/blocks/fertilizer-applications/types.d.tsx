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
