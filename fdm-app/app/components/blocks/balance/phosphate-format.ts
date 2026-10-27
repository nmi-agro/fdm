import type {
  PhosphateBalanceField,
  PhosphateSaturationSource,
  YearsClass,
} from "@nmi-agro/fdm-calculator"

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

/** How well the balance fits the Opbouwen / Onderhouden / Afbouwen frame. */
export type PhosphateFrameConformance = "conform" | "attention" | "unknown"

/** Display information of the frame of a field. */
export type PhosphateFrameStatus = {
  /** Short frame name, e.g. "Afbouwen" */
  label: string
  /** Headline: the frame and what the balance means within it */
  headline: string
  /** One or two sentences of explanation */
  description: string
  conformance: PhosphateFrameConformance
}

/**
 * Determines how the phosphate balance of a field fits its frame (Opbouwen / Onderhouden / Afbouwen).
 *
 * The frame, not the sign of the balance, decides whether a balance is desirable: on a field with a
 * high P-AL (afbouwen) a deficit is the goal, on a field with a low P-AL (opbouwen) a surplus is.
 * The fixation (kg P₂O₅ / ha / year) is the part of the balance that is bound in stable forms, so a
 * balance below the fixation lowers the P-AL.
 *
 * @param balance - The phosphate balance of the field (kg P₂O₅ / ha).
 * @returns The display information of the frame.
 */
export function getPhosphateFrameStatus(balance: PhosphateBalanceField): PhosphateFrameStatus {
  const { frame } = balance
  const fixation = balance.projection?.fixation ?? frame.target_balance_min ?? 0
  const target = frame.target_balance_min ?? fixation
  const fixationText =
    fixation > 0
      ? `Een saldo van ${formatNumberNl(fixation)} ${PHOSPHATE_UNIT} wordt vastgelegd in de bodem en houdt de P-AL ongeveer gelijk.`
      : "Voor deze grondsoort is geen vastlegging ingesteld."

  if (frame.name === "opbouwen") {
    const ok = balance.balance >= target
    return {
      label: "Opbouwen",
      headline: ok
        ? "Opbouwen — het saldo bouwt de voorraad op"
        : "Opbouwen — het saldo is te laag om op te bouwen",
      description: `De P-AL is laag (${formatNumberNl(frame.a_p_al)}, onder 25). Hier is een overschot gewenst. ${fixationText}`,
      conformance: ok ? "conform" : "attention",
    }
  }
  if (frame.name === "onderhouden") {
    const ok = balance.balance >= target
    return {
      label: "Onderhouden",
      headline: ok
        ? "Onderhouden — de voorraad blijft op peil"
        : "Onderhouden — de voorraad daalt bij dit saldo",
      description: `De P-AL is op streefniveau (${formatNumberNl(frame.a_p_al)}, tussen 25 en 45). ${fixationText}`,
      conformance: ok ? "conform" : "attention",
    }
  }
  if (frame.name === "afbouwen") {
    const ok = balance.balance < fixation
    return {
      label: "Afbouwen",
      headline: ok ? "Afbouwen — een tekort is hier goed" : "Afbouwen — de voorraad daalt nog niet",
      description: `De P-AL is hoog (${formatNumberNl(frame.a_p_al)}, boven 45). Een negatief saldo is hier gewenst en kost weinig opbrengst. ${fixationText}`,
      conformance: ok ? "conform" : "attention",
    }
  }
  return {
    label: "Onbekend",
    headline: "Geen P-AL bekend",
    description:
      "Zonder P-AL kan niet worden bepaald of de fosfaatvoorraad moet worden opgebouwd, onderhouden of afgebouwd. Voeg een bodemanalyse met P-AL toe.",
    conformance: "unknown",
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
      return "minder dan 5 jaar"
    case "5_10":
      return "5 tot 10 jaar"
    case "10_20":
      return "10 tot 20 jaar"
    case "gt_20":
      return "meer dan 20 jaar"
    case "not_reached":
      return "niet bij het huidige saldo"
  }
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
    case "estimated_from_p_al":
      return "Geschat uit P-AL (indicatief)"
    case "missing":
      return "Onvoldoende gegevens"
  }
}

/** The PSD compared with the field threshold, and where it is heading at the current balance. */
export type PhosphateSaturationOutlook = {
  /** Whether the current PSD is above the threshold */
  above: boolean
  /** Dutch sentence, e.g. "Onder de grenswaarde over: 5 tot 10 jaar" */
  text: string
}

/**
 * Describes the phosphorus saturation degree relative to the field threshold and the years until
 * the threshold is crossed at the current balance (as a class).
 *
 * @param balance - The phosphate balance of the field.
 * @returns The outlook, or `null` when the PSD or the threshold is unknown.
 */
export function getPhosphateSaturationOutlook(
  balance: PhosphateBalanceField,
): PhosphateSaturationOutlook | null {
  const psd = balance.projection?.psd
  const threshold = psd?.threshold.value
  if (!psd || threshold === null || threshold === undefined) return null
  const above = psd.current.value > threshold
  const years = formatYearsClass(psd.years_class)
  if (above) {
    return {
      above,
      text:
        psd.delta_per_year < 0
          ? `Onder de grenswaarde over: ${years}`
          : "Boven de grenswaarde en daalt niet bij dit saldo",
    }
  }
  return {
    above,
    text:
      psd.delta_per_year > 0
        ? `Boven de grenswaarde over: ${years}`
        : "Blijft onder de grenswaarde bij dit saldo",
  }
}
