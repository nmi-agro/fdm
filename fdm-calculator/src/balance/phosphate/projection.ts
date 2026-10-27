import type {
  PhosphateProjection,
  PhosphateSaturation,
  PhosphateSaturationThreshold,
  PhosphateSoilAnalysis,
  ValueWithRange,
  YearsClass,
} from "./types"
import { getPhosphateSoilTypeParameters } from "./alpha-max"
import { sortSoilAnalyses } from "./saturation"

/** kg P2O5 per kg P */
export const P_TO_P2O5 = 2.2914
/** Depth (m) the P-AL buffer values refer to: the arable layer. */
const BUFFER_REFERENCE_DEPTH = 0.25

/**
 * Converts a number of years into a display class.
 *
 * @param years - Years until the level is reached; 0 when already reached; `null` when not reached at
 *   the current balance.
 * @returns The class.
 */
export function classifyYears(years: number | null): YearsClass {
  if (years === null) return "not_reached"
  if (years <= 0) return "reached"
  if (years < 5) return "lt_5"
  if (years < 10) return "5_10"
  if (years <= 20) return "10_20"
  return "gt_20"
}

/** Years from `from` to `to` at `perYear`; 0 when already past it in the direction of change. */
function yearsTo(from: number, to: number, perYear: number): number | null {
  if (perYear === 0) return null
  const t = (to - from) / perYear
  if (t >= 0) return t
  return perYear < 0 ? 0 : null
}

/**
 * Projects the soil P status at the current balance.
 *
 * DRAFT for discussion. Two tracks, both with the balance minus fixation:
 * - P-AL (as proposed in the issue): ΔP-AL = (balance − fixation) / buffer, with the soil-type buffer
 *   scaled from 0–25 cm to the sampling depth. Years until P-AL declines to 45 (afbouwen) or 25
 *   (onderhouden).
 * - PSD (van Doorn 2026, Eq. 5.7): ΔP-ox = (balance − fixation) / (ρ · d · 0.31). Years until the PSD
 *   reaches the field-specific threshold.
 *
 * @param balancePerYear - Phosphate balance (kg P2O5 / ha / year).
 * @param saturation - Phosphorus saturation of the topsoil.
 * @param threshold - PSD threshold of the field.
 * @param soilAnalyses - The soil analyses (for sampling depth and bulk density).
 * @param isGrassland - Whether the field is grassland (default depth 0.10 m) or arable land (0.25 m).
 * @returns The projection.
 * @alpha
 */
export function calculatePhosphateProjection(
  balancePerYear: number,
  saturation: PhosphateSaturation,
  threshold: PhosphateSaturationThreshold,
  soilAnalyses: Partial<PhosphateSoilAnalysis>[],
  isGrassland: boolean,
): PhosphateProjection {
  const params = getPhosphateSoilTypeParameters(saturation.b_soiltype_agr)
  const sorted = sortSoilAnalyses(soilAnalyses)

  const withDepth = sorted.find(
    (a) => a.a_depth_lower != null && a.a_depth_lower > (a.a_depth_upper ?? 0),
  )
  const depth: PhosphateProjection["depth"] = withDepth
    ? {
        value: ((withDepth.a_depth_lower as number) - (withDepth.a_depth_upper ?? 0)) / 100,
        source: "soil_analysis",
      }
    : isGrassland
      ? { value: 0.1, source: "default_grassland" }
      : { value: 0.25, source: "default_arable" }
  const withDensity = sorted.find((a) => a.a_density_sa != null && a.a_density_sa > 0)
  const a_density_sa: PhosphateProjection["a_density_sa"] = withDensity
    ? { value: withDensity.a_density_sa as number, source: "soil_analysis" }
    : { value: params.a_density_sa_default, source: "default_soil_type" }

  const fixation = params.fixation
  const effective = balancePerYear - fixation

  // P-AL track
  let p_al: PhosphateProjection["p_al"] = null
  if (saturation.a_p_al !== null) {
    const scale = depth.value / BUFFER_REFERENCE_DEPTH
    const [central, low, high] = params.p_al_buffer
    const buffer: ValueWithRange = {
      value: central * scale,
      min: low * scale,
      max: high * scale,
    }
    const delta: ValueWithRange = {
      value: effective / buffer.value,
      // A larger buffer gives a smaller change
      min: Math.min(effective / buffer.min, effective / buffer.max),
      max: Math.max(effective / buffer.min, effective / buffer.max),
    }
    const current = saturation.a_p_al
    const floor = current > 45 ? 45 : current >= 25 ? 25 : null
    let years: ValueWithRange | null = null
    if (floor !== null && effective < 0) {
      const values = [delta.value, delta.min, delta.max].map((d) => yearsTo(current, floor, d))
      if (values.every((v) => v !== null)) {
        const [value, a, b] = values as number[]
        years = { value, min: Math.min(a, b), max: Math.max(a, b) }
      }
    }
    p_al = {
      current,
      buffer,
      delta_per_year: delta,
      floor,
      years,
      years_class: classifyYears(years?.value ?? null),
    }
  }

  // PSD track
  let psd: PhosphateProjection["psd"] = null
  if (saturation.psc && saturation.psd) {
    const kgPPerMmol = a_density_sa.value * 1000 * depth.value * 0.31
    const delta_p_ox = effective / P_TO_P2O5 / kgPPerMmol
    const delta_per_year = (delta_p_ox / saturation.psc) * 100
    const years =
      threshold.value === null
        ? null
        : yearsTo(saturation.psd.value, threshold.value, delta_per_year)
    psd = {
      current: saturation.psd,
      delta_per_year,
      threshold,
      years,
      years_class: classifyYears(years),
    }
  }

  return {
    balance_effective_per_year: effective,
    fixation,
    depth,
    a_density_sa,
    p_al,
    psd,
  }
}
