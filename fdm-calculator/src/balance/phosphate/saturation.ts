import type {
  PhosphateSaturation,
  PhosphateSaturationThreshold,
  PhosphateSoilAnalysis,
} from "./types"
import { getPhosphateSoilTypeParameters, ghgPerGroundwaterClass } from "./alpha-max"

/** Root mean squared error (% PSD) of the P-AL → PSD regression of van Doorn (2026), Fig. S5.7. */
const PSD_FROM_P_AL_RMSE = 10.1
/** Agronomic P-AL target on arable land (mg P2O5 / 100 g), for all soils (CBAV). */
const P_AL_TARGET_ARABLE = 40
/** Threshold used when the field-specific threshold cannot be calculated (%). */
const PSD_THRESHOLD_DEFAULT = 25

type SoilInput = Partial<PhosphateSoilAnalysis>

/** Sorts soil analyses with the most recent first. */
export function sortSoilAnalyses(soilAnalyses: SoilInput[]): SoilInput[] {
  return [...soilAnalyses].sort(
    (a, b) => (b.b_sampling_date?.getTime() ?? 0) - (a.b_sampling_date?.getTime() ?? 0),
  )
}

function latest<K extends keyof SoilInput>(soilAnalyses: SoilInput[], key: K) {
  const analysis = soilAnalyses.find((a) => a[key] !== null && a[key] !== undefined)
  return analysis ? { value: analysis[key] as NonNullable<SoilInput[K]>, analysis } : null
}

/**
 * Estimates the phosphorus saturation degree (PSD) from P-AL and the PSC with the regression of
 * van Doorn (2026), Fig. S5.7: log10(PSD) = 0.4949·log10(P-AL) − 0.2902·log10(PSC) + 1.2220.
 *
 * @param a_p_al - P-AL (mg P2O5 / 100 g).
 * @param psc - Phosphorus sorption capacity (mmol / kg), calculated with alpha_max = 0.5.
 * @returns The estimated PSD (%).
 */
export function estimatePsdFromPAl(a_p_al: number, psc: number): number {
  return 10 ** (0.4949 * Math.log10(a_p_al) - 0.2902 * Math.log10(psc) + 1.222)
}

/**
 * Determines the phosphorus saturation of the topsoil, using the data that is already available.
 *
 * DRAFT for discussion. `alpha_max` is fixed at 0.5. Order of preference:
 * 1. `a_p_ox`, `a_fe_ox` and `a_al_ox` of the most recent soil analysis that has all three (measured,
 *    or NMI map values): `PSC = 0.5 · (Fe-ox + Al-ox)`, `PSD = P-ox / PSC · 100`. No range: the map
 *    values come without uncertainty.
 * 2. `a_p_sg` (PSD as delivered by the laboratory or the NMI API).
 * 3. An estimate from `a_p_al` with the PSC from the oxalate data or the soil-type defaults (indicative,
 *    with the regression error as range).
 *
 * @param soilAnalyses - The soil analyses of the field.
 * @param isGrassland - Whether the field is grassland (sampled 0–10 cm) rather than arable land (0–25 cm).
 * @returns The phosphorus saturation with its source.
 * @alpha
 */
export function calculatePhosphateSaturation(
  soilAnalyses: SoilInput[],
  isGrassland: boolean,
): PhosphateSaturation {
  const sorted = sortSoilAnalyses(soilAnalyses)
  const soiltype = latest(sorted, "b_soiltype_agr")
  const params = getPhosphateSoilTypeParameters(soiltype?.value)
  const p_al = latest(sorted, "a_p_al")
  const warnings: string[] = params.note ? [params.note] : []

  const result = (
    source: PhosphateSaturation["source"],
    psc: number | null,
    psd: PhosphateSaturation["psd"],
    a_p_ox: number | null,
    analysisSources: (string | null | undefined)[],
  ): PhosphateSaturation => ({
    source,
    analysis_sources: [...new Set(analysisSources.filter((x): x is string => !!x))],
    b_soiltype_agr: soiltype?.value ?? null,
    alpha_max: params.alpha_max,
    psc,
    psd,
    a_p_ox,
    a_p_al: p_al?.value ?? null,
    psd_valid: params.psd_valid,
    warnings,
  })

  // 1. Oxalate triplet from one soil analysis
  const oxalate = sorted.find((a) => a.a_p_ox != null && a.a_fe_ox != null && a.a_al_ox != null)
  if (oxalate) {
    const psc = params.alpha_max * ((oxalate.a_fe_ox as number) + (oxalate.a_al_ox as number))
    const a_p_ox = oxalate.a_p_ox as number
    if (psc <= 0) {
      warnings.push("Fe-ox + Al-ox is nul; de fosfaatverzadigingsgraad kan niet worden berekend.")
      return result("missing", null, null, a_p_ox, [oxalate.a_source])
    }
    const value = (a_p_ox / psc) * 100
    return result("oxalate", psc, { value, min: value, max: value }, a_p_ox, [oxalate.a_source])
  }

  // PSC from Fe-ox and Al-ox of one analysis, otherwise the soil-type defaults
  const feAl = sorted.find((a) => a.a_fe_ox != null && a.a_al_ox != null)
  const layer = isGrassland ? 0 : 1
  const psc =
    params.alpha_max *
    (feAl
      ? (feAl.a_fe_ox as number) + (feAl.a_al_ox as number)
      : params.a_fe_ox_default[layer] + params.a_al_ox_default[layer])
  if (!feAl) {
    warnings.push(
      "Geen Fe-ox en Al-ox beschikbaar; de standaardwaarde voor de grondsoort is gebruikt.",
    )
  }

  // 2. PSD as delivered
  const p_sg = latest(sorted, "a_p_sg")
  if (p_sg) {
    const value = p_sg.value
    return result("a_p_sg", psc, { value, min: value, max: value }, (value / 100) * psc, [
      p_sg.analysis.a_source,
      feAl?.a_source,
    ])
  }

  // 3. Indicative estimate from P-AL
  if (p_al && p_al.value > 0 && psc > 0) {
    warnings.push("De fosfaatverzadigingsgraad is geschat uit P-AL en is alleen indicatief.")
    const value = estimatePsdFromPAl(p_al.value, psc)
    return result(
      "estimated_from_p_al",
      psc,
      {
        value,
        min: Math.max(0, value - PSD_FROM_P_AL_RMSE),
        max: value + PSD_FROM_P_AL_RMSE,
      },
      (value / 100) * psc,
      [p_al.analysis.a_source, feAl?.a_source],
    )
  }

  warnings.push("Geen P-ox, fosfaatverzadigingsgraad of P-AL beschikbaar.")
  return result("missing", psc, null, null, [feAl?.a_source])
}

/**
 * Critical ortho-P concentration in soil solution (mg P / L) for a mean highest groundwater level:
 * 0.1 when the GHG is less than 25 cm below the surface, rising linearly to 0.3 at 100 cm or deeper
 * (van Doorn 2026, Ch. 5).
 */
function criticalConcentration(ghg: number): number {
  if (ghg <= 25) return 0.1
  if (ghg >= 100) return 0.3
  return 0.1 + (0.2 * (ghg - 25)) / 75
}

/**
 * Calculates the PSD threshold of the topsoil for a field: the environmental threshold of
 * van Doorn (2026, Eq. 5.5), capped at the PSD of the agronomic P-AL target.
 *
 * DRAFT for discussion.
 * - Langmuir affinity: `KL = beta_max · PSD / (C_P · alpha_max · (100 − PSD))`, with C_P (mol / m³) from
 *   P-CaCl2 (mg / kg) · 0.1 / 31 (1:10 extraction).
 * - Environmental threshold: `PSD_env = 100 · alpha_max · KL · C_env / (beta_max + alpha_max · KL · C_env)`,
 *   with C_env from the groundwater class (see `ghgPerGroundwaterClass`).
 * - Agronomic target: the PSD at P-AL 40 (arable land) or the soil-specific grassland target.
 * When P-CaCl2 or the PSD is missing, 25% is used (protocol for phosphate-saturated soils).
 *
 * @param saturation - The phosphorus saturation of the field.
 * @param soilAnalyses - The soil analyses (for P-CaCl2 and the groundwater class).
 * @param isGrassland - Whether the field is grassland.
 * @returns The threshold and its components.
 * @alpha
 */
export function calculatePhosphateSaturationThreshold(
  saturation: PhosphateSaturation,
  soilAnalyses: SoilInput[],
  isGrassland: boolean,
): PhosphateSaturationThreshold {
  const sorted = sortSoilAnalyses(soilAnalyses)
  const params = getPhosphateSoilTypeParameters(saturation.b_soiltype_agr)
  const warnings: string[] = []
  const { alpha_max, beta_max } = params

  const psd_agronomic =
    saturation.psc && saturation.psc > 0
      ? estimatePsdFromPAl(
          isGrassland ? params.p_al_target_grassland : P_AL_TARGET_ARABLE,
          saturation.psc,
        )
      : null

  const gwl = latest(sorted, "b_gwl_class")
  const ghg = gwl ? (ghgPerGroundwaterClass[gwl.value] ?? null) : null
  if (ghg === null) {
    warnings.push(
      "Grondwatertrap onbekend; de strengste kritische concentratie (0,1 mg P/l) is gebruikt.",
    )
  }
  const c_p_env = criticalConcentration(ghg ?? 0)

  const p_cc = latest(sorted, "a_p_cc")
  const psd = saturation.psd?.value
  if (!p_cc || p_cc.value <= 0 || psd === undefined || psd <= 0 || psd >= 100) {
    warnings.push(
      "P-CaCl2 of fosfaatverzadigingsgraad ontbreekt; de grenswaarde van 25% is gebruikt.",
    )
    return {
      value: PSD_THRESHOLD_DEFAULT,
      source: "default_25",
      psd_env: null,
      psd_agronomic,
      ghg,
      c_p_env,
      k_l: null,
      warnings,
    }
  }

  const c_p = (p_cc.value * 0.1) / 31 // mol / m³
  const k_l = (beta_max * psd) / (c_p * alpha_max * (100 - psd))
  const x = alpha_max * k_l * (c_p_env / 31)
  const psd_env = (100 * x) / (beta_max + x)
  return {
    value: psd_agronomic === null ? psd_env : Math.min(psd_env, psd_agronomic),
    source: "field",
    psd_env,
    psd_agronomic,
    ghg,
    c_p_env,
    k_l,
    warnings,
  }
}
