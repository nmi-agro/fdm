import type { FieldExclusionReason, PhosphateSaturationSource } from "@nmi-agro/fdm-calculator"
import {
  assessPhosphateStatus,
  PHOSPHATE_STATUS_RULES,
  type PhosphateBalanceField,
  type PhosphateStatus,
  type PhosphateVerdict,
  type ValueWithRange,
  type YearsClass,
} from "@nmi-agro/fdm-calculator/browser"

/**
 * Formats a number with Dutch notation (decimal comma, dot as thousands separator).
 *
 * @param value - The number to format.
 * @param decimals - Number of decimals (default 0).
 * @returns The formatted number, or "–" when the value is missing.
 */
export function formatNumberNl(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–"
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Formats a field area in Dutch notation, e.g. "9,49 ha".
 *
 * @param area - Area (ha).
 * @returns The formatted area.
 */
export function formatAreaHa(area: number | null | undefined): string {
  return `${formatNumberNl(area, 2)} ha`
}

/** Unit of the phosphate balance terms. */
export const PHOSPHATE_UNIT = "kg P₂O₅/ha"

/** Horizon (years) of the projection; beyond it the trend is shown as "> 20 jaar". */
export const PHOSPHATE_HORIZON_YEARS = PHOSPHATE_STATUS_RULES.stay_horizon

/** P-AL bounds (mg P₂O₅ / 100 g): below 25 low (build up), above 45 high. */
export const P_AL_LOW = PHOSPHATE_STATUS_RULES.p_al_min
export const P_AL_HIGH = PHOSPHATE_STATUS_RULES.p_al_high

/**
 * The status of a field: position relative to the target zone, direction and speed. Derived from
 * the balance on every read, so tuning the rules needs no recalculation of cached balances.
 *
 * @param balance - The phosphate balance of the field.
 * @returns The status.
 */
export function getPhosphateStatus(balance: PhosphateBalanceField): PhosphateStatus {
  return assessPhosphateStatus(balance)
}

/** Dutch label and short explanation per verdict (for chips, legends and screen readers). */
export const PHOSPHATE_VERDICT_TEXT: Record<
  PhosphateVerdict,
  { label: string; description: string }
> = {
  good: {
    label: "Goed",
    description: `In de streefzone en dat blijft zo, of de zone wordt binnen ${PHOSPHATE_STATUS_RULES.reach_horizon} jaar bereikt`,
  },
  attention: {
    label: "Aandacht",
    description: `Goede richting maar traag (> ${PHOSPHATE_STATUS_RULES.reach_horizon} jaar), of binnen ${PHOSPHATE_STATUS_RULES.stay_horizon} jaar uit de streefzone`,
  },
  adjust: {
    label: "Bijsturen",
    description: `Verkeerde richting, of binnen ${PHOSPHATE_STATUS_RULES.leave_soon} jaar uit de streefzone`,
  },
  unknown: {
    label: "Onbekend",
    description: "Geen P-AL en geen fosfaatverzadiging bekend",
  },
}

/** Dutch name of a soil P indicator. */
export function formatIndicator(indicator: "psd" | "p_al"): string {
  return indicator === "psd" ? "PSD" : "P-AL"
}

/**
 * Dutch label of the aim with the indicator that sets it, e.g. "Afbouwen voor het milieu (PSD)".
 *
 * @param status - The status of the field.
 * @returns The label, or "–" without an aim.
 */
export function formatPhosphateAim(status: PhosphateStatus): string {
  if (!status.aim) return "–"
  const aim = { opbouwen: "Opbouwen", onderhouden: "Onderhouden", afbouwen: "Afbouwen" }[status.aim]
  if (status.aim === "onderhouden" && !status.conflict) return aim
  if (status.binding === "psd") return `${aim} voor het milieu (PSD)`
  if (status.binding === "p_al") return `${aim} voor de opbrengst (P-AL)`
  return aim
}

/** Direction of the soil P status and what it means for the aim of the field. */
export type PhosphateDirectionText = {
  /** "Stijgt", "Daalt" or "Stabiel" */
  verb: string
  /** What the direction means for the aim, e.g. "naar het doel" (empty when unknown) */
  meaning: string
  /** Whether the direction helps (`toward`), hurts (`away`) or is fine either way (`neutral`) */
  tone: "toward" | "away" | "neutral"
}

/**
 * Describes the direction of the soil P status against the aim of the field, so a rising arrow is
 * never read without its meaning: "Stijgt, van het doel af" on a field above the environmental
 * threshold, "Stijgt, blijft in de streefzone" on a field inside the zone.
 *
 * @param status - The status of the field.
 * @returns The direction and its meaning.
 */
export function describePhosphateDirection(status: PhosphateStatus): PhosphateDirectionText {
  const verb = { up: "Stijgt", down: "Daalt", stable: "Stabiel" }[status.direction]
  if (status.verdict === "unknown" || !status.aim) return { verb, meaning: "", tone: "neutral" }
  if (status.aim === "afbouwen" || status.aim === "opbouwen") {
    const toward = status.aim === "afbouwen" ? "down" : "up"
    if (status.direction === toward) return { verb, meaning: "naar het doel", tone: "toward" }
    if (status.direction === "stable") {
      return {
        verb,
        meaning: status.aim === "afbouwen" ? "blijft boven het doel" : "blijft onder het doel",
        tone: "away",
      }
    }
    return { verb, meaning: "van het doel af", tone: "away" }
  }
  if (status.conflict) {
    return status.direction === "up"
      ? { verb, meaning: "PSD verder boven de milieugrens", tone: "away" }
      : { verb, meaning: "", tone: "neutral" }
  }
  if (status.verdict === "good")
    return { verb, meaning: "blijft in de streefzone", tone: "neutral" }
  return {
    verb,
    meaning: status.binding === "psd" ? "richting de milieugrens" : "richting de ondergrens",
    tone: "away",
  }
}

/**
 * Dutch label of a years class.
 *
 * @param yearsClass - The class.
 * @returns The label.
 */
export function formatYearsClass(yearsClass: YearsClass): string {
  switch (yearsClass) {
    case "reached":
      return "nu al bereikt"
    case "lt_5":
      return "< 5 jaar"
    case "5_10":
      return "5–10 jaar"
    case "10_20":
      return "10–20 jaar"
    case "gt_20":
      return "> 20 jaar"
    case "not_reached":
      return "niet bij de huidige balans"
  }
}

/**
 * Dutch band of years, never a single number: the range from the uncertainty of the soil buffer
 * when known ("circa 8–12 jaar"), otherwise the years class ("5–10 jaar").
 *
 * @param years - Years with range, or `null`.
 * @returns The band, or `null` without years.
 */
export function formatYearsBand(years: ValueWithRange | null): string | null {
  if (!years) return null
  if (years.value <= 0) return "binnen de marge"
  const horizon = PHOSPHATE_HORIZON_YEARS
  const low = Math.max(1, Math.round(years.min))
  const high = Math.round(years.max)
  if (low > horizon) return `> ${horizon} jaar`
  if (high - low >= 2) {
    return high > horizon ? `circa ${low} jaar of langer` : `circa ${low}–${high} jaar`
  }
  if (years.value < 5) return "< 5 jaar"
  if (years.value < 10) return "5–10 jaar"
  if (years.value <= horizon) return "10–20 jaar"
  return `> ${horizon} jaar`
}

/**
 * Dutch description of the years in the long-term average balance, e.g. "2022–2026, 5 jaar".
 *
 * @param years - The calendar years with data.
 * @returns The description, or an empty string without years.
 */
export function formatLongTermYears(years: number[]): string {
  if (years.length === 0) return ""
  const first = years[0]
  const last = years[years.length - 1]
  if (first === last) return `${first}`
  return `${first}–${last}, ${years.length} jaar met gegevens`
}

/**
 * The range of years in the long-term average balance, e.g. "2022–2026".
 *
 * @param years - The calendar years with data.
 * @returns The range, or an empty string without years.
 */
export function formatLongTermRange(years: number[]): string {
  if (years.length === 0) return ""
  const first = years[0]
  const last = years[years.length - 1]
  return first === last ? `${first}` : `${first}–${last}`
}

/**
 * Dutch label of the P-AL level.
 *
 * @param pAl - P-AL (mg P₂O₅ / 100 g).
 * @returns "Laag", "Gemiddeld" or "Hoog", with its range.
 */
export function formatPAlLevel(pAl: number): string {
  if (pAl < P_AL_LOW) return `Laag (< ${P_AL_LOW})`
  if (pAl <= P_AL_HIGH) return `Gemiddeld (${P_AL_LOW}–${P_AL_HIGH})`
  return `Hoog (> ${P_AL_HIGH})`
}

/**
 * The time until the PSD crosses the threshold at the current balance, with a short label that
 * says in which direction: back below it (when now above) or above it (when now below).
 *
 * @param balance - The phosphate balance of the field.
 * @returns Label and value, or `null` when the PSD or the threshold is unknown.
 */
export function getPhosphateYearsToThreshold(
  balance: PhosphateBalanceField,
): { label: string; value: string } | null {
  const psd = balance.projection?.psd
  const threshold = psd?.threshold.value
  if (!psd || threshold === null || threshold === undefined) return null
  if (psd.current.value > threshold) {
    return psd.delta_per_year < 0
      ? { label: "Onder de milieugrens over", value: formatYearsClass(psd.years_class) }
      : { label: "Bij de gemiddelde balans", value: "Blijft boven de milieugrens" }
  }
  return psd.delta_per_year > 0
    ? { label: "Boven de milieugrens over", value: formatYearsClass(psd.years_class) }
    : { label: "Bij de gemiddelde balans", value: "Blijft onder de milieugrens" }
}

/**
 * Dutch description of where the phosphorus saturation degree comes from.
 *
 * @param source - The source.
 * @returns The description.
 */
export function formatSaturationSource(source: PhosphateSaturationSource): string {
  switch (source) {
    case "oxalate":
      return "Berekend uit P-ox, Fe-ox en Al-ox"
    case "a_p_sg":
      return "Fosfaatverzadigingsgraad uit de bodemanalyse"
    case "missing":
      return "Onvoldoende gegevens"
  }
}

/** Dutch name of the reason a field is left out of the phosphate balance (in a sentence). */
export const PHOSPHATE_EXCLUSION_LABEL: Record<FieldExclusionReason, string> = {
  bufferstrip: "bufferstrook",
  nature: "natuurperceel",
  landscape_element: "landschapselement",
}

/** Dutch heading per exclusion reason (plural, for groups of fields). */
export const PHOSPHATE_EXCLUSION_GROUP: Record<FieldExclusionReason, string> = {
  bufferstrip: "Bufferstroken",
  nature: "Natuurpercelen",
  landscape_element: "Landschapselementen",
}

/** Dutch title of the message on an excluded field. */
export const PHOSPHATE_EXCLUSION_TITLE: Record<FieldExclusionReason, string> = {
  bufferstrip: "Bufferstrook: geen fosfaatbalans",
  nature: "Natuurperceel: geen fosfaatbalans",
  landscape_element: "Landschapselement: geen fosfaatbalans",
}

/** Source code of NMI soil estimates (BodemSchat): not a laboratory measurement. */
export const NMI_ESTIMATE_SOURCE = "nl-other-nmi"

/** Long-term average balance as "−8 kg P₂O₅/ha per jaar". */
function formatSaldo(value: number): string {
  return `${formatNumberNl(value)} ${PHOSPHATE_UNIT} per jaar`
}

/**
 * Why the status is indicative, in Dutch, or `null` when it is not.
 *
 * @param balance - The phosphate balance of the field.
 * @param status - Its status.
 * @returns The reason.
 */
export function getPhosphateIndicativeReason(
  balance: PhosphateBalanceField,
  status: PhosphateStatus,
): string | null {
  if (!status.indicative || status.verdict === "unknown") return null
  const { saturation, projection } = balance
  if (!projection?.psd || !saturation.psd_valid) {
    return "Geen bruikbare fosfaatverzadiging: het oordeel gebruikt alleen P-AL."
  }
  if (saturation.soil_note) return saturation.soil_note
  if (projection.psd.threshold.source !== "field") {
    return "Geen P-CaCl₂ bekend: de algemene milieugrens van 25 % is gebruikt."
  }
  const pAlMeasured =
    saturation.a_p_al_source !== null &&
    saturation.a_p_al_source !== undefined &&
    saturation.a_p_al_source !== NMI_ESTIMATE_SOURCE
  return pAlMeasured
    ? "De fosfaatverzadiging is berekend uit geschatte P-ox, Fe-ox en Al-ox (NMI BodemSchat), niet uit een bodemanalyse. P-AL komt wel uit een bodemanalyse."
    : "De fosfaatverzadiging en P-AL zijn geschat (NMI BodemSchat), niet uit een bodemanalyse."
}

/**
 * Years until the deciding indicator reaches its aim (with margin) when the phosphate fertilisation
 * stops: the change per year scales with the effective balance, which drops by the average
 * fertilizer supply.
 *
 * @param balance - The phosphate balance of the field.
 * @param status - Its status.
 * @param fertilizers - Average fertilizer supply per year (kg P₂O₅ / ha).
 * @returns The years with range, or `null` when the aim is not reached without fertilisation.
 */
function yearsWithoutFertilizers(
  balance: PhosphateBalanceField,
  status: PhosphateStatus,
  fertilizers: number,
): ValueWithRange | null {
  const R = PHOSPHATE_STATUS_RULES
  const projection = balance.projection
  if (!projection || projection.balance_effective_per_year === 0) return null
  const scale =
    (projection.balance_effective_per_year - fertilizers) / projection.balance_effective_per_year
  let current: number
  let deltas: number[]
  let edge: number
  const threshold = projection.psd?.threshold.value ?? null
  if (status.binding === "psd" && projection.psd && threshold !== null) {
    current = projection.psd.current.value
    deltas = [projection.psd.delta_per_year]
    edge = threshold + R.psd_margin
  } else if (status.binding === "p_al" && projection.p_al) {
    current = projection.p_al.current
    const d = projection.p_al.delta_per_year
    deltas = [d.value, d.min, d.max]
    edge = status.aim === "opbouwen" ? R.p_al_min - R.p_al_margin : R.p_al_high + R.p_al_margin
  } else {
    return null
  }
  const years = deltas.map((delta) => {
    const perYear = delta * scale
    const t = perYear === 0 ? -1 : (edge - current) / perYear
    return t > 0 ? t : null
  })
  const [value] = years
  if (value === null || value === undefined) return null
  const valid = years.filter((t): t is number => t !== null)
  return { value, min: Math.min(...valid), max: Math.max(...valid) }
}

/** One option in the advice: a short title and one line of explanation. */
export type PhosphateAdviceOption = {
  /** What kind of lever it is (for the icon) */
  kind: "fertilizer" | "removal" | "keep" | "advisor" | "data"
  title: string
  detail: string | null
}

/**
 * Advice for a field, in Dutch, split so the environmental and the agronomic view do not mix: the
 * goal in one line, one sentence per view (PSD for the environment, P-AL for the crop), and a short
 * list of options phrased as possibilities, not instructions.
 */
export type PhosphateAdvice = {
  /** The goal for this field in one line */
  goal: string
  /** The environmental view (PSD against the milieugrens), or `null` without a usable PSD */
  environment: string | null
  /** The agronomic view (P-AL against the lower bound for the crop), or `null` without P-AL */
  agronomic: string | null
  /** What could be done, most relevant first */
  options: PhosphateAdviceOption[]
  /**
   * Time to the aim when the first option is followed, e.g. "circa 10 jaar met aangepaste
   * bemesting"; `null` when the current saldo already gets there or no fixed horizon applies
   */
  timeWithAdvice: string | null
}

/**
 * Builds the advice for a field from its status: the goal, the environmental view (PSD), the
 * agronomic view (P-AL) and the options. The fertilisation option is given in the lever the user
 * controls (average fertilizer supply per year, kg P₂O₅/ha), with the saldo it gives as the
 * secondary figure. It never suggests lowering a fertilisation that is not there, and says when even
 * no phosphate fertilisation is not enough.
 *
 * @param balance - The phosphate balance of the field.
 * @param status - Its status.
 * @returns The advice.
 */
export function getPhosphateAdvice(
  balance: PhosphateBalanceField,
  status: PhosphateStatus,
): PhosphateAdvice {
  const R = PHOSPHATE_STATUS_RULES
  const psd = balance.projection?.psd ?? null
  const threshold = psd?.threshold.value ?? null
  const usePsd = psd !== null && threshold !== null && balance.saturation.psd_valid
  const pAl = balance.projection?.p_al?.current ?? null
  const longTerm = balance.long_term.balance
  // Results cached by an earlier build may lack the long-term fertilizer average
  const fertilizers = Number.isFinite(balance.long_term.fertilizers)
    ? balance.long_term.fertilizers
    : balance.supply.fertilizers.total
  const years = formatYearsBand(status.years) ?? formatYearsClass(status.years_class)
  const indicator = status.binding ? formatIndicator(status.binding) : "fosfaattoestand"
  const inside = status.aim === "onderhouden" && !status.conflict
  const removalOption = (detail: string | null): PhosphateAdviceOption => ({
    kind: "removal",
    title: "Meer fosfaat afvoeren",
    detail:
      detail ??
      "Bijvoorbeeld door gewasresten af te voeren of een gewas met een hoge fosfaatafvoer te telen.",
  })

  if (status.verdict === "unknown" || !status.aim) {
    return {
      goal: "Er is te weinig bodeminformatie voor een oordeel over dit perceel.",
      environment: null,
      agronomic: null,
      options: [
        {
          kind: "data",
          title: "Een bodemanalyse met P-AL laten doen",
          detail: "Daarmee kan de fosfaattoestand worden beoordeeld.",
        },
      ],
      timeWithAdvice: null,
    }
  }

  // Goal
  let goal: string
  if (status.aim === "afbouwen" && status.binding === "psd") {
    goal = `De fosfaatverzadiging omlaag brengen naar de milieugrens, zonder dat P-AL onder ${R.p_al_min} komt.`
  } else if (status.aim === "afbouwen") {
    goal = `De hoge fosfaatvoorraad afbouwen naar P-AL ${R.p_al_high} of lager.`
  } else if (status.aim === "opbouwen") {
    goal = `De fosfaatvoorraad opbouwen naar P-AL ${R.p_al_min} of hoger, voor de opbrengst.`
  } else if (status.conflict) {
    goal = "Milieu en opbrengst vragen hier iets anders; dit perceel vraagt maatwerk."
  } else {
    goal = "De fosfaatvoorraad in de streefzone houden."
  }

  // Environmental view (PSD)
  let environment: string | null = null
  if (usePsd && psd && threshold !== null) {
    if (psd.current.value > threshold) {
      environment = `De bodem zit boven de milieugrens: fosfaat kan naar sloot en grondwater gaan, dus afbouwen is wenselijk.`
    } else if (psd.delta_per_year > 0 && psd.years !== null && psd.years <= R.stay_horizon) {
      // Below the threshold now, but the balance pushes the PSD over it within the horizon (also
      // while building up P-AL)
      environment = `Nu onder de milieugrens, maar bij de huidige balans komt de PSD over ${formatYearsClass(psd.years_class)} erboven.${status.aim === "opbouwen" ? " Houd daar bij het opbouwen rekening mee." : ""}`
    } else {
      environment = `Onder de milieugrens: vanuit het milieu is er nu geen beperking.`
    }
  } else if (balance.projection?.psd || balance.saturation.psd_valid === false) {
    environment =
      "Voor deze grond is de fosfaatverzadiging niet bruikbaar; het oordeel gebruikt alleen P-AL."
  }

  // Agronomic view (P-AL)
  let agronomic: string | null = null
  if (pAl !== null) {
    if (pAl < R.p_al_min) {
      agronomic = `Onder ${R.p_al_min} is er te weinig fosfaat voor een goede opbrengst; opbouwen is gunstig.`
    } else if (inside && status.binding === "p_al" && status.verdict !== "good") {
      agronomic = `Op peil, maar bij de huidige balans daalt P-AL over ${years} onder ${R.p_al_min}.`
    } else if (status.aim === "afbouwen") {
      const floor = formatYearsBand(status.p_al_min_years)
      agronomic = `Op peil: afbouwen kost geen opbrengst zolang P-AL boven ${R.p_al_min} blijft${floor ? ` (bij de huidige balans nog ${floor})` : ""}.`
    } else {
      agronomic = `Op peil: genoeg fosfaat voor de opbrengst.`
    }
  }

  const base = { goal, environment, agronomic }

  // Options
  if (status.aim === "onderhouden" && status.conflict) {
    return {
      ...base,
      options: [
        {
          kind: "fertilizer",
          title: "Aanvoer rond afvoer plus vastlegging",
          detail: "Zo blijft de voorraad ongeveer gelijk.",
        },
        {
          kind: "advisor",
          title: "Bespreken met een adviseur",
          detail: "Opbouwen belast het milieu en afbouwen kan opbrengst kosten.",
        },
      ],
      timeWithAdvice: null,
    }
  }

  if (status.verdict === "good") {
    let detail: string
    if (inside) {
      detail =
        status.direction === "down"
          ? `Een negatieve balans is hier geen probleem; de voorraad blijft langer dan ${R.stay_horizon} jaar in de streefzone.`
          : `De voorraad blijft bij de huidige balans langer dan ${R.stay_horizon} jaar in de streefzone.`
    } else if (status.years_class === "reached") {
      detail = "De fosfaattoestand zit binnen de marge van het doel."
    } else {
      detail = `Bij de huidige balans (${formatSaldo(longTerm)}) is de ${indicator} naar verwachting over ${years} bij het doel.`
    }
    return {
      ...base,
      options: [{ kind: "keep", title: "De huidige fosfaatbemesting aanhouden", detail }],
      timeWithAdvice: null,
    }
  }

  const needed = status.balance_needed
  const horizon = inside ? R.stay_horizon : R.reach_horizon
  const effect = inside
    ? `blijft de ${indicator} naar verwachting ${horizon} jaar in de streefzone`
    : `komt de ${indicator} naar verwachting in circa ${horizon} jaar bij het doel`
  const withoutFertilizers = longTerm - fertilizers
  const notEnoughWithout =
    needed !== null && needed.limit === "max" && needed.value < withoutFertilizers

  if (needed && (notEnoughWithout || (needed.limit === "max" && !status.has_fertilizer_input))) {
    // Lowering the fertilisation is not (or no longer) enough: more removal is the other lever
    if (inside) {
      // In the zone the aim is to stay there: the times are until the field leaves the zone, never
      // a time to reach a goal
      const removalDetail = `Houdt de ${indicator} langer in de streefzone; voor ${horizon} jaar in de zone zou een balans van hoogstens ${formatNumberNl(needed.value)} nodig zijn. Bijvoorbeeld door gewasresten af te voeren of een gewas met een hoge fosfaatafvoer te telen.`
      if (status.has_fertilizer_input) {
        const leaves = formatYearsBand(yearsWithoutFertilizers(balance, status, fertilizers))
        return {
          ...base,
          options: [
            {
              kind: "fertilizer",
              title: "Minder of geen fosfaatbemesting",
              detail: `Zonder fosfaatbemesting wordt de balans circa ${formatSaldo(withoutFertilizers)}; ${leaves ? `de ${indicator} blijft dan naar verwachting nog ${leaves} in de streefzone` : `de ${indicator} blijft dan naar verwachting in de streefzone`}.`,
            },
            removalOption(removalDetail),
          ],
          timeWithAdvice: null,
        }
      }
      return {
        ...base,
        options: [
          removalOption(
            `Er wordt al geen fosfaat bemest; bij de huidige balans verlaat de ${indicator} over ${years} de streefzone. ${removalDetail}`,
          ),
        ],
        timeWithAdvice: null,
      }
    }
    if (status.has_fertilizer_input) {
      const without = formatYearsBand(yearsWithoutFertilizers(balance, status, fertilizers))
      return {
        ...base,
        options: [
          {
            kind: "fertilizer",
            title: "Minder of geen fosfaatbemesting",
            detail: `Zonder fosfaatbemesting wordt de balans circa ${formatSaldo(withoutFertilizers)}; ${without ? `het doel is dan naar verwachting over ${without} bereikt` : `de ${indicator} komt dan naar verwachting nog niet bij het doel`}.`,
          },
          removalOption(
            `Versnelt het afbouwen; voor circa ${horizon} jaar zou een balans van hoogstens ${formatNumberNl(needed.value)} nodig zijn. Bijvoorbeeld door gewasresten af te voeren of een gewas met een hoge fosfaatafvoer te telen.`,
          ),
        ],
        timeWithAdvice: without ? `${without} zonder fosfaatbemesting` : null,
      }
    }
    const now =
      status.direction === (status.aim === "opbouwen" ? "up" : "down")
        ? `Er wordt al geen fosfaat bemest; bij de huidige balans duurt het ${years}.`
        : `Er wordt al geen fosfaat bemest; bij de huidige balans komt de ${indicator} niet bij het doel.`
    return {
      ...base,
      options: [
        removalOption(
          `${now} Bijvoorbeeld door gewasresten af te voeren of een gewas met een hoge fosfaatafvoer te telen.`,
        ),
      ],
      timeWithAdvice: null,
    }
  }

  if (needed) {
    const verb = needed.limit === "max" ? "hoogstens" : "minstens"
    const options: PhosphateAdviceOption[] = [
      {
        kind: "fertilizer",
        title: `Fosfaatbemesting van gemiddeld ${verb} ${formatNumberNl(needed.fertilizers)} ${PHOSPHATE_UNIT} per jaar`,
        detail: `Nu ${formatNumberNl(fertilizers)}. Dat geeft een balans van ${verb} ${formatSaldo(needed.value)} (nu ${formatNumberNl(longTerm)}); dan ${effect}.`,
      },
    ]
    if (needed.limit === "max" && status.aim === "afbouwen") options.push(removalOption(null))
    return {
      ...base,
      options,
      timeWithAdvice: inside
        ? `> ${horizon} jaar met aangepaste bemesting`
        : `circa ${horizon} jaar met aangepaste bemesting`,
    }
  }

  return {
    ...base,
    options: [{ kind: "keep", title: "De huidige fosfaatbemesting aanhouden", detail: null }],
    timeWithAdvice: null,
  }
}
