import type {
  AggregatedNormFillingsToFarmLevel,
  AggregatedNormsToFarmLevel,
  FertilizerApplicationFillingInputByYear,
  FieldInput,
  NitrogenBalanceFieldInput,
  NitrogenBalanceFieldResultNumeric,
  NormFilling,
  RegionKey,
} from "@nmi-agro/fdm-calculator/browser"
import type { BaseFertilizerApplication, Fertilizer } from "@nmi-agro/fdm-core"

/** Search parameters on the action URL that carry analytics about the bulk page. */
export const BULK_ANALYTICS_PARAMS = {
  excludedCount: "excludedCount",
  normExceeded: "normExceeded",
  previewUsed: "previewUsed",
} as const

/** The nutrients shown on the bulk fertilizer application page. */
export const BULK_NUTRIENTS = ["n", "p", "k"] as const
export type BulkNutrient = (typeof BULK_NUTRIENTS)[number]

/** The norms of the farm (gebruiksruimte). */
export type BulkNormKey = "nitrogen" | "phosphate" | "manure" | "renure"

/** Dose per nutrient in kg/ha. N is workable nitrogen. */
export type BulkNutrientValues = Record<BulkNutrient, number>

/** A field that can be selected on the bulk page. */
export interface BulkFieldOption {
  b_id: string
  b_name: string
  /** Area in hectares, rounded to one decimal. */
  b_area: number
  b_bufferstrip: boolean
  /** Catalogue codes of the cultivations in the calendar year. */
  cultivations: string[]
  /** Name of the main cultivation in the calendar year, if any. */
  mainCultivationName: string | null
  /** Crop rotation group of the main cultivation, for its colour. */
  mainCultivationCropRotation: string | null
}

/** The current advice and dose of a field. */
export interface BulkFieldAdvice {
  b_id: string
  b_area: number
  b_bufferstrip: boolean
  /** Current dose in kg/ha. */
  dose?: BulkNutrientValues
  /** Advice in kg/ha. */
  advice?: BulkNutrientValues
  /** Why the advice could not be calculated. */
  errorMessage?: string
}

/** The norms (gebruiksruimte) and fillings of the farm. */
export interface BulkFarmNorms {
  /** `false` for years without norms. */
  available: boolean
  showRenure: boolean
  farmNorms?: AggregatedNormsToFarmLevel
  farmFillings?: AggregatedNormFillingsToFarmLevel
  /** Number of fields of the farm. */
  fieldCount: number
  /** Fields that are left out of the norms, with the reason. */
  fieldIssues: BulkFieldIssue[]
  /**
   * The norms and current fillings of each selected field, in kg per ha. Fields whose norms could
   * not be calculated are missing.
   */
  selectedFields?: Record<string, BulkFieldNormValues>
}

/** Norm values or fillings per norm, in kg per ha. */
export type BulkNormValues = Partial<Record<BulkNormKey, number>>

/** The norms and current fillings of a single field, in kg per ha. */
export interface BulkFieldNormValues {
  norms: BulkNormValues
  fillings: BulkNormValues
}

/** A field that is left out of an aggregation, with the reason. */
export interface BulkFieldIssue {
  b_id: string
  b_name: string
  message: string
  isWarning?: boolean
}

/** Result of a block that can fail as a whole. */
export type BulkBlockResult<T> = { status: "ok"; data: T } | { status: "error"; message: string }

/** The streamed current state of the bulk page. */
export interface BulkCurrentState {
  farmNorms: Promise<BulkBlockResult<BulkFarmNorms>>
  advice: Promise<BulkBlockResult<BulkFieldAdvice[]>>
  balance: Promise<BulkBlockResult<NitrogenBalanceFieldResultNumeric[]>>
  /** The input to calculate the preview in the browser. */
  previewInput: Promise<BulkBlockResult<BulkPreviewInput>>
}

/** The fillings of the norms of a field, in kg per hectare. */
export interface BulkFieldFillings {
  nitrogen: NormFilling
  manure: NormFilling
  phosphate: NormFilling
  renure?: NormFilling
}

/** What the browser needs to recalculate the norm fillings of a field. */
export interface BulkPreviewFieldNorms {
  b_area: number
  b_region: RegionKey
  /** The filling input, without the fertilizers of the farm (they are in `BulkPreviewInput`). */
  input: Omit<FertilizerApplicationFillingInputByYear["2026"], "fertilizers">
  /** The current fillings. */
  current: BulkFieldFillings
}

/**
 * Everything the browser needs to calculate the effect of an unsaved application on the selected
 * fields, without a request per change. Collected once when the page loads.
 */
export interface BulkPreviewInput {
  /** The fertilizers of the farm. */
  fertilizers: Fertilizer[]
  /**
   * Factor from the display amount (for example m³/ha) to kg/ha per fertilizer, keyed by `p_id`.
   * `null` when the amount cannot be converted, for example a volume without density.
   */
  kgPerDisplayUnit: Record<string, number | null>
  /** The current fertilizer applications of each selected field in the calendar year. */
  applications: Record<string, BaseFertilizerApplication[]>
  /** The calendar year, to check the date of the application. */
  timeframe: { start: Date | null; end: Date | null }
  /** Input for the norm fillings, for years with norms. */
  norms?: {
    year: "2025" | "2026"
    fields: Record<string, BulkPreviewFieldNorms>
  }
  /** Input for the nitrogen balance of the selected fields. */
  balance?: {
    fields: Record<string, FieldInput>
    fertilizerDetails: NitrogenBalanceFieldInput["fertilizerDetails"]
    cultivationDetails: NitrogenBalanceFieldInput["cultivationDetails"]
    timeFrame: NitrogenBalanceFieldInput["timeFrame"]
  }
}

/** Result of the norms and dose preview. */
export type BulkImpactPreview =
  | {
      status: "ok"
      /** Farm norms before and after the application. Absent for years without norms. */
      norms?: {
        farmNorms: AggregatedNormsToFarmLevel
        current: AggregatedNormFillingsToFarmLevel
        after: AggregatedNormFillingsToFarmLevel
        /** Fillings per changed field after the change, in kg per ha. */
        fieldsAfter: Record<string, BulkNormValues>
        fieldIssues: BulkFieldIssue[]
      }
      /** Dose per changed field after the change, in kg/ha. */
      doses: Record<string, BulkNutrientValues>
    }
  | { status: "invalid"; message: string }

/** Result of the nitrogen balance preview. */
export type BulkBalancePreview =
  | { status: "ok"; fields: NitrogenBalanceFieldResultNumeric[] }
  | { status: "invalid"; message: string }
