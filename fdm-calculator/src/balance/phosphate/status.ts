import type {
  PhosphateBalanceField,
  PhosphateStatus,
  PhosphateVerdict,
  ValueWithRange,
} from "./types"
import {
  classifyYears,
  kgP2O5PerPsdPoint,
  P_AL_GOOD_MAX,
  P_AL_GOOD_MIN,
  yearsTo,
} from "./projection"

/**
 * Rules of the phosphate status assessment.
 *
 * DRAFT: the margins and horizons are to be reviewed with the researchers.
 */
export const PHOSPHATE_STATUS_RULES = {
  /**
   * Agronomic minimum of P-AL (mg P2O5 / 100 g): below it, building up is needed for the yield.
   * Lower bound of the class "Goed" (target value 35) of the Handboek Bodem en Bemesting.
   */
  p_al_min: P_AL_GOOD_MIN,
  /** P-AL above which the stock is high (mg P2O5 / 100 g); the bound when the PSD is not available */
  p_al_high: P_AL_GOOD_MAX,
  /** Margin around a P-AL bound that counts as "close enough" (mg P2O5 / 100 g) */
  p_al_margin: 3,
  /** Margin around the PSD threshold that counts as "close enough" (percentage points) */
  psd_margin: 2,
  /** Outside the zone: reaching it within this many years is good, later needs attention */
  reach_horizon: 10,
  /** Inside the zone: staying in it longer than this many years is good */
  stay_horizon: 20,
  /** Inside the zone: leaving it within this many years needs adjustment */
  leave_soon: 5,
  /** Effective balance (kg P2O5 / ha / year) below which the status is considered stable */
  stable_balance: 1,
} as const

/** Source code of NMI soil estimates: not a laboratory measurement. */
const NMI_ESTIMATE_SOURCE = "nl-other-nmi"

/** One soil P indicator with its projected change per year. */
type Track = {
  indicator: "psd" | "p_al"
  current: number
  /** Change per year at the long-term average balance */
  delta: ValueWithRange
  /** Effective balance (kg P2O5 / ha / year) that changes the indicator by one unit per year */
  kgPerUnit: number
}

/** Years until `track` reaches `to`, with the range from the uncertainty of the change per year. */
function yearsRange(track: Track, to: number): ValueWithRange | null {
  const [value, ...others] = [track.delta.value, track.delta.min, track.delta.max].map((d) =>
    yearsTo(track.current, to, d),
  )
  if (value === null || value === undefined) return null
  const all = [value, ...others.filter((v): v is number => v !== null)]
  return { value, min: Math.min(...all), max: Math.max(...all) }
}

/**
 * Assesses the soil phosphorus of a field against its target zone, from the long-term average
 * balance: where the status is (below, in or above the zone), which way it goes and how long it takes.
 *
 * The target zone has an agronomic lower bound (P-AL ≥ 35, enough for the yield) and an
 * environmental upper bound (PSD ≤ the field threshold). When the PSD is not available or not
 * reliable for the soil type, P-AL 35–45 is used as the zone. Being within the margin of a bound
 * counts as reaching it: getting close is enough.
 *
 * - Above the zone (PSD above the threshold): `afbouwen`. The environment comes first, also when
 *   P-AL is not high (`conflict`). When P-AL is also below 35 the aim is `onderhouden`: neither
 *   building up nor mining; the app shows the effect of the balance on both.
 * - Below the zone (P-AL < 35): `opbouwen`.
 * - In the zone: `onderhouden`; any direction is fine as long as the status stays in the zone.
 *
 * Verdict: outside the zone `good` when the zone is reached within `reach_horizon` years, `attention`
 * when the direction is right but slower, `adjust` when the direction is wrong or there is no change.
 * Inside the zone `good`, unless the PSD crosses the threshold: then `attention` when that happens
 * within `stay_horizon` years and `adjust` within `leave_soon` years. A P-AL that declines towards
 * the lower bound keeps the verdict `good` (P-AL in the zone is "Goed" for the crop); its years are
 * still reported.
 *
 * DRAFT for discussion: rules and parameters in `PHOSPHATE_STATUS_RULES`.
 *
 * @param balance - The phosphate balance of the field.
 * @returns The status.
 * @alpha
 */
export function assessPhosphateStatus(balance: PhosphateBalanceField): PhosphateStatus {
  const R = PHOSPHATE_STATUS_RULES
  const { projection, saturation, long_term } = balance
  // Results cached by an earlier build may lack the long-term fertilizer average
  const fertilizers = Number.isFinite(long_term.fertilizers)
    ? long_term.fertilizers
    : balance.supply.fertilizers.total
  const status: PhosphateStatus = {
    aim: null,
    binding: null,
    conflict: false,
    direction: "stable",
    verdict: "unknown",
    years: null,
    years_class: "not_reached",
    p_al_min_years: null,
    balance_needed: null,
    has_fertilizer_input: fertilizers > 0,
    indicative: true,
  }
  if (!projection) return status

  const effective = projection.balance_effective_per_year
  status.direction =
    effective > R.stable_balance ? "up" : effective < -R.stable_balance ? "down" : "stable"

  const pAl: Track | null = projection.p_al
    ? {
        indicator: "p_al",
        current: projection.p_al.current,
        delta: projection.p_al.delta_per_year,
        kgPerUnit: projection.p_al.buffer.value,
      }
    : null
  const threshold = projection.psd?.threshold.value ?? null
  const psd: Track | null =
    projection.psd && threshold !== null && saturation.psd_valid && saturation.psc
      ? {
          indicator: "psd",
          current: projection.psd.current.value,
          delta: {
            value: projection.psd.delta_per_year,
            min: projection.psd.delta_per_year,
            max: projection.psd.delta_per_year,
          },
          kgPerUnit: kgP2O5PerPsdPoint(
            saturation.psc,
            projection.a_density_sa.value,
            projection.depth.value,
          ),
        }
      : null
  if (!pAl && !psd) return status

  const sources = saturation.analysis_sources
  status.indicative =
    !psd ||
    saturation.soil_note !== null ||
    projection.psd?.threshold.source !== "field" ||
    (sources.length > 0 && sources.every((s) => s === NMI_ESTIMATE_SOURCE))

  if (pAl && pAl.current >= R.p_al_min && status.direction === "down") {
    status.p_al_min_years = yearsRange(pAl, R.p_al_min)
  }

  /** Long-term average balance at which `track` reaches `edge` in `horizon` years. */
  const needed = (track: Track, edge: number, horizon: number, limit: "max" | "min") => {
    const effectiveNeeded = ((edge - track.current) / horizon) * track.kgPerUnit
    // balance = effective − leaching + fixation (leaching is negative)
    const value = effectiveNeeded - long_term.leaching + projection.fixation
    const withoutFertilizers = long_term.balance - fertilizers
    return { value, limit, fertilizers: Math.max(0, value - withoutFertilizers) }
  }

  const psdAbove = psd !== null && threshold !== null && psd.current > threshold
  const pAlLow = pAl !== null && pAl.current < R.p_al_min
  const pAlHigh = pAl !== null && pAl.current > R.p_al_high

  // Above the zone while P-AL is low: no single direction is right
  if (psd && psdAbove && pAlLow) {
    status.aim = "onderhouden"
    status.binding = "psd"
    status.conflict = true
    status.verdict = status.direction === "up" ? "adjust" : "attention"
    return status
  }

  // Outside the zone: towards which bound
  let target: { track: Track; edge: number; side: "upper" | "lower" } | null = null
  if (psd && threshold !== null && psdAbove) {
    status.aim = "afbouwen"
    status.conflict = pAl !== null && !pAlHigh
    target = { track: psd, edge: threshold + R.psd_margin, side: "upper" }
  } else if (pAl && pAlLow) {
    status.aim = "opbouwen"
    target = { track: pAl, edge: R.p_al_min - R.p_al_margin, side: "lower" }
  } else if (pAl && !psd && pAlHigh) {
    status.aim = "afbouwen"
    target = { track: pAl, edge: R.p_al_high + R.p_al_margin, side: "upper" }
  }

  if (target) {
    const { track, edge, side } = target
    status.binding = track.indicator
    const toward = side === "upper" ? "down" : "up"
    const away = side === "upper" ? "up" : "down"
    const withinMargin = side === "upper" ? track.current <= edge : track.current >= edge
    if (withinMargin && status.direction !== away) {
      status.verdict = "good"
      status.years = { value: 0, min: 0, max: 0 }
      status.years_class = "reached"
      return status
    }
    if (status.direction === toward) {
      status.years = yearsRange(track, edge)
      status.years_class = classifyYears(status.years?.value ?? null)
      status.verdict =
        status.years !== null && status.years.value <= R.reach_horizon ? "good" : "attention"
    } else {
      status.verdict = "adjust"
    }
    if (status.verdict !== "good") {
      status.balance_needed = needed(track, edge, R.reach_horizon, side === "upper" ? "max" : "min")
    }
    return status
  }

  // In the zone: which bound is crossed first in the direction of change
  status.aim = "onderhouden"
  const candidates: { track: Track; edge: number; side: "upper" | "lower" }[] = []
  if (status.direction === "up") {
    if (psd && threshold !== null) {
      candidates.push({ track: psd, edge: threshold + R.psd_margin, side: "upper" })
    } else if (pAl) {
      candidates.push({ track: pAl, edge: R.p_al_high + R.p_al_margin, side: "upper" })
    }
  } else if (status.direction === "down" && pAl) {
    candidates.push({ track: pAl, edge: R.p_al_min - R.p_al_margin, side: "lower" })
  }
  let first: { candidate: (typeof candidates)[number]; years: ValueWithRange } | null = null
  for (const candidate of candidates) {
    const years = yearsRange(candidate.track, candidate.edge)
    if (years && (!first || years.value < first.years.value)) first = { candidate, years }
  }
  if (!first) {
    status.verdict = "good"
    return status
  }
  status.binding = first.candidate.track.indicator
  status.years = first.years
  status.years_class = classifyYears(first.years.value)
  // P-AL in the zone is good for the crop (class "Goed" of the Handboek Bodem en Bemesting): the
  // years until it leaves the zone are reported, but only the PSD can lower the verdict here
  if (first.candidate.track.indicator === "p_al") {
    status.verdict = "good"
    return status
  }
  status.verdict =
    first.years.value > R.stay_horizon
      ? "good"
      : first.years.value >= R.leave_soon
        ? "attention"
        : "adjust"
  if (status.verdict !== "good") {
    status.balance_needed = needed(
      first.candidate.track,
      first.candidate.edge,
      R.stay_horizon,
      first.candidate.side === "upper" ? "max" : "min",
    )
  }
  return status
}

/** Order of the verdicts from most to least urgent (for sorting lists). */
export const PHOSPHATE_VERDICT_ORDER: PhosphateVerdict[] = [
  "adjust",
  "attention",
  "good",
  "unknown",
]
