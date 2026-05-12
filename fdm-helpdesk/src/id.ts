import { customAlphabet } from "nanoid"

const customAlphabetSet = "6789BCDFGHJKLMNPQRTWbcdfghjkmnpqrtwza" // No lookalikes and safe
const idSize = 16 // Number of characters in ID

export const createId = customAlphabet(customAlphabetSet, idSize)
