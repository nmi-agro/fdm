import type { Timeframe } from "@nmi-agro/fdm-core"
import { getCensusForFarm, getGrazingCalendarForFarm, getHerdsForFarm } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { fdm } from "~/lib/fdm.server"

/** What a herd card shows about the grazing of its herd today. */
export interface HerdGrazingStatus {
  type: "grazing_now" | "planned" | "idle"
  /** The field the herd grazes now (`grazing_now`). */
  fieldName?: string | null
  /** The first day of the next planned grazing, e.g. "3 mei" (`planned`). */
  dateStr?: string | null
}

/** A herd as its card on the Melkvee overview and the Vee page shows it. */
export interface HerdCardData {
  l_id_herd: string
  l_herd_name: string
  l_id_category: string
  l_category: string | null
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
    getCensusForFarm(fdm, principal_id, b_id_farm),
    getGrazingCalendarForFarm(fdm, principal_id, b_id_farm, timeframe),
  ])
  const censusMap = new Map(census.map((c) => [c.l_id_herd, c.count]))

  const now = new Date()
  return herds.map((h) => {
    const herdGrazings = grazings.filter((g) => g.l_id_herd === h.l_id_herd)
    const current = herdGrazings.find((g) => {
      const start = new Date(g.l_grazing_start)
      const end = g.l_grazing_end ? new Date(g.l_grazing_end) : null
      return start <= now && (!end || end >= now)
    })
    const planned = herdGrazings
      .filter((g) => new Date(g.l_grazing_start) > now)
      .sort(
        (a, b) => new Date(a.l_grazing_start).getTime() - new Date(b.l_grazing_start).getTime(),
      )[0]
    const status: HerdGrazingStatus = current
      ? { type: "grazing_now", fieldName: current.b_name ?? "onbekend perceel" }
      : planned
        ? {
            type: "planned",
            dateStr: format(new Date(planned.l_grazing_start), "d MMM", { locale: nl }),
          }
        : { type: "idle" }
    return {
      l_id_herd: h.l_id_herd,
      l_herd_name: h.l_herd_name ?? "Koppel",
      l_id_category: h.l_id_category ?? "rvo_100",
      l_category: h.l_category ?? null,
      l_lsu: h.l_lsu ?? 1.0,
      count: censusMap.get(h.l_id_herd) ?? 0,
      status,
    }
  })
}
