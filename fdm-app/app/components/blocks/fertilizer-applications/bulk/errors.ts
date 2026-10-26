/** Patterns of calculator error messages, with the Dutch message shown to the user instead. */
const CALCULATION_ERRORS: { pattern: RegExp; message: string }[] = [
  {
    pattern: /missing required soil parameters|soil parameters/i,
    message: "Bodemdata ontbreekt. Voeg een bodemanalyse toe om dit te berekenen.",
  },
  {
    pattern: /has no p_type_rvo/i,
    message: "De RVO-mestcode van een meststof ontbreekt. Vul die aan bij de meststof.",
  },
  {
    pattern: /unknown p_type_rvo/i,
    message: "Een meststof heeft een onbekende RVO-mestcode. Controleer de meststof.",
  },
  {
    pattern: /fertilizer .* not found|has no fertilizerDetails/i,
    message: "Een meststof van dit perceel is niet gevonden.",
  },
  {
    pattern: /application method|p_app_method/i,
    message: "Deze toedieningsmethode kan niet worden berekend voor dit grondgebruik.",
  },
  {
    pattern: /unknown region code|region/i,
    message: "De grondsoortregio van dit perceel is niet bekend.",
  },
  {
    pattern: /soil type|b_soiltype_agr|groundwater|b_gwl_class/i,
    message: "Grondsoort of grondwatertrap van dit perceel ontbreekt.",
  },
]

/**
 * Turns a calculator error into a short Dutch message for the user. Messages that are already
 * Dutch (for example from the loader) are kept; unknown technical messages get a general message,
 * so no English or technical text reaches the page.
 *
 * @param message - The error message of the calculator.
 */
export function toFriendlyCalculationError(message: string): string {
  const known = CALCULATION_ERRORS.find(({ pattern }) => pattern.test(message))
  if (known) return known.message
  // Messages from the app itself are Dutch and already meant for the user
  if (
    /\b(perceel|percelen|geen|niet|voor|het|de)\b/i.test(message) &&
    !/\b(the|not|for)\b/.test(message)
  ) {
    return message
  }
  return "Kon niet worden berekend."
}
