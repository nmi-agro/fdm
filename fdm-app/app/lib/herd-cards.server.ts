import type { Timeframe } from "@nmi-agro/fdm-core"
import { getCensusForFarm, getGrazingCalendarForFarm, getHerdsForFarm } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { fdm } from "~/lib/fdm.server"
import { farmTodayKey } from "~/lib/grazing-dates"
import { serverNow } from "~/lib/server-now.server"

/** What a herd card shows about the grazing of its herd today. */
export interface HerdGrazingStatus {
  type: "grazing_now" | "planned" | "idle"
  /** The field the herd grazes now (`grazing_now`). */
  fieldName?: string | null
  /** The first day of the next planned grazing, e.g. "3 mei" (`planned`). */
  dateStr?: string | null
}

/**
 * Whether a herd grazes today, and otherwise its next planned grazing. Grazing dates are calendar
 * days (midnight UTC), so days are compared, not moments: a grazing of one day ends at the start
 * of that day and still runs all day.
 *
 * @param grazings - The grazings of the herd.
 * @param todayKey - Today's calendar day (`YYYY-MM-DD`) in the Netherlands.
 * @returns The status for the herd card.
 */
export function herdGrazingStatus(
  grazings: Array<{
    l_grazing_start: Date | string
    l_grazing_end?: Date | string | null
    b_name?: string | null
  }>,
  todayKey: string,
): HerdGrazingStatus {
  const dayKey = (date: Date | string) => new Date(date).toISOString().slice(0, 10)
  const current = grazings.find(
    (g) =>
      dayKey(g.l_grazing_start) <= todayKey &&
      dayKey(g.l_grazing_end ?? g.l_grazing_start) >= todayKey,
  )
  if (current) return { type: "grazing_now", fieldName: current.b_name ?? "onbekend perceel" }
  const planned = grazings
    .filter((g) => dayKey(g.l_grazing_start) > todayKey)
    .sort(
      (a, b) => new Date(a.l_grazing_start).getTime() - new Date(b.l_grazing_start).getTime(),
    )[0]
  if (planned) {
    return {
      type: "planned",
      dateStr: format(new Date(planned.l_grazing_start), "d MMM", { locale: nl }),
    }
  }
  return { type: "idle" }
}

/** A herd as its card on the Melkvee overview and the Vee page shows it. */
export interface HerdCardData {
  l_id_herd: string
  l_herd_name: string
  l_id_category: string
  l_category: string | null
  /** Species of the herd's category, e.g. `cattle`. */
  l_specie: string | null
  l_lsu: number
  /** Number of animals in the herd now. */
  count: number
  status: HerdGrazingStatus
}

/**
 * The herds of a farm with their number of animals and whether they graze today, for the herd
 * cards. A herd grazes now when a grazing covers this moment; otherwise its next planned grazing
 * in the timeframe is shown.
 *
 * @param principal_id - The user who asks.
 * @param b_id_farm - The farm.
 * @param timeframe - The calendar year whose grazings count.
 * @returns One entry per herd, in the order of the farm's herds.
 */
export async function getHerdCards(
  principal_id: string,
  b_id_farm: string,
  timeframe: Timeframe,
): Promise<HerdCardData[]> {
  const [herds, census, grazings] = await Promise.all([
    getHerdsForFarm(fdm, principal_id, b_id_farm),
    // The animals now, as fdm-core counts them when a count is changed
    getCensusForFarm(fdm, principal_id, b_id_farm),
    getGrazingCalendarForFarm(fdm, principal_id, b_id_farm, timeframe),
  ])
  const censusMap = new Map(census.map((c) => [c.l_id_herd, c.count]))

  const todayKey = farmTodayKey(serverNow())
  return herds.map((h) => {
    const status = herdGrazingStatus(
      grazings.filter((g) => g.l_id_herd === h.l_id_herd),
      todayKey,
    )
    return {
      l_id_herd: h.l_id_herd,
      l_herd_name: h.l_herd_name ?? "Koppel",
      l_id_category: h.l_id_category,
      l_category: h.l_category ?? null,
      l_specie: h.l_specie ?? null,
      l_lsu: h.l_lsu ?? 1.0,
      count: censusMap.get(h.l_id_herd) ?? 0,
      status,
    }
  })
}
