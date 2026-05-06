import { ensureInitialized, h32ToString } from "../hash"
import type { CatalogueMeasureItem } from "./d"

export async function hashMeasure(measure: CatalogueMeasureItem) {
    await ensureInitialized()
    // Set hash to null for consistent hashing
    measure.hash = null

    // Remove all keys without a value
    const filteredMeasure = Object.fromEntries(
        Object.entries(measure).filter(
            ([, value]) => value !== undefined && value !== null,
        ),
    )

    // Sort keys to ensure consistent hash generation for identical objects
    const sortedKeys = Object.keys(filteredMeasure).sort()
    const sortedMeasure = sortedKeys.reduce<Record<string, unknown>>(
        (obj, key) => {
            obj[key] = measure[key as keyof typeof measure]
            return obj
        },
        {},
    )

    const hash = h32ToString(JSON.stringify(sortedMeasure))
    return hash
}
