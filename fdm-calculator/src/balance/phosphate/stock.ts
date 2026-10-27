import type { PhosphateSaturation, PhosphateSoilAnalysis, PhosphateStock } from "./types"
import { getPhosphateSoilTypeParameters } from "./alpha-max"

/** kg P2O5 per kg P */
export const P_TO_P2O5 = 2.2914

/**
 * Reference PSD (%) for the "years to reference" figure: the 25% threshold of the Dutch protocol for
 * phosphate-saturated soils (van der Zee et al., 1990). DRAFT: that threshold applies to the PSD from
 * the surface to the mean highest groundwater level on non-calcareous sand, not to the topsoil.
 */
export const PSD_REFERENCE_DEFAULT = 25

/**
 * Calculates how the yearly phosphate balance changes the oxalate-extractable P stock and the PSD of
 * the sampled layer.
 *
 * DRAFT for discussion. Mass balance of van Doorn (2026), Eq. 5.7: all of the surplus or deficit is
 * assumed to end up in, or come from, the P-ox pool of the sampled layer, without leaching, uptake from
 * the subsoil or irreversible fixation. 1 mmol P / kg in a layer of depth d (m) with bulk density ρ
 * (kg / m³) corresponds to ρ · d · 0.31 kg P / ha.
 *
 * @param balancePerYear - Phosphate balance (kg P2O5 / ha / year).
 * @param saturation - Phosphorus saturation of the topsoil.
 * @param soilAnalyses - The soil analyses of the field (for the sampling depth and bulk density).
 * @param isGrassland - Whether the field is grassland (default depth 0.10 m) or arable land (0.25 m).
 * @param psdReference - Reference PSD (%) for `years_to_reference`.
 * @returns The effect on the stock, or `null` when the PSC is unknown.
 * @alpha
 */
export function calculatePhosphateStock(
  balancePerYear: number,
  saturation: PhosphateSaturation,
  soilAnalyses: Partial<PhosphateSoilAnalysis>[],
  isGrassland: boolean,
  psdReference = PSD_REFERENCE_DEFAULT,
): PhosphateStock | null {
  if (!saturation.psc) return null
  const params = getPhosphateSoilTypeParameters(saturation.b_soiltype_agr)

  // Sampling depth of the most recent analysis that states it, otherwise the standard depth
  const withDepth = [...soilAnalyses]
    .sort((a, b) => (b.b_sampling_date?.getTime() ?? 0) - (a.b_sampling_date?.getTime() ?? 0))
    .find((a) => a.a_depth_lower != null && a.a_depth_lower > (a.a_depth_upper ?? 0))
  const depth: PhosphateStock["depth"] = withDepth
    ? {
        value: ((withDepth.a_depth_lower as number) - (withDepth.a_depth_upper ?? 0)) / 100,
        source: "soil_analysis",
      }
    : isGrassland
      ? { value: 0.1, source: "default_grassland" }
      : { value: 0.25, source: "default_arable" }

  const withDensity = soilAnalyses.find((a) => a.a_density_sa != null && a.a_density_sa > 0)
  const a_density_sa: PhosphateStock["a_density_sa"] = withDensity
    ? { value: withDensity.a_density_sa as number, source: "soil_analysis" }
    : { value: params.a_density_sa_default, source: "default_soil_type" }

  // kg P / ha per mmol P / kg in the sampled layer
  const kgPPerMmol = a_density_sa.value * 1000 * depth.value * 0.31
  const delta_p_ox_per_year = balancePerYear / P_TO_P2O5 / kgPPerMmol

  const { psc, psd } = saturation
  const delta_psd_per_year = {
    value: (delta_p_ox_per_year / psc.value) * 100,
    min: (delta_p_ox_per_year / psc.max) * 100,
    max: (delta_p_ox_per_year / psc.min) * 100,
  }

  // Years until the PSD reaches the reference; 0 when a deficit has already brought it below the
  // reference, `null` when the balance moves the PSD away from it
  const years = (from: number, perYear: number) => {
    if (perYear === 0) return null
    const t = (psdReference - from) / perYear
    if (t >= 0) return t
    return perYear < 0 ? 0 : null
  }
  let years_to_reference: PhosphateStock["years_to_reference"] = null
  if (psd) {
    const value = years(psd.value, delta_psd_per_year.value)
    // The same alpha_max gives the low PSD and the low rate of change: combine them consistently
    const atHighAlpha = years(psd.min, delta_psd_per_year.min)
    const atLowAlpha = years(psd.max, delta_psd_per_year.max)
    if (value !== null) {
      const candidates = [value, atHighAlpha, atLowAlpha].filter((x): x is number => x !== null)
      years_to_reference = {
        value,
        min: Math.min(...candidates),
        max: Math.max(...candidates),
      }
    }
  }

  return {
    depth,
    a_density_sa,
    stock_p_ox: saturation.a_p_ox === null ? null : saturation.a_p_ox * kgPPerMmol * P_TO_P2O5,
    delta_p_ox_per_year,
    delta_psd_per_year,
    years_to_reference,
    psd_reference: psdReference,
  }
}
