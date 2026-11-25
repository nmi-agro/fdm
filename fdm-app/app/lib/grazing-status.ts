/**
 * What the grazing screens share about a day on a field: the season the grazing calendar shows,
 * and the colour of each use. The calendar, the Atlas layer, the field table and the overview read
 * them from here, so one colour means the same use everywhere.
 */

/** First month (1–12) of the grazing season shown in the grazing calendar. */
export const GRAZING_SEASON_FIRST_MONTH = 3
/** Last month (1–12) of the grazing season shown in the grazing calendar. */
export const GRAZING_SEASON_LAST_MONTH = 10

/** The grazing season in words, for notices and help text. */
export const GRAZING_SEASON_LABEL = "1 maart tot en met 31 oktober"

/**
 * Whether a day lies in the grazing season of the calendar (1 March up to and including 31
 * October), as in the grassland calendars of Nieuw Nederlands Weiden.
 *
 * @param day - The day (YYYY-MM-DD).
 * @returns `true` when the calendar shows the day.
 */
export function isInGrazingSeason(day: string): boolean {
  const month = Number(day.slice(5, 7))
  return month >= GRAZING_SEASON_FIRST_MONTH && month <= GRAZING_SEASON_LAST_MONTH
}

/**
 * Colour of each use of a field. Grazing and mowing differ in lightness as well as hue, so they
 * stay apart for colour-blind users; a planned grazing adds a hatch, and the map outlines grazed
 * fields.
 */
export const GRAZING_USE_COLORS = {
  /** Grazed that day (emerald-500). */
  weiden: "#10b981",
  /** Mown that day (green-800). */
  maaien: "#166534",
  /** Resting after a grazing or mowing earlier in the year (emerald-200). */
  rust: "#a7f3d0",
  /** Outline of a field grazed on the day shown on the map (emerald-900). */
  weidenOutline: "#064e3b",
} as const

/** Background of a planned grazing: the grazing colour with a diagonal hatch. */
export const PLANNED_GRAZING_BACKGROUND = `repeating-linear-gradient(45deg, rgb(16 185 129 / 0.3) 0 2px, ${GRAZING_USE_COLORS.weiden} 2px 4px)`

/** Background of a day with both a grazing and a mowing: grazing above, mowing below. */
export const MIXED_USE_BACKGROUND = `linear-gradient(to bottom, ${GRAZING_USE_COLORS.weiden} 50%, ${GRAZING_USE_COLORS.maaien} 50%)`

/** Background of a day with a planned grazing and a mowing: hatched above, mowing below. */
export const PLANNED_MIXED_USE_BACKGROUND = `linear-gradient(to bottom, transparent 50%, ${GRAZING_USE_COLORS.maaien} 50%), ${PLANNED_GRAZING_BACKGROUND}`
