/**
 * Type definitions for the grazing metrics calculation engine.
 *
 * @packageDocumentation
 */

/**
 * Input representation of a livestock herd on the farm.
 */
export interface HerdInput {
  /** Unique identifier of the herd. */
  l_id_herd: string
  /** Human-readable name of the herd (e.g. "Melkkoeien", "Jongvee < 1 jaar"). */
  l_herd_name?: string | null
  /** RVO animal category identifier (e.g. "rvo_100", "rvo_101"). */
  l_id_category?: string | null
  /** Livestock unit (GVE) conversion factor per animal (e.g. 1.00 for dairy cows, 0.23 for calves). */
  l_lsu?: number | null
  /** Current derived animal count in this herd. */
  count: number
}

/**
 * Input representation of an outdoor pasture grazing record.
 */
export interface GrazingInput {
  /** Unique identifier of the grazing record. */
  l_id_grazing: string
  /** Identifier of the herd that grazed. */
  l_id_herd: string
  /** Optional identifier of the field where grazing took place. */
  b_id?: string | null
  /** Start timestamp of the grazing period. */
  l_grazing_start: Date
  /** Optional end timestamp of the grazing period. Null indicates an ongoing/open period. */
  l_grazing_end?: Date | null
  /** Number of grazing hours per day (typically 8 for limited grazing, 24 for day & night). */
  l_grazing_hours?: number | null
  /**
   * Grazed area in hectares: the zone within the field, the recorded part of the field, or the
   * whole field (`l_grazing_area_grazed` from fdm-core). When omitted, the whole field is assumed.
   */
  l_grazing_area_grazed?: number | null
  /**
   * Grazed zone within the field (`l_grazing_geometry_zone` from fdm-core). Used to count the rest
   * per part of the field; omitted or `null` means the whole field.
   */
  l_grazing_geometry_zone?: import("geojson").Polygon | import("geojson").MultiPolygon | null
}

/**
 * Input representation of a farm field.
 */
export interface FieldInput {
  /** Unique identifier of the field. */
  b_id: string
  /** Human-readable name of the field. */
  b_name?: string | null
  /** Area of the field in hectares. */
  b_area: number
  /**
   * Area of the field grazed in the evaluated period (ha), with all grazing zones combined
   * (`b_area_grazed` from fdm-core's `getGrazedAreaForFarm`). When omitted, the largest
   * `l_grazing_area_grazed` of the field's grazings is used, which undercounts successive strips.
   */
  b_area_grazed?: number | null
  /** Flag indicating whether this field is in active grassland cultivation. */
  isGrassland: boolean
}

/**
 * Input representation of a crop harvest / mowing event on a grassland field.
 */
export interface HarvestInput {
  /** field identifier where the harvest/mowing took place. */
  b_id: string
  /** Date of the harvest / mowing event. */
  b_harvest_date: Date
}

/**
 * Input payload for {@link calculateGrazingMetrics}.
 */
export interface GrazingMetricsInput {
  /** Evaluation calendar year (e.g. 2026). */
  year: number
  /** Evaluation status date (defaults to current timestamp). Used to distinguish realised vs future-planned events. */
  today?: Date
  /** List of herds present on the farm. */
  herds: HerdInput[]
  /** List of grazing records for the farm. */
  grazings: GrazingInput[]
  /** List of fields on the farm. */
  fields: FieldInput[]
  /** Optional list of grass harvests/mowing events used for rest period calculation. */
  harvests?: HarvestInput[]
}

/**
 * Detailed rest period between two consecutive uses of a grassland field.
 */
export interface RestPeriodDetail {
  /** field identifier. */
  b_id: string
  /** field name. */
  b_name?: string | null
  /** Type of the previous use ("weiden" for grazing, "maaien" for mowing). */
  lastUseType: "weiden" | "maaien"
  /** Calendar day (midnight UTC) on which the previous use ended. */
  lastUseDate: Date
  /** Type of the subsequent use ("weiden" for grazing, "maaien" for mowing). */
  nextUseType: "weiden" | "maaien"
  /** Start timestamp of the subsequent use. */
  nextUseDate: Date
  /** Rest period duration in full calendar days. */
  restDays: number
  /** Indicates whether the rest interval is below the benchmark threshold during the growing season. */
  isOvergrazed: boolean
}

/**
 * Advisory alert for insufficient rest between consecutive uses on a field.
 */
export interface OvergrazingAlert {
  /** field identifier. */
  b_id: string
  /** field name. */
  b_name?: string | null
  /** Realised or planned rest duration in days. */
  restDays: number
  /** Rest threshold in days (`REST_PERIOD_THRESHOLD_DAYS`). */
  thresholdDays: number
  /** Explanatory Dutch advisory message referencing Handboek Melkveehouderij guidelines. */
  message: string
}

/**
 * Monthly distribution of realised and planned grazing days.
 */
export interface MonthlyDistributionEntry {
  /** 1-based month index (1 for January, 12 for December). */
  month: number
  /** Number of distinct realised grazing days in this month. */
  realisedDays: number
  /** Number of distinct planned (future-dated) grazing days in this month. */
  plannedDays: number
  /** Breakdown of distinct grazing days per herd ID in this month. */
  herdDays: Record<string, number>
}

/**
 * Result object returned by {@link calculateGrazingMetrics}.
 */
export interface GrazingMetricsResult {
  /**
   * Total and per-herd distinct grazing days in the evaluated calendar year.
   * Multi-field concurrent grazing on the same calendar day counts as exactly one day.
   */
  weidedagen: {
    /** Total distinct realised grazing days across all herds up to `today`. */
    total: number
    /** Total distinct future-planned grazing days after `today`. */
    planned: number
    /** Breakdown of realised and planned grazing days keyed by herd ID. */
    perHerd: Record<string, { total: number; planned: number }>
  }
  /**
   * Total and average daily grazing hours.
   */
  weideUren: {
    /**
     * Total grazing hours of the farm: per distinct day the hours of the herd that grazed
     * longest, where a herd's hours of a day are those of all its grazings added up (at most 24).
     */
    totalHours: number
    /** Average daily grazing duration (total hours divided by number of days with recorded hours). */
    averageHoursPerDay: number
    /** Per herd ID: its hours added up over its grazings per day, and the average per day. */
    perHerd: Record<string, { totalHours: number; averageHoursPerDay: number }>
  }
  /**
   * Progress and compliance status for the statutory/industry Weidemelk norm (120 days x 6 hours).
   */
  weidemelk: {
    /** Target number of days (120 days). */
    targetDays: number
    /** Minimum grazing duration per day to qualify (6 hours). */
    minHours: number
    /** Realised number of distinct calendar days where dairy cows (category rvo_100) grazed for at least 6 hours. */
    qualifyingDays: number
    /** Future-planned number of qualifying days. */
    plannedQualifyingDays: number
    /** True if the 120-day target has been met. */
    isMet: boolean
    /** Margin in days relative to target (positive indicates surplus, negative indicates days remaining). */
    marginDays: number
    /** Dutch description of the evaluated Weidemelk rule. */
    ruleDescription: string
  }
  /**
   * Grazing platform metrics (beweidingsplatform).
   */
  beweidingsplatform: {
    /** Effective area of the grazing platform in hectares (distinct grassland fields with started grazing). */
    areaHa: number
    /** Count of distinct fields comprising the grazing platform. */
    fieldCount: number
    /** Identifiers of the fields comprising the grazing platform. */
    fieldIds: string[]
  }
  /**
   * Livestock stocking density metrics (veebezetting in GVE/ha).
   */
  veebezetting: {
    /** Stocking density on the grazing platform (GVE of grazing herds divided by platform area). */
    platformGvePerHa: number | null
    /** Farm-wide stocking density on grassland (total herd GVE divided by total grassland area). */
    totalGrasslandGvePerHa: number | null
    /** Total farm livestock units (GVE) across all herds. */
    totalGve: number
    /** Total farm grassland area in hectares (excluding buffer strips). */
    totalGrasslandArea: number
    /** Qualitative density classification ("extensief", "gemiddeld", "intensief") based on benchmarks. */
    platformStockingCategory: "extensief" | "gemiddeld" | "intensief" | null
  }
  /**
   * Detailed list of rest periods between consecutive uses (grazing and mowing) per field.
   */
  rustperiodes: RestPeriodDetail[]
  /**
   * Advisory alerts for parts of fields re-used within fewer than `REST_PERIOD_THRESHOLD_DAYS` days during the growing season.
   */
  overbeweidingAlerts: OvergrazingAlert[]
  /**
   * Details on incomplete records (e.g. started grazing periods missing daily hours).
   */
  incompleteRecords: {
    /** Count of started grazing records missing daily hours. */
    count: number
    /** Identifiers of the incomplete grazing records. */
    grazingIds: string[]
  }
  /**
   * Monthly distribution of realised and planned grazing days.
   */
  monthlyDistribution: MonthlyDistributionEntry[]
}
