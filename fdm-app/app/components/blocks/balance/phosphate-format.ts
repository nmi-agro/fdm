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

/** Unit of the phosphate balance terms. */
export const PHOSPHATE_UNIT = "kg P₂O₅ / ha"

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
 * Dutch label of the aim with the indicator that sets it, e.g. "Afbouwen · milieu (PSD)".
 *
 * @param status - The status of the field.
 * @returns The label, or "–" without an aim.
 */
export function formatPhosphateAim(status: PhosphateStatus): string {
  if (!status.aim) return "–"
  const aim = { opbouwen: "Opbouwen", onderhouden: "Onderhouden", afbouwen: "Afbouwen" }[status.aim]
  if (status.aim === "onderhouden" && !status.conflict) return aim
  if (status.binding === "psd") return `${aim} · milieu (PSD)`
  if (status.binding === "p_al") return `${aim} · opbrengst (P-AL)`
  return aim
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
      return "niet bij dit saldo"
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
  if (years.value <= 0) return "nu al"
  const horizon = PHOSPHATE_HORIZON_YEARS
  const low = Math.max(1, Math.round(years.min))
  const high = Math.round(years.max)
  if (low > horizon) return `> ${horizon} jaar`
  if (high - low >= 2) return `circa ${low}–${high > horizon ? `> ${horizon}` : high} jaar`
  if (years.value < 5) return "< 5 jaar"
  if (years.value < 10) return "5–10 jaar"
  if (years.value <= horizon) return "10–20 jaar"
  return `> ${horizon} jaar`
}

/**
 * Dutch description of the years in the long-term average balance, e.g. "2022–2026 (5 jaar)".
 *
 * @param years - The calendar years with data.
 * @returns The description, or an empty string without years.
 */
export function formatLongTermYears(years: number[]): string {
  if (years.length === 0) return ""
  const first = years[0]
  const last = years[years.length - 1]
  const range = first === last ? `${first}` : `${first}–${last}`
  return `${range} (${years.length} ${years.length === 1 ? "jaar" : "jaar met gegevens"})`
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
      ? { label: "Onder de grens over", value: formatYearsClass(psd.years_class) }
      : { label: "Bij het gemiddelde saldo", value: "Blijft boven de grens" }
  }
  return psd.delta_per_year > 0
    ? { label: "Boven de grens over", value: formatYearsClass(psd.years_class) }
    : { label: "Bij het gemiddelde saldo", value: "Blijft onder de grens" }
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

/** Dutch name of the reason a field is left out of the phosphate balance. */
export const PHOSPHATE_EXCLUSION_LABEL: Record<FieldExclusionReason, string> = {
  bufferstrip: "bufferstrook",
  nature: "natuur",
  landscape_element: "landschapselement",
}

/** Source code of NMI soil estimates (BodemSchat): not a laboratory measurement. */
export const NMI_ESTIMATE_SOURCE = "nl-other-nmi"

/** Long-term average balance as "−8 kg P₂O₅/ha per jaar". */
function formatSaldo(value: number): string {
  return `${formatNumberNl(value)} kg P₂O₅/ha per jaar`
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
    return "Geen P-CaCl₂ bekend: de algemene grens van 25 % is gebruikt."
  }
  const pAlMeasured =
    saturation.a_p_al_source !== null &&
    saturation.a_p_al_source !== undefined &&
    saturation.a_p_al_source !== NMI_ESTIMATE_SOURCE
  return pAlMeasured
    ? "De fosfaatverzadiging is berekend uit geschatte P-ox, Fe-ox en Al-ox (NMI BodemSchat), niet uit een bodemanalyse. P-AL komt wel uit een bodemanalyse."
    : "De fosfaatverzadiging en P-AL zijn geschat (NMI BodemSchat), niet uit een bodemanalyse."
}

/** Diagnosis and action for a field, in Dutch. */
export type PhosphateAdvice = {
  /** Where the field is relative to the target zone, and why that matters */
  diagnosis: string
  /** What to do, with the needed long-term average balance when it applies */
  action: string | null
  /** Extra context, e.g. that reducing for the environment does not cost yield */
  notes: string[]
}

/**
 * Builds the advice for a field from its status: one diagnosis sentence (where), one action
 * sentence (direction, speed and what to do), plus notes. It never asks to lower a fertilisation
 * that is not there, and quotes the needed long-term average balance next to the current one.
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
  const pAl = balance.projection?.p_al?.current ?? null
  const current = formatSaldo(balance.long_term.balance)
  const years = formatYearsBand(status.years) ?? formatYearsClass(status.years_class)
  const indicator = status.binding ? formatIndicator(status.binding) : "fosfaattoestand"
  const needed = status.balance_needed
  const neededText = needed
    ? `${needed.limit === "max" ? "hoogstens" : "minstens"} ${formatSaldo(needed.value)} (nu ${current})`
    : null
  const notes: string[] = []

  if (status.verdict === "unknown" || !status.aim) {
    return {
      diagnosis: "Onvoldoende bodemgegevens (P-AL of fosfaatverzadiging) voor een oordeel.",
      action: "Voeg een recente bodemanalyse met P-AL toe.",
      notes,
    }
  }

  // Where
  let diagnosis: string
  if (status.aim === "afbouwen" && status.binding === "psd" && psd) {
    diagnosis = `De fosfaatverzadiging (PSD ${formatNumberNl(psd.current.value)} %) ligt boven de milieugrens van ${formatNumberNl(psd.threshold.value)} %: afbouwen is nodig.`
  } else if (status.aim === "afbouwen") {
    diagnosis = `P-AL (${formatNumberNl(pAl)}) is hoog: afbouwen kan zonder opbrengstverlies.`
  } else if (status.aim === "opbouwen") {
    diagnosis = `P-AL (${formatNumberNl(pAl)}) ligt onder ${R.p_al_min}: opbouwen is nodig voor de opbrengst.`
  } else if (status.conflict) {
    diagnosis = `De PSD ligt boven de milieugrens, terwijl P-AL (${formatNumberNl(pAl)}) laag is voor de opbrengst. Opbouwen belast het milieu, afbouwen kost opbrengst.`
  } else {
    const psdPart =
      psd && psd.threshold.value !== null && balance.saturation.psd_valid
        ? ` en PSD ${formatNumberNl(psd.current.value)} % onder de grens van ${formatNumberNl(psd.threshold.value)} %`
        : ""
    diagnosis = `In de streefzone: P-AL ${formatNumberNl(pAl)} (vanaf ${R.p_al_min})${psdPart}.`
  }

  // Direction, speed and what to do
  let action: string | null = null
  const outside = status.aim !== "onderhouden"
  const noInput =
    "Er wordt geen fosfaat bemest; alleen meer afvoer, zoals gewasresten afvoeren of een gewas met een hoge fosfaatafvoer, laat de voorraad sneller dalen."
  if (status.aim === "onderhouden" && status.conflict) {
    action =
      status.direction === "up"
        ? "De PSD stijgt verder. Houd de aanvoer gelijk aan afvoer plus vastlegging en bespreek dit perceel met een adviseur."
        : "Houd de aanvoer gelijk aan afvoer plus vastlegging en bespreek dit perceel met een adviseur."
  } else if (outside) {
    if (status.verdict === "good") {
      action =
        status.years_class === "reached"
          ? "Vrijwel op doel (binnen de marge); houd het huidige saldo aan."
          : `Het gemiddelde saldo (${current}) brengt de ${indicator} in ${years} bij het doel. Houd dit vast.`
    } else if (status.verdict === "attention") {
      if (status.aim === "afbouwen" && !status.has_fertilizer_input) {
        action = `De ${indicator} daalt, maar het duurt ${years} tot het doel. ${noInput}`
      } else {
        action = `De ${indicator} gaat de goede kant op, maar traag (${years}). Een gemiddeld saldo van ${neededText} haalt het doel in circa ${R.reach_horizon} jaar.`
      }
    } else {
      const trend =
        status.direction === "stable"
          ? "blijft gelijk"
          : status.aim === "afbouwen"
            ? "stijgt"
            : "daalt"
      if (status.aim === "afbouwen" && !status.has_fertilizer_input) {
        action = `De ${indicator} ${trend}, terwijl die al boven het doel ligt. ${noInput}`
      } else {
        action = `De ${indicator} ${trend}, terwijl die al ${status.aim === "afbouwen" ? "boven" : "onder"} het doel ligt. ${status.aim === "afbouwen" ? "Verlaag" : "Verhoog"} het gemiddelde saldo naar ${neededText} om in circa ${R.reach_horizon} jaar bij het doel te komen.`
      }
    }
  } else if (status.verdict === "good") {
    action =
      status.direction === "down"
        ? `Bij dit saldo blijft het perceel langer dan ${R.stay_horizon} jaar in de streefzone; een negatief saldo is hier geen probleem.`
        : `Bij dit saldo blijft het perceel langer dan ${R.stay_horizon} jaar in de streefzone.`
  } else if (status.binding === "p_al") {
    action = `Bij dit saldo daalt P-AL over ${years} onder ${R.p_al_min}. Een gemiddeld saldo van ${neededText} houdt P-AL ${R.stay_horizon} jaar in de zone.`
  } else {
    action = `Bij dit saldo komt de ${indicator} over ${years} boven de grens. Een gemiddeld saldo van ${neededText} houdt de ${indicator} ${R.stay_horizon} jaar in de zone.`
  }

  if (status.aim === "afbouwen" && status.conflict) {
    const floor = formatYearsBand(status.p_al_min_years)
    notes.push(
      `Voor de opbrengst is P-AL (${formatNumberNl(pAl)}) op peil; afbouwen kost geen opbrengst zolang P-AL boven ${R.p_al_min} blijft${floor ? ` (bij dit saldo nog ${floor})` : ""}.`,
    )
  }
  return { diagnosis, action, notes }
}
