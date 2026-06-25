import { customAlphabet } from "nanoid"

const customAlphabetSet = "6789BCDFGHJKLMNPQRTWbcdfghjkmnpqrtwza" // No lookalikes and safe
const idSize = 16 // Number of characters in ID

/**
 * Generates a random URL-safe ID with 16 characters drawn from a human-friendly
 * alphabet that excludes visually ambiguous characters (e.g. `0`, `O`, `l`, `1`).
 *
 * @returns A random 16-character string ID.
 */
export const createId = customAlphabet(customAlphabetSet, idSize)
