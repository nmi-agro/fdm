import type { PhosphateSaturation, PhosphateSoilAnalysis } from "./types"
import { getPhosphateSoilTypeParameters } from "./alpha-max"

/** Root mean squared error (% PSD) of the P-AL → PSD regression of van Doorn (2026), Fig. S5.7. */
const PSD_FROM_P_AL_RMSE = 10.1

type SoilInput = Partial<PhosphateSoilAnalysis>

function sortByDateDesc(soilAnalyses: SoilInput[]): SoilInput[] {
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
 * DRAFT for discussion. The order of preference is:
 * 1. `a_p_ox`, `a_fe_ox` and `a_al_ox` of the most recent soil analysis that has all three
 *    (measured, or estimated by the NMI API): `PSC = alpha_max · (Fe-ox + Al-ox)`, `PSD = P-ox / PSC · 100`.
 * 2. `a_p_sg` (PSD as delivered by the laboratory or the NMI API).
 * 3. An estimate from `a_p_al` with the PSC from the oxalate data or, when missing, the soil-type
 *    defaults, using the regression of van Doorn (2026).
 *
 * The ranges follow from the `alpha_max` range of the soil type (and, for option 3, the regression error).
 *
 * @param soilAnalyses - The soil analyses of the field.
 * @param isGrassland - Whether the field is grassland (sampled 0–10 cm) rather than arable land (0–25 cm).
 * @returns The phosphorus saturation with its source and uncertainty.
 * @alpha
 */
export function calculatePhosphateSaturation(
  soilAnalyses: SoilInput[],
  isGrassland: boolean,
): PhosphateSaturation {
  const sorted = sortByDateDesc(soilAnalyses)
  const soiltype = latest(sorted, "b_soiltype_agr")
  const params = getPhosphateSoilTypeParameters(soiltype?.value)
  const [alphaLow, alphaHigh] = params.alpha_max_range
  const warnings: string[] = []
  if (!params.psd_valid) {
    warnings.push(params.note)
  }

  const result = (
    source: PhosphateSaturation["source"],
    sumFeAl: number | null,
    psd: PhosphateSaturation["psd"],
    a_p_ox: number | null,
    analysisSources: (string | null | undefined)[],
  ): PhosphateSaturation => ({
    source,
    analysis_sources: [...new Set(analysisSources.filter((x): x is string => !!x))],
    b_soiltype_agr: soiltype?.value ?? null,
    alpha_max: params.alpha_max,
    psc:
      sumFeAl === null
        ? null
        : {
            value: params.alpha_max * sumFeAl,
            min: alphaLow * sumFeAl,
            max: alphaHigh * sumFeAl,
          },
    psd,
    a_p_ox,
    psd_valid: params.psd_valid,
    warnings,
  })

  // 1. Oxalate triplet from one soil analysis
  const oxalate = sorted.find((a) => a.a_p_ox != null && a.a_fe_ox != null && a.a_al_ox != null)
  if (oxalate) {
    const sumFeAl = (oxalate.a_fe_ox as number) + (oxalate.a_al_ox as number)
    const a_p_ox = oxalate.a_p_ox as number
    if (sumFeAl <= 0) {
      warnings.push("Fe-ox + Al-ox is zero; the PSD cannot be calculated.")
      return result("missing", null, null, a_p_ox, [oxalate.a_source])
    }
    return result(
      "oxalate",
      sumFeAl,
      {
        value: (a_p_ox / (params.alpha_max * sumFeAl)) * 100,
        min: (a_p_ox / (alphaHigh * sumFeAl)) * 100,
        max: (a_p_ox / (alphaLow * sumFeAl)) * 100,
      },
      a_p_ox,
      [oxalate.a_source],
    )
  }

  // Fe-ox and Al-ox: from the same analysis when possible, otherwise the soil-type defaults
  const feAl = sorted.find((a) => a.a_fe_ox != null && a.a_al_ox != null)
  const layer = isGrassland ? 0 : 1
  const sumFeAl = feAl
    ? (feAl.a_fe_ox as number) + (feAl.a_al_ox as number)
    : params.a_fe_ox_default[layer] + params.a_al_ox_default[layer]
  if (!feAl) {
    warnings.push("No Fe-ox and Al-ox available; the soil-type default PSC is used.")
  }
  const psc = params.alpha_max * sumFeAl

  // 2. PSD as delivered (assumed to be based on alpha_max = 0.5)
  const p_sg = latest(sorted, "a_p_sg")
  if (p_sg) {
    const value = p_sg.value
    return result(
      "a_p_sg",
      sumFeAl,
      { value, min: (value * 0.5) / alphaHigh, max: (value * 0.5) / alphaLow },
      (value / 100) * psc,
      [p_sg.analysis.a_source, feAl?.a_source],
    )
  }

  // 3. Estimate from P-AL
  const p_al = latest(sorted, "a_p_al")
  if (p_al && p_al.value > 0 && psc > 0) {
    warnings.push("The PSD is estimated from P-AL (regression of van Doorn 2026, RMSE 10 %).")
    const value = estimatePsdFromPAl(p_al.value, 0.5 * sumFeAl)
    return result(
      "estimated_from_p_al",
      sumFeAl,
      {
        value,
        min: Math.max(0, (value * 0.5) / alphaHigh - PSD_FROM_P_AL_RMSE),
        max: (value * 0.5) / alphaLow + PSD_FROM_P_AL_RMSE,
      },
      (value / 100) * psc,
      [p_al.analysis.a_source, feAl?.a_source],
    )
  }

  warnings.push("No P-ox, PSD or P-AL available; the PSD cannot be determined.")
  return result("missing", sumFeAl, null, null, [feAl?.a_source])
}
