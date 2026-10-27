import Decimal from "decimal.js"
import type {
  PhosphateBalance,
  PhosphateBalanceField,
  PhosphateFrame,
  PhosphateBalanceInput,
  PhosphateCultivationDetail,
  PhosphateFertilizerDetail,
  PhosphateFieldInput,
} from "./types"
import { getPhosphateSoilTypeParameters } from "./alpha-max"
import { calculatePhosphateProjection } from "./projection"
import { calculatePhosphateSaturation, calculatePhosphateSaturationThreshold } from "./saturation"

type FieldCalculationInput = {
  fieldInput: PhosphateFieldInput
  fertilizerDetails: PhosphateFertilizerDetail[]
  cultivationDetails: PhosphateCultivationDetail[]
  timeFrame: { start: Date; end: Date }
}

/** Phosphate supply by fertilizers: amount (kg / ha) × p_p_rt (g P2O5 / kg) / 1000, at 100% (no working coefficient). */
function calculateSupplyByFertilizers(
  applications: PhosphateFieldInput["fertilizerApplications"],
  details: Map<string, PhosphateFertilizerDetail>,
) {
  const totals = {
    mineral: new Decimal(0),
    manure: new Decimal(0),
    compost: new Decimal(0),
    other: new Decimal(0),
  }
  const items = applications.map((application) => {
    const detail = details.get(application.p_id_catalogue)
    if (!detail) {
      throw new Error(
        `Fertilizer application ${application.p_app_id} has no fertilizerDetails for fertilizer ${application.p_id_catalogue}`,
      )
    }
    const value = new Decimal(application.p_app_amount ?? 0)
      .times(detail.p_p_rt ?? 0)
      .dividedBy(1000)
    const type =
      detail.p_type === "mineral" || detail.p_type === "manure" || detail.p_type === "compost"
        ? detail.p_type
        : "other"
    totals[type] = totals[type].add(value)
    return { id: application.p_app_id, value }
  })
  const total = totals.mineral.add(totals.manure).add(totals.compost).add(totals.other)
  return { total, totals, items }
}

/**
 * Phosphate removal by harvests: yield (kg DM / ha) × P content (g P2O5 / kg DM) / 1000.
 * The P content of the harvest's own analysis is used when present, otherwise the catalogue value.
 */
function calculateRemovalByHarvests(
  input: PhosphateFieldInput,
  details: Map<string, PhosphateCultivationDetail>,
) {
  const items = input.harvests.map((harvest) => {
    const cultivation = input.cultivations.find((c) => c.b_lu === harvest.b_lu)
    const detail = cultivation ? details.get(cultivation.b_lu_catalogue) : undefined
    if (!detail) {
      throw new Error(`Harvest ${harvest.b_id_harvesting} has no corresponding cultivation details`)
    }
    const analyses = harvest.harvestable.harvestable_analyses
    const values = (analyses.length > 0 ? analyses : [{}]).map(
      (analysis: { b_lu_yield?: number | null; b_lu_p_harvestable?: number | null }) => {
        const b_lu_yield = analysis.b_lu_yield ?? detail.b_lu_yield ?? 0
        const b_lu_p_harvestable = analysis.b_lu_p_harvestable ?? detail.b_lu_p_harvestable ?? 0
        return new Decimal(b_lu_yield).times(b_lu_p_harvestable).dividedBy(1000).times(-1)
      },
    )
    const value = values.reduce((a, b) => a.add(b), new Decimal(0)).dividedBy(values.length)
    return { id: harvest.b_id_harvesting, value }
  })
  return { total: items.reduce((a, b) => a.add(b.value), new Decimal(0)), items }
}

/**
 * Phosphate removal by crop residues, only when they are removed (`m_cropresidue === false`):
 * average yield / harvest index × (1 − harvest index) × b_lu_p_residue / 1000.
 */
function calculateRemovalByResidues(
  input: PhosphateFieldInput,
  details: Map<string, PhosphateCultivationDetail>,
) {
  const items = input.cultivations.map((cultivation) => {
    const detail = details.get(cultivation.b_lu_catalogue)
    if (!detail || cultivation.m_cropresidue !== false || !detail.b_lu_hi) {
      return { id: cultivation.b_lu, value: new Decimal(0) }
    }
    const yields = input.harvests
      .filter((h) => h.b_lu === cultivation.b_lu)
      .map(
        (h) =>
          h.harvestable.harvestable_analyses.find((a) => a.b_lu_yield != null)?.b_lu_yield ??
          detail.b_lu_yield ??
          0,
      )
    const b_lu_yield =
      yields.length > 0
        ? yields.reduce((a, b) => a.add(b), new Decimal(0)).dividedBy(yields.length)
        : new Decimal(detail.b_lu_yield ?? 0)
    const value = b_lu_yield
      .dividedBy(detail.b_lu_hi)
      .times(new Decimal(1).minus(detail.b_lu_hi))
      .times(detail.b_lu_p_residue ?? 0)
      .dividedBy(1000)
      .times(-1)
    return { id: cultivation.b_lu, value }
  })
  return { total: items.reduce((a, b) => a.add(b.value), new Decimal(0)), items }
}

/**
 * Determines the Opbouwen / Onderhouden / Afbouwen frame from P-AL, as proposed in the issue:
 * P-AL < 25 opbouwen, 25–45 onderhouden, > 45 afbouwen. The minimum desirable balance is the fixation
 * (offtake + fixation) when building up or maintaining; when reducing, a deficit is acceptable.
 *
 * DRAFT: the same P-AL bands are used for grassland and arable land.
 *
 * @param a_p_al - P-AL (mg P2O5 / 100 g), or `null`.
 * @param fixation - Fixation (kg P2O5 / ha / year).
 * @returns The frame.
 */
export function determinePhosphateFrame(a_p_al: number | null, fixation: number): PhosphateFrame {
  if (a_p_al === null) return { name: null, a_p_al: null, target_balance_min: null }
  if (a_p_al < 25) return { name: "opbouwen", a_p_al, target_balance_min: fixation }
  if (a_p_al <= 45) return { name: "onderhouden", a_p_al, target_balance_min: fixation }
  return { name: "afbouwen", a_p_al, target_balance_min: null }
}

/**
 * Calculates the phosphate balance of one field (kg P2O5 / ha for the timeframe), the phosphorus
 * saturation of the topsoil and the effect of the balance on the soil phosphorus stock.
 *
 * PROTOTYPE for discussion: no deposition, mineralisation or leaching terms yet; fixation is used in the
 * projection, not in the balance itself.
 *
 * @param input - The field input with the fertilizer and cultivation details and the timeframe.
 * @returns The phosphate balance of the field.
 * @alpha
 */
export function calculatePhosphateBalanceField(
  input: FieldCalculationInput,
): PhosphateBalanceField {
  const { fieldInput, timeFrame } = input
  const { field } = fieldInput
  const isGrassland = fieldInput.cultivations.some((c) => c.b_lu_croprotation === "grass")
  const saturation = calculatePhosphateSaturation(fieldInput.soilAnalyses, isGrassland)
  const frame = determinePhosphateFrame(
    saturation.a_p_al,
    getPhosphateSoilTypeParameters(saturation.b_soiltype_agr).fixation,
  )

  if (field.b_bufferstrip) {
    return {
      b_id: field.b_id,
      b_area: field.b_area ?? 0,
      balance: 0,
      supply: {
        total: 0,
        fertilizers: { total: 0, mineral: 0, manure: 0, compost: 0, other: 0, applications: [] },
      },
      removal: {
        total: 0,
        harvests: { total: 0, harvests: [] },
        residues: { total: 0, cultivations: [] },
      },
      frame,
      saturation,
      projection: null,
    }
  }

  const fertilizerDetails = new Map(input.fertilizerDetails.map((d) => [d.p_id_catalogue, d]))
  const cultivationDetails = new Map(input.cultivationDetails.map((d) => [d.b_lu_catalogue, d]))

  const fertilizers = calculateSupplyByFertilizers(
    fieldInput.fertilizerApplications,
    fertilizerDetails,
  )
  const harvests = calculateRemovalByHarvests(fieldInput, cultivationDetails)
  const residues = calculateRemovalByResidues(fieldInput, cultivationDetails)
  const removal = harvests.total.add(residues.total)
  const balance = fertilizers.total.add(removal)

  const years = Math.max(
    (timeFrame.end.getTime() - timeFrame.start.getTime()) / (365.25 * 24 * 3600 * 1000),
    1 / 365.25,
  )
  const threshold = calculatePhosphateSaturationThreshold(
    saturation,
    fieldInput.soilAnalyses,
    isGrassland,
  )
  const projection = calculatePhosphateProjection(
    balance.dividedBy(years).toNumber(),
    saturation,
    threshold,
    fieldInput.soilAnalyses,
    isGrassland,
  )

  const toItems = (items: { id: string; value: Decimal }[]) =>
    items.map((item) => ({ id: item.id, value: item.value.toNumber() }))
  return {
    b_id: field.b_id,
    b_area: field.b_area ?? 0,
    balance: balance.toNumber(),
    supply: {
      total: fertilizers.total.toNumber(),
      fertilizers: {
        total: fertilizers.total.toNumber(),
        mineral: fertilizers.totals.mineral.toNumber(),
        manure: fertilizers.totals.manure.toNumber(),
        compost: fertilizers.totals.compost.toNumber(),
        other: fertilizers.totals.other.toNumber(),
        applications: toItems(fertilizers.items),
      },
    },
    removal: {
      total: removal.toNumber(),
      harvests: { total: harvests.total.toNumber(), harvests: toItems(harvests.items) },
      residues: { total: residues.total.toNumber(), cultivations: toItems(residues.items) },
    },
    frame,
    saturation,
    projection,
  }
}

/**
 * Calculates the phosphate balance of a farm as the area-weighted average per ha of its fields.
 * Buffer strips are excluded from the farm average.
 *
 * PROTOTYPE for discussion: not cached yet.
 *
 * @param input - The farm input.
 * @returns The farm balance and the results per field.
 * @alpha
 */
export function calculatePhosphateBalance(input: PhosphateBalanceInput): PhosphateBalance {
  const fields = input.fields.map((fieldInput) =>
    calculatePhosphateBalanceField({
      fieldInput,
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: input.timeFrame,
    }),
  )
  const counted = fields.filter((f, i) => !input.fields[i].field.b_bufferstrip && f.b_area > 0)
  const area = counted.reduce((a, f) => a.add(f.b_area), new Decimal(0))
  const weighted = (pick: (f: PhosphateBalanceField) => number) =>
    area.isZero()
      ? 0
      : counted
          .reduce((a, f) => a.add(new Decimal(pick(f)).times(f.b_area)), new Decimal(0))
          .dividedBy(area)
          .toNumber()
  return {
    balance: weighted((f) => f.balance),
    supply: weighted((f) => f.supply.total),
    removal: weighted((f) => f.removal.total),
    fields,
  }
}
