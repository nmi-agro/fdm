import { ensureInitialized, h32ToString } from "../hash"
import type { CatalogueMeasureItem } from "./d"

export async function hashMeasure(measure: CatalogueMeasureItem) {
    await ensureInitialized()
    // Work on a shallow copy so the caller's object is not mutated
    const copy = { ...measure }
    copy.hash = null

    // Remove all keys without a value
    const filteredMeasure = Object.fromEntries(
        Object.entries(copy).filter(
            ([, value]) => value !== undefined && value !== null,
        ),
    )

    // Sort keys to ensure consistent hash generation for identical objects
    const sortedKeys = Object.keys(filteredMeasure).sort()
    const sortedMeasure = sortedKeys.reduce<Record<string, unknown>>(
        (obj, key) => {
            obj[key] = copy[key as keyof typeof copy]
            return obj
        },
        {},
    )

    const hash = h32ToString(JSON.stringify(sortedMeasure))
    return hash
}
