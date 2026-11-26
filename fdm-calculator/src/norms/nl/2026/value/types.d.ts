import type { Cultivation, Field, Harvest, SoilAnalysis } from "@nmi-agro/fdm-core"

/**
 * The norm years that use the NL rules introduced in 2026.
 *
 * A later year uses the functions of the earliest year whose rules it shares, until a
 * regulation or RVO table changes them. The 2027 norms are provisional: as of now no regulation
 * or RVO table changes them compared with 2026.
 */
export type NL2026NormsYear = 2026 | 2027

/**
 * Represents the collected input for a single cultivation, required for the NL norm
 * calculations from 2026 on.
 */
export type NL2026NormsInputForCultivation = Pick<
  Cultivation,
  "b_lu" | "b_lu_catalogue" | "b_lu_start" | "b_lu_end" | "b_lu_variety"
> & {
  /**
   * Harvests of this cultivation within the norm year (1 January to 31 December).
   * Used to tell a single harvest (eenmalige oogst) from multiple harvests (meermalige oogst).
   * When omitted, the cultivation is treated as harvested at most once.
   */
  harvests?: Pick<Harvest, "b_lu_harvest_date">[]
}

/**
 * Represents the complete set of inputs required to calculate all NL norms of a field, for the
 * norm years that use the rules introduced in 2026.
 */
export type NL2026NormsInput = {
  /** The norm year. The dates of the rules (main crop period, reduction windows) are of this year. */
  year: NL2026NormsYear
  /** Farm-level properties, such as grazing intention. */
  farm: {
    has_grazing_intention: boolean
  }
  /** The field record from fdm-core, including its ID and centroid for location-based checks. */
  field: Pick<Field, "b_id" | "b_centroid" | "b_bufferstrip">
  /** An array of all cultivations on the field with their required norm inputs. */
  cultivations: NL2026NormsInputForCultivation[]
  /**
   * The current soil analysis values of the field, as collected by the input collectors with
   * `getCurrentSoilData`: only analyses sampled up to and including 31 December of the norm year
   * count, plus analyses without a sampling date. Each parameter is determined on its own: the
   * value of the most recent whole-field analysis, or, when the most recent analysis is of a
   * sampling zone, the area-weighted mean of the zones. So `a_p_cc` and `a_p_al` can come from
   * different samplings.
   */
  soilAnalysis: Pick<SoilAnalysis, "a_p_cc" | "a_p_al">
}

/**
 * Defines the possible phosphate classes based on RVO's "Tabel Fosfaatgebruiksnormen 2026".
 * These classes are determined by P-CaCl2 and P-Al soil analysis values.
 */
export type FosfaatKlasse = "Arm" | "Laag" | "Neutraal" | "Ruim" | "Hoog"

/**
 * Defines the structure for a single nitrogen standard entry,
 * based on the RVO's "Tabel 2 Stikstof landbouwgrond 2026" and related documents.
 * This interface supports various complexities like different norms for regions,
 * specific varieties, derogation status, and sub-types for temporary grasslands.
 */
export interface NitrogenStandard {
  /**
   * The cultivation name as it appears in RVO's "Tabel 2 Stikstof landbouwgrond 2026".
   * This is used for descriptive purposes and as part of the function's return value.
   * @example "Grasland", "Akkerbouwgewassen, mais"
   */
  cultivation_rvo_table2: string
  /**
   * An array of BRP (Basisregistratie Percelen) cultivation codes that match this standard.
   * This allows a single standard entry to apply to multiple BRP codes.
   * @example ["nl_265", "nl_331"]
   */
  b_lu_catalogue_match: string[]
  /**
   * A general type classification for the cultivation (e.g., "grasland", "aardappel", "akkerbouw").
   * Used internally for conditional logic in norm determination.
   */
  type: string
  /**
   * Optional. A more specific classification for varieties, particularly for potatoes.
   * @example "consumptie_overig", "poot_overig"
   */
  is_winterteelt: boolean
  is_vanggewas: boolean
  norms?: {
    klei: { standard: number; nv_area: number }
    zand_nwc: { standard: number; nv_area: number }
    zand_zuid: { standard: number; nv_area: number }
    loess: { standard: number; nv_area: number }
    veen: { standard: number; nv_area: number }
  }
  sub_types?: Array<{
    omschrijving?: string
    period_description?: string
    period_start_month?: number
    period_start_day?: number
    period_end_month?: number
    period_end_day?: number
    varieties?: string[] // Added for potato varieties
    norms: {
      klei: { standard: number; nv_area: number }
      zand_nwc: { standard: number; nv_area: number }
      zand_zuid: { standard: number; nv_area: number }
      loess: { standard: number; nv_area: number }
      veen: { standard: number; nv_area: number }
    }
    winterteelt_voor_31_12?: {
      klei: { standard: number; nv_area: number }
      zand_nwc: { standard: number; nv_area: number }
      zand_zuid: { standard: number; nv_area: number }
      loess: { standard: number; nv_area: number }
      veen: { standard: number; nv_area: number }
    }
    winterteelt_na_31_12?: {
      klei: { standard: number; nv_area: number }
      zand_nwc: { standard: number; nv_area: number }
      zand_zuid: { standard: number; nv_area: number }
      loess: { standard: number; nv_area: number }
      veen: { standard: number; nv_area: number }
    }
  }>
}

/**
 * Defines the valid keys for different soil regions in the Netherlands.
 */
export type RegionKey = "klei" | "zand_nwc" | "zand_zuid" | "loess" | "veen"

/**
 * A utility type to represent nitrogen norms structured by region.
 */
export type NormsByRegion = {
  [key in RegionKey]: { standard: number; nv_area: number }
}
