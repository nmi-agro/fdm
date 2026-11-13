import type { SoilAnalysis } from "@nmi-agro/fdm-core"
import { addDays, differenceInDays } from "date-fns"
import Decimal from "decimal.js"
import type { CultivationDetail as OrganicMatterCultivationDetail } from "../organic-matter/types"
import type {
  PhosphateCultivationDetail,
  PhosphateFieldInput,
  PhosphateSoilAnalysis,
  PhosphateSupplyDeposition,
  PhosphateSupplyMineralization,
} from "./types"
import { calculateOrganicMatterDegradation } from "../organic-matter/degradation"
import { getPhosphateSoilTypeParameters } from "./alpha-max"
import { P_TO_P2O5 } from "./projection"
import { sortSoilAnalyses } from "./saturation"

/** Atmospheric P deposition (kg P2O5 / ha / year), as in the issue. Small but included for completeness. */
export const PHOSPHATE_DEPOSITION_PER_YEAR = 0.7

/** Net / gross mineralisation: part of the mineralised P that is not immobilised by microbes (range 0.5–0.75). */
const F_NET_GROSS = 0.65
/** P2O5 released per kg organic matter degraded on mineral soils (kg P2O5 / kg OM). */
const F_P2O5_GRASSLAND = 0.0046
const F_P2O5_ARABLE = 0.0034
/** Reference oxidation of peat at Gt V (t OM / ha / year, range 10–15). */
const PEAT_OM_OX_REF = 12
/** Temperature factor 2^((T − 13) / 10) at T = 9.3 °C, as in the organic matter balance. */
const PEAT_F_T = 2 ** ((9.3 - 13) / 10)
/** P released per t OM oxidised in fertilised peat grassland (kg P / t OM; 1.2 less intensive, 0.7 deep peat). */
const PEAT_F_P = 1.7

/**
 * DRAFT factor for the oxidation of peat per groundwater class, relative to Gt V. Extrapolated from
 * CO₂ / subsidence emission factors: there is no P-specific table, so treat as ±30%.
 * Classes are matched on their Roman numeral (e.g. `IIIb` → III, `sVb` → V).
 */
const PEAT_F_GWL: Record<string, number> = {
  I: 0.3,
  II: 0.3,
  III: 0.75,
  IV: 0.9,
  V: 1.0,
  VI: 1.2,
  VII: 1.4,
  VIII: 1.4,
}

type SoilInput = Partial<PhosphateSoilAnalysis>

/** Number of years in the timeframe (days / 365), as in the organic matter balance. */
export function yearsInTimeframe(timeFrame: { start: Date; end: Date }): Decimal {
  return new Decimal(differenceInDays(addDays(timeFrame.end, 1), timeFrame.start)).dividedBy(365)
}

/**
 * Factor for the oxidation of peat for a groundwater class, relative to Gt V.
 *
 * @param b_gwl_class - The groundwater class.
 * @returns The factor, or `null` when the class is unknown.
 */
export function getPeatGroundwaterFactor(
  b_gwl_class: SoilAnalysis["b_gwl_class"] | null | undefined,
): number | null {
  if (!b_gwl_class) return null
  const roman = b_gwl_class.replace(/^s/, "").match(/^[IVX]+/)?.[0]
  return roman ? (PEAT_F_GWL[roman] ?? null) : null
}

/**
 * Calculates the phosphate supply by mineralisation of soil organic matter (kg P2O5 / ha for the
 * timeframe), with two tracks:
 *
 * - **Mineral soils:** the degradation of the organic matter balance × P2O5 per kg OM (0.0046
 *   grassland, 0.0034 arable) × 0.65 (net / gross).
 * - **Peat (`veen`):** the organic matter balance underestimates the oxidation of peat by a factor
 *   ~300, so it is not used. Instead: 12 t OM/ha/year × groundwater factor × temperature factor
 *   (0.774) × 1.7 kg P / t OM × 0.65, converted to P2O5.
 *
 * Not double counting: the stock is tracked as P-AL / P-ox, which mainly contains inorganic P. Most
 * organic P is not extracted, so mineralisation moves P into the modelled pool. If the stock is ever
 * tracked as total soil P, this term must be removed.
 *
 * DRAFT for discussion: the parameters come from the issue and need review (Maarten van Doorn).
 *
 * @param fieldInput - The field input (cultivations and soil analyses).
 * @param cultivationDetails - The cultivation catalogue details (crop rotation, for grassland).
 * @param isGrassland - Whether the field is grassland.
 * @param timeFrame - The timeframe of the balance.
 * @returns The mineralisation with the track used and notes when data are missing.
 * @alpha
 */
export function calculatePhosphateMineralization(
  fieldInput: PhosphateFieldInput,
  cultivationDetails: Map<string, PhosphateCultivationDetail>,
  isGrassland: boolean,
  timeFrame: { start: Date; end: Date },
): PhosphateSupplyMineralization {
  const sorted = sortSoilAnalyses(fieldInput.soilAnalyses)
  const find = <K extends keyof SoilInput>(key: K) =>
    sorted.find((a) => a[key] !== null && a[key] !== undefined)?.[key] ?? null
  const b_soiltype_agr = find("b_soiltype_agr")
  const b_gwl_class = find("b_gwl_class")
  const warnings: string[] = []

  // Fe-P release after rewetting is not modelled: flag peat fields whose groundwater class changed
  const gwlClasses = new Set(sorted.map((a) => a.b_gwl_class).filter((x) => !!x))
  if (b_soiltype_agr === "veen" && gwlClasses.size > 1) {
    warnings.push(
      "De grondwatertrap van dit veenperceel is veranderd. Bij vernatting kan ijzergebonden fosfaat vrijkomen; dat is niet berekend.",
    )
  }

  if (b_soiltype_agr === "veen") {
    const f_gwl = getPeatGroundwaterFactor(b_gwl_class)
    if (f_gwl === null) {
      warnings.push(
        "Grondwatertrap onbekend: voor de mineralisatie van veen is de waarde van Gt V gebruikt.",
      )
    }
    const kgP = new Decimal(PEAT_OM_OX_REF)
      .times(f_gwl ?? 1)
      .times(PEAT_F_T)
      .times(PEAT_F_P)
      .times(F_NET_GROSS)
    return {
      total: kgP.times(P_TO_P2O5).times(yearsInTimeframe(timeFrame)).toNumber(),
      track: "peat",
      warnings,
    }
  }

  const a_som_loi = find("a_som_loi")
  if (a_som_loi === null) {
    warnings.push("Geen organische-stofgehalte bekend: de mineralisatie is op 0 gezet.")
    return { total: 0, track: "none", warnings }
  }
  const a_density_sa =
    find("a_density_sa") ?? getPhosphateSoilTypeParameters(b_soiltype_agr).a_density_sa_default
  // Reuse the degradation of the organic matter balance (negative, kg OM / ha for the timeframe)
  const degradation = calculateOrganicMatterDegradation(
    { a_som_loi, a_density_sa, b_soiltype_agr },
    fieldInput.cultivations,
    cultivationDetails as unknown as Map<string, OrganicMatterCultivationDetail>,
    timeFrame,
  ).total
  const total = degradation
    .abs()
    .times(isGrassland ? F_P2O5_GRASSLAND : F_P2O5_ARABLE)
    .times(F_NET_GROSS)
  return { total: total.toNumber(), track: "mineral", warnings }
}

/**
 * Atmospheric phosphate deposition (kg P2O5 / ha for the timeframe): 0.7 kg P2O5 / ha / year.
 *
 * @param timeFrame - The timeframe of the balance.
 * @returns The deposition.
 * @alpha
 */
export function calculatePhosphateDeposition(timeFrame: {
  start: Date
  end: Date
}): PhosphateSupplyDeposition {
  return {
    total: new Decimal(PHOSPHATE_DEPOSITION_PER_YEAR).times(yearsInTimeframe(timeFrame)).toNumber(),
  }
}
