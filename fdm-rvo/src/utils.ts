import type { RvoImportReviewItem } from "./types"

/**
 * Generates a stable unique identifier for a review item.
 *
 * This ID is used to key items in the UI (e.g., for React lists) and to map user choices.
 * It prioritizes the local field ID (`b_id`), falling back to the RVO field ID (`CropFieldID`)
 * if the item represents a new remote field.
 *
 * @param item - The review item to generate an ID for.
 * @returns A unique string identifier for the item.
 */
export function getItemId(item: RvoImportReviewItem<any>): string {
    return (
        item.localField?.b_id ||
        item.rvoField?.properties.CropFieldID ||
        "unknown"
    )
}
