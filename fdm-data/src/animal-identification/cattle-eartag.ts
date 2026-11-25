/**
 * Result of {@link parseCattleEartag}.
 *
 * - `dutch`: a Dutch cattle life number (levensnummer) in a known number series. `eartag` is the
 *   normalized form (`NL` followed by the digits, no spaces) and `worknumber` the work number
 *   (werknummer) that is part of it. `checkDigitVerified` is `false` for a series whose check-digit
 *   formula is not published; its check digit is then not checked.
 * - `foreign`: a life number with another country prefix. It is not checked; `eartag` is the input
 *   with surrounding whitespace removed.
 * - `invalid`: a Dutch life number with the wrong length or series (`format`), or with a check digit
 *   that does not match the other digits (`check_digit`).
 */
export type CattleEartagResult =
  | { kind: "dutch"; eartag: string; worknumber: string; checkDigitVerified: boolean }
  | { kind: "foreign"; eartag: string }
  | { kind: "invalid"; reason: "format" | "check_digit" }

const CHECK_DIGIT_WEIGHTS = [9, 3, 1, 7] as const

/**
 * Computes the check digit over a string of digits: the last digit of the sum of the digits
 * multiplied by the repeating weights 9, 3, 1 and 7.
 */
function computeCheckDigit(digits: string): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    sum += CHECK_DIGIT_WEIGHTS[i % CHECK_DIGIT_WEIGHTS.length] * Number(digits[i])
  }
  return sum % 10
}

/**
 * Parses and checks the life number (levensnummer) on the ear tag of a cattle animal.
 *
 * A Dutch life number is the country code `NL` (or its numeric code `528`) followed by 9 or 12
 * digits. The digits consist of a serial number, the 4-digit work number (werknummer) and a check
 * digit as the last digit:
 *
 * | Series                              | Format   | Work number    | Check digit                     |
 * | ----------------------------------- | -------- | -------------- | ------------------------------- |
 * | 100 000 000 to 999 999 999          | `s4w4c1` | digits 5 to 8  | weights 9-3-1-7 over digits 1–8 |
 * | 120 000 000 000 to 129 999 999 999  | `s7w4c1` | digits 8 to 11 | not checked (formula unknown)   |
 * | 130 000 000 000 to 133 999 999 999  | `s7w4c1` | digits 8 to 11 | weights 9-3-1-7 over `528` + digits 1–11 |
 *
 * The work number is therefore derived from the life number, and is not unique on its own: only the
 * life number identifies an animal. The check digit is the last digit of the weighted sum. For the
 * 12-digit electronic series the country code `528` takes part in the sum.
 *
 * Spaces, dots and dashes in the input are ignored, so `NL 1300001 0001 9`, `528130000100019` and
 * `130000100019` give the same result. Input with another letter prefix is treated as a foreign life
 * number and is not checked.
 *
 * @param input - The life number as entered, with or without country code.
 * @returns The parsed life number, or why it is invalid.
 *
 * @example
 * ```ts
 * parseCattleEartag("NL 1300001 0001 9")
 * // { kind: "dutch", eartag: "NL130000100019", worknumber: "0001", checkDigitVerified: true }
 * ```
 */
export function parseCattleEartag(input: string): CattleEartagResult {
  const trimmed = input.trim()
  const compact = trimmed.replace(/[\s.-]/g, "").toUpperCase()

  let digits: string
  if (compact.startsWith("NL")) {
    digits = compact.slice(2)
  } else if (/^[A-Z]/.test(compact)) {
    return { kind: "foreign", eartag: trimmed }
  } else if (compact.startsWith("528") && (compact.length === 12 || compact.length === 15)) {
    digits = compact.slice(3)
  } else {
    digits = compact
  }

  if (!/^\d+$/.test(digits)) {
    return { kind: "invalid", reason: "format" }
  }

  let checkDigit: number | null
  if (digits.length === 9 && digits[0] !== "0") {
    checkDigit = computeCheckDigit(digits.slice(0, 8))
  } else if (digits.length === 12 && /^13[0-3]/.test(digits)) {
    checkDigit = computeCheckDigit(`528${digits.slice(0, 11)}`)
  } else if (digits.length === 12 && digits.startsWith("12")) {
    checkDigit = null
  } else {
    return { kind: "invalid", reason: "format" }
  }

  if (checkDigit !== null && checkDigit !== Number(digits.at(-1))) {
    return { kind: "invalid", reason: "check_digit" }
  }

  return {
    kind: "dutch",
    eartag: `NL${digits}`,
    worknumber: digits.slice(-5, -1),
    checkDigitVerified: checkDigit !== null,
  }
}
