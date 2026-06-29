// Client-safe BCS type definitions and per-indicator display helpers.
// Must NOT import from fdm-calculator or fdm-core.

export type BcsColor = "red" | "orange" | "yellow" | "green" | "emerald"

export interface BcsScores {
  a_ss_bcs?: number | null
  a_sc_bcs?: number | null
  a_rd_bcs?: number | null
  a_ew_bcs?: number | null
  a_cc_bcs?: number | null
  a_gs_bcs?: number | null
  a_p_bcs?: number | null
  a_c_bcs?: number | null
  a_rt_bcs?: number | null
}

const POSITIVE_COLORS: Record<0 | 1 | 2, BcsColor> = {
  0: "red",
  1: "orange",
  2: "emerald",
}

const NEGATIVE_COLORS: Record<0 | 1 | 2, BcsColor> = {
  0: "emerald",
  1: "orange",
  2: "red",
}

export function indicatorScoreColor(
  score: number | null | undefined,
  direction: "positive" | "negative",
): BcsColor {
  if (score == null || Number.isNaN(score)) return "yellow"

  const normalized = Math.max(0, Math.min(2, Math.round(score))) as 0 | 1 | 2
  return direction === "negative" ? NEGATIVE_COLORS[normalized] : POSITIVE_COLORS[normalized]
}

export const BCS_COLOR_CLASSES: Record<BcsColor, string> = {
  red: "border-red-200 bg-red-50 text-red-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  yellow: "border-amber-200 bg-amber-50 text-amber-700",
  green: "border-green-200 bg-green-50 text-green-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
}

/** Stronger border variant used for selected wizard criteria buttons */
export const BCS_SELECTED_CLASSES: Record<BcsColor, string> = {
  red: "border-red-500 bg-red-50 dark:bg-red-950/30",
  orange: "border-orange-500 bg-orange-50 dark:bg-orange-950/30",
  yellow: "border-amber-400 bg-amber-50 dark:bg-amber-950/30",
  green: "border-green-500 bg-green-50 dark:bg-green-950/30",
  emerald: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
}

export const BCS_SCORE_DOT: Record<BcsColor, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-amber-500",
  green: "bg-green-500",
  emerald: "bg-emerald-500",
}
