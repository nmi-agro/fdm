/**
 * Translates a raw caught error (often an English exception message from the calculator/NMI
 * integration, e.g. "Request to NMI API failed with status 500: ...") into a short, plain-Dutch
 * message safe to show directly to farmers/advisors. Falls back to a generic message rather than
 * ever surfacing raw technical/English text in the UI.
 */
export function toFriendlyAdviceError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)

  const knownPatterns: [RegExp, string][] = [
    [
      /NMI API key not provided/i,
      "Bemestingsadvies is niet geconfigureerd. Neem contact op met de beheerder.",
    ],
    [
      /Invalid b_lu_catalogue provided/i,
      "Het geregistreerde gewas van dit perceel wordt niet herkend.",
    ],
    [
      /Request to NMI API failed|NMI API/i,
      "De adviesdienst is tijdelijk niet bereikbaar. Probeer het later opnieuw.",
    ],
    [/must be non-negative/i, "Er zit een fout in de geregistreerde bemesting van dit perceel."],
  ]

  for (const [pattern, message] of knownPatterns) {
    if (pattern.test(raw)) return message
  }

  return "Kon bemestingsadvies niet berekenen voor dit perceel. Probeer het later opnieuw."
}
