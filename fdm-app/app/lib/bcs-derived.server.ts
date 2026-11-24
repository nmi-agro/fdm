import type { CurrentSoilData, FdmType } from "@nmi-agro/fdm-core"
import {
  type BcsLabContext,
  type CultivationForCropPlan,
  deriveBcsLabContext,
} from "@nmi-agro/fdm-calculator"
import { getCultivations, getCurrentSoilData } from "@nmi-agro/fdm-core"

export interface DerivedBcsContext {
  labContext: BcsLabContext | null
  labAnalysisDate: Date | null
}

/** Raw inputs needed to derive a BCS lab context for any sampling date on a field. */
export interface BcsRawInputs {
  a_ph_cc: number | null
  a_som_loi: number | null
  b_soiltype_agr: string | null
  a_clay_mi: number | null
  labAnalysisDate: Date | null
  cultivations: CultivationForCropPlan[]
}

/**
 * Builds the BCS raw inputs of a field from data that was already read.
 *
 * Use this when the soil data and cultivations of many fields come from one farm-level read
 * (`getCurrentSoilDataForFarm`, `getCultivationsForFarm`), both without a timeframe, so that
 * the result matches {@link fetchBcsRawInputs}.
 */
export function bcsRawInputsFromData(
  soilData: CurrentSoilData,
  cultivations: CultivationForCropPlan[],
): BcsRawInputs {
  const get = (param: string) => soilData.find((d) => d.parameter === param)?.value

  const phItem = soilData.find((d) => d.parameter === "a_ph_cc")
  const somItem = soilData.find((d) => d.parameter === "a_som_loi")

  const a_ph_cc = (phItem?.value as number | null | undefined) ?? null
  const a_som_loi = (somItem?.value as number | null | undefined) ?? null

  const b_soiltype_agr = (get("b_soiltype_agr") as string | null | undefined) ?? null
  const a_clay_mi = (get("a_clay_mi") as number | null | undefined) ?? null

  // Only show an analysis date when both pH and SOM come from the same single record
  const phSource = phItem?.sources.length === 1 ? phItem.sources[0] : null
  const somSource = somItem?.sources.length === 1 ? somItem.sources[0] : null
  const sharedAnalysis = phSource && somSource && phSource.a_id === somSource.a_id ? phSource : null
  const labAnalysisDate = sharedAnalysis?.b_sampling_date
    ? new Date(sharedAnalysis.b_sampling_date)
    : null

  return {
    a_ph_cc,
    a_som_loi,
    b_soiltype_agr,
    a_clay_mi,
    labAnalysisDate,
    // The cultivations only matter when there is a pH or SOM value to derive a context from
    cultivations: a_ph_cc != null || a_som_loi != null ? cultivations : [],
  }
}

export async function fetchBcsRawInputs(
  fdm: FdmType,
  principal_id: string,
  b_id: string,
): Promise<BcsRawInputs> {
  // Collect raw soil data — same source as the soil page
  const soilData = await getCurrentSoilData(fdm, principal_id, b_id)
  const raw = bcsRawInputsFromData(Array.isArray(soilData) ? soilData : [], [])

  if (raw.a_ph_cc == null && raw.a_som_loi == null) return raw

  let cultivations: CultivationForCropPlan[] = []
  try {
    cultivations = await getCultivations(fdm, principal_id, b_id)
  } catch {
    cultivations = []
  }
  return { ...raw, cultivations }
}

export function deriveBcsContextFromRawInputs(raw: BcsRawInputs, bcsDate: Date): DerivedBcsContext {
  if (raw.a_ph_cc == null && raw.a_som_loi == null) {
    return { labContext: null, labAnalysisDate: null }
  }

  const labContext = deriveBcsLabContext(
    {
      a_ph_cc: raw.a_ph_cc,
      a_som_loi: raw.a_som_loi,
      b_soiltype_agr: raw.b_soiltype_agr,
      a_clay_mi: raw.a_clay_mi,
    },
    raw.cultivations,
    bcsDate.getFullYear(),
  )

  return { labContext, labAnalysisDate: raw.labAnalysisDate }
}

export async function deriveBcsScores(
  fdm: FdmType,
  principal_id: string,
  b_id: string,
  bcsDate: Date,
): Promise<DerivedBcsContext> {
  const raw = await fetchBcsRawInputs(fdm, principal_id, b_id)
  return deriveBcsContextFromRawInputs(raw, bcsDate)
}
