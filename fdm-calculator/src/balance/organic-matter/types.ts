import type {
    Cultivation,
    CultivationCatalogue,
    Field,
    SoilAnalysis,
} from "@nmi-agro/fdm-core"
import type { Decimal } from "decimal.js"
import type { CalculatorFertilizerApplication } from "../../shared/types"

/**
 * Represents the organic matter supply from various fertilizer applications, categorized by type.
 * All values are in kilograms of effective organic matter per hectare (kg EOM / ha).
 * Effective Organic Matter (EOM) is the portion of organic matter that remains in the soil after one year.
 *
 * @see {@link https://www.agro-effluent.be/files/documents/2021-12-16-14-11-20-eindverslag-agro-effluent-17-06-2020.pdf} for more details on EOM.
 */
export type OrganicMatterSupplyFertilizers = {
    /**
     * The total amount of effective organic matter supplied by all types of fertilizers combined.
     */
    total: Decimal
    /**
     * The effective organic matter supply specifically from manure.
     */
    manure: {
        /**
         * The total amount of effective organic matter supplied by manure.
         */
        total: Decimal
        /**
         * A detailed list of individual manure applications.
         * Each entry includes the application's unique identifier (`id`) and the amount of EOM supplied (`value`).
         */
        applications: { id: string; value: Decimal }[]
    }
    /**
     * The effective organic matter supply specifically from compost.
     */
    compost: {
        /**
         * The total amount of effective organic matter supplied by all compost applications.
         */
        total: Decimal
        /**
         * A detailed list of individual compost applications.
         * Each entry includes the application's unique identifier (`id`) and the amount of EOM supplied (`value`).
         */
        applications: { id: string; value: Decimal }[]
    }
    /**
     * The effective organic matter supply from fertilizers other than manure or compost.
     */
    other: {
        /**
         * The total amount of effective organic matter supplied by all other fertilizer applications.
         */
        total: Decimal
        /**
         * A detailed list of individual other fertilizer applications.
         * Each entry includes the application's unique identifier (`id`) and the amount of EOM supplied (`value`).
         */
        applications: { id: string; value: Decimal }[]
    }
}

/**
 * Represents the organic matter supply from cultivations (main crops and green manures).
 * All values are in kilograms of effective organic matter per hectare (kg EOM / ha).
 */
export type OrganicMatterSupplyCultivations = {
    /**
     * The total amount of effective organic matter supplied by all cultivations on the field.
     */
    total: Decimal
    /**
     * A detailed list of cultivations that supply organic matter.
     * Each entry includes the cultivation's unique identifier (`id`) and the amount of EOM supplied (`value`).
     */
    cultivations: { id: string; value: Decimal }[]
}

/**
 * Represents the organic matter supply from crop residues.
 * All values are in kilograms of effective organic matter per hectare (kg EOM / ha).
 */
export type OrganicMatterSupplyResidues = {
    /**
     * The total amount of effective organic matter supplied by all crop residues left on the field.
     */
    total: Decimal
    /**
     * A detailed list of cultivations whose residues supply organic matter.
     * Each entry includes the cultivation's unique identifier (`id`) and the amount of EOM supplied (`value`).
     */
    cultivations: { id: string; value: Decimal }[]
}

/**
 * Represents the total organic matter supply for a field, considering all sources.
 * All values are in kilograms of effective organic matter per hectare (kg EOM / ha).
 */
export type OrganicMatterSupply = {
    /**
     * The total amount of effective organic matter supplied to the field, encompassing all sources.
     */
    total: Decimal
    /**
     * The organic matter supplied from fertilizer applications.
     */
    fertilizers: OrganicMatterSupplyFertilizers
    /**
     * The organic matter supplied from cultivations.
     */
    cultivations: OrganicMatterSupplyCultivations
    /**
     * The organic matter supplied from crop residues.
     */
    residues: OrganicMatterSupplyResidues
}

/**
 * Represents the degradation of soil organic matter (SOM).
 * All values are in kilograms of organic matter per hectare (kg OM / ha).
 */
export type OrganicMatterDegradation = {
    /**
     * The total amount of organic matter degraded on the field over the calculation period.
     */
    total: Decimal
}

/**
 * Represents the organic matter balance for a single field, detailing the supply and degradation.
 * All values are in kilograms of organic matter per hectare (kg OM / ha), with supply being effective OM.
 */
export type OrganicMatterBalanceField = {
    /** The unique identifier for the field. */
    b_id: string
    /** The overall organic matter balance for the field (Supply - Degradation). */
    balance: Decimal
    /** The total effective organic matter supply for the field. */
    supply: OrganicMatterSupply
    /** The total organic matter degradation from the field. */
    degradation: OrganicMatterDegradation
}

/**
 * Represents the result of an organic matter balance calculation for a single field.
 * It may contain either the detailed balance or an error message if the calculation failed.
 */
export type OrganicMatterBalanceFieldResult = {
    /** The unique identifier of the field. */
    b_id: string
    /** The area of the field in hectares. */
    b_area: number
    /** Whether the field is a buffer strip */
    b_bufferstrip: boolean
    /** The detailed organic matter balance for the field. Undefined if an error occurred. */
    balance?: OrganicMatterBalanceField
    /** An error message if the calculation for this field failed. */
    errorMessage?: string
}

/**
 * Represents the aggregated organic matter balance across all fields of a farm.
 * All values are weighted averages in kilograms of organic matter per hectare (kg OM / ha).
 */
export type OrganicMatterBalance = {
    /** The overall weighted average organic matter balance for the farm. */
    balance: Decimal
    /** The total weighted average organic matter supply for the farm. */
    supply: Decimal
    /** The total weighted average organic matter degradation for the farm. */
    degradation: Decimal
    /** A detailed breakdown of the organic matter balance for each individual field. */
    fields: OrganicMatterBalanceFieldResult[]
    /** Indicates if any of the field calculations resulted in an error. */
    hasErrors: boolean
    /** A list of error messages from fields that failed to calculate. */
    fieldErrorMessages: string[]
}

/**
 * A subset of `SoilAnalysis` properties required for the organic matter balance calculation.
 */
export type SoilAnalysisPicked = Pick<
    SoilAnalysis,
    | "a_som_loi" // Soil Organic Matter content (%)
    | "a_density_sa" // Bulk density (g/cm³)
    | "b_soiltype_agr" // Agricultural soil type
>

/**
 * Represents the necessary input data for a single field for the organic matter balance calculation.
 */
export type FieldInput = {
    /** The core details of the field. */
    field: Pick<
        Field,
        "b_id" | "b_centroid" | "b_area" | "b_start" | "b_end" | "b_bufferstrip"
    >
    /** The list of cultivations that took place on the field. */
    cultivations: Pick<
        Cultivation,
        | "b_lu"
        | "b_lu_name"
        | "b_lu_start"
        | "b_lu_end"
        | "b_lu_catalogue"
        | "m_cropresidue"
    >[]
    /** The list of soil analyses performed on the field. */
    soilAnalyses: Pick<
        SoilAnalysis,
        | "a_id"
        | "b_sampling_date"
        | "a_som_loi"
        | "a_density_sa"
        | "b_soiltype_agr"
    >[]
    /** The list of fertilizer applications on the field. */
    fertilizerApplications: CalculatorFertilizerApplication[]
}

/**
 * A subset of `CultivationCatalogue` properties required for the organic matter balance.
 */
export type CultivationDetail = Pick<
    CultivationCatalogue,
    | "b_lu_catalogue"
    | "b_lu_croprotation"
    | "b_lu_eom" // Effective Organic Matter from the cultivation (kg EOM/ha/yr)
    | "b_lu_eom_residue" // Effective Organic Matter from crop residues (kg EOM/ha/yr)
>

/**
 * A subset of `Fertilizer` properties required for the organic matter balance.
 */
export type FertilizerDetail = {
    p_id_catalogue: string
    p_eom?: number | null // Effective Organic Matter content (g EOM/kg product)
    p_type?: string | null // The type of fertilizer (e.g., 'manure', 'compost', 'mineral').
}

/**
 * Represents the complete input structure required for the organic matter balance calculation for a farm.
 */
export type OrganicMatterBalanceInput = {
    /** An array of all field inputs for the farm. */
    fields: FieldInput[]
    /** A list of all available fertilizer details from the farm's catalogue. */
    fertilizerDetails: FertilizerDetail[]
    /** A list of all available cultivation details from the farm's catalogue. */
    cultivationDetails: CultivationDetail[]
    /** The start and end date of the calculation period. */
    timeFrame: {
        start: Date
        end: Date
    }
}

/**
 * Represents the necessary input data for a single field for the organic matter balance calculation.
 * This includes the field-specific data as well as the shared catalogue details.
 */
export type OrganicMatterBalanceFieldInput = {
    /** The input data for the specific field. */
    fieldInput: FieldInput
    /** A list of all available fertilizer details from the farm's catalogue. */
    fertilizerDetails: FertilizerDetail[]
    /** A list of all available cultivation details from the farm's catalogue. */
    cultivationDetails: CultivationDetail[]
    /** The calculation period. */
    timeFrame: {
        start: Date
        end: Date
    }
}

// --- Numeric Types ---
// The following types are numeric-only versions of the types above,
// intended for final outputs where `Decimal` objects are converted to numbers.

/** Numeric version of `OrganicMatterSupplyFertilizers`. */
export type OrganicMatterSupplyFertilizersNumeric = {
    total: number
    manure: {
        total: number
        applications: { id: string; value: number }[]
    }
    compost: {
        total: number
        applications: { id: string; value: number }[]
    }
    other: {
        total: number
        applications: { id: string; value: number }[]
    }
}

/** Numeric version of `OrganicMatterSupplyCultivations`. */
export type OrganicMatterSupplyCultivationsNumeric = {
    total: number
    cultivations: { id: string; value: number }[]
}

/** Numeric version of `OrganicMatterSupplyResidues`. */
export type OrganicMatterSupplyResiduesNumeric = {
    total: number
    cultivations: { id: string; value: number }[]
}

/** Numeric version of `OrganicMatterSupply`. */
export type OrganicMatterSupplyNumeric = {
    total: number
    fertilizers: OrganicMatterSupplyFertilizersNumeric
    cultivations: OrganicMatterSupplyCultivationsNumeric
    residues: OrganicMatterSupplyResiduesNumeric
}

/** Numeric version of `OrganicMatterDegradation`. */
export type OrganicMatterDegradationNumeric = {
    total: number
}

/** Numeric version of `OrganicMatterBalanceField`. */
export type OrganicMatterBalanceFieldNumeric = {
    b_id: string
    balance: number
    supply: OrganicMatterSupplyNumeric
    degradation: OrganicMatterDegradationNumeric
}

/** Numeric version of `OrganicMatterBalanceFieldResult`. */
export type OrganicMatterBalanceFieldResultNumeric = {
    /** The unique identifier of the field. */
    b_id: string
    /** The area of the field in hectares. */
    b_area: number
    /** Whether the field is a buffer strip */
    b_bufferstrip: boolean
    /** The detailed organic matter balance for the field. Undefined if an error occurred. */
    balance?: OrganicMatterBalanceFieldNumeric
    /** An error message if the calculation for this field failed. */
    errorMessage?: string
}

/** Numeric version of `OrganicMatterBalance`. */
export type OrganicMatterBalanceNumeric = {
    balance: number
    supply: number
    degradation: number
    fields: OrganicMatterBalanceFieldResultNumeric[]
    hasErrors: boolean
    fieldErrorMessages: string[]
    errorMessage?: string
}
