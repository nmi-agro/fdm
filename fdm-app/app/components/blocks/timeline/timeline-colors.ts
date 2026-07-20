/**
 * Single source of truth for the non-cultivation event colors used across the timeline
 * (desktop Gantt view and mobile list view). Cultivation colors are handled separately by
 * `~/components/custom/cultivation-colors` since they're keyed by crop rotation category.
 * Centralized here so the two views can't silently drift apart.
 */
export const EVENT_TYPE_COLOR = {
  fertilizer: "#ea580c",
  harvest: "#eab308",
  soil_sampling: "#2563eb",
} as const

export type FertilizerKind = "manure" | "mineral" | "compost" | "other"

export const FERTILIZER_KIND_COLOR: Record<FertilizerKind, string> = {
  manure: "#ca8a04",
  mineral: "#0284c7",
  compost: "#16a34a",
  other: "#6b7280",
}

export function getFertilizerKindColor(
  p_type: "manure" | "mineral" | "compost" | null | undefined,
): string {
  return FERTILIZER_KIND_COLOR[p_type ?? "other"]
}
