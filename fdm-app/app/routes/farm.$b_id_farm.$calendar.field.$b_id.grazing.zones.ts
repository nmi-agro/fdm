import { getField, getGrazingForField, getGrazingZonesForField } from "@nmi-agro/fdm-core"
import { data, type LoaderFunctionArgs } from "react-router"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { occupiedPart, STRIP_ROTATION_DAYS } from "~/lib/grazing-strip"

const MS_PER_DAY = 86_400_000

/**
 * Resource route with what the grazing zone editor needs for a field: the field outline, the
 * zones used earlier on the field to reuse them, and the part of the field in use around a date,
 * so a new strip connects to it.
 *
 * Loaded by the zone editor when the user chooses to draw a zone, so the calendar does not have to
 * load every field outline up front. When the earlier grazings fail to load, the outline is still
 * returned with `zonesFailed`, so the user can draw a zone.
 *
 * Search parameters:
 * - `date` (`YYYY-MM-DD`): the start of the grazing. The grazings that overlap the
 *   {@link STRIP_ROTATION_DAYS} days up to and including it occupy their part of the field (see
 *   {@link occupiedPart}).
 * - `exclude`: the grazing being edited, which does not occupy its own zone. Other grazings of the
 *   same zone still do.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    const b_id = params.b_id
    if (!b_id) {
      throw data("missing: b_id", { status: 400, statusText: "missing: b_id" })
    }

    const searchParams = new URL(request.url).searchParams
    const dateParam = searchParams.get("date") ?? ""
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? new Date(`${dateParam}T00:00:00.000Z`)
      : null
    const exclude = searchParams.get("exclude") || undefined

    const session = await getSession(request)
    const onFailure = (error: unknown) => {
      reportError(error, { scope: "grazing-zones" })
      return null
    }
    const [field, zones, grazingsInWindow] = await Promise.all([
      getField(fdm, session.principal_id, b_id),
      getGrazingZonesForField(fdm, session.principal_id, b_id).catch(onFailure),
      date && !Number.isNaN(date.getTime())
        ? getGrazingForField(fdm, session.principal_id, b_id, {
            start: new Date(date.getTime() - STRIP_ROTATION_DAYS * MS_PER_DAY),
            end: date,
          }).catch(onFailure)
        : Promise.resolve([]),
    ])

    const occupancy = grazingsInWindow
      ? occupiedPart(
          grazingsInWindow.filter((g) => g.l_id_grazing !== exclude),
          field.b_geometry ?? null,
        )
      : null

    return {
      b_geometry: field.b_geometry,
      zones: (zones ?? []).map((zone) => ({
        l_grazing_geometry_zone: zone.l_grazing_geometry_zone,
        l_grazing_area_grazed: zone.l_grazing_area_grazed,
        last_used: zone.last_used.toISOString(),
        usage_count: zone.usage_count,
        l_herd_names: zone.l_herd_names,
      })),
      occupied: occupancy?.occupied ?? [],
      zonesFailed: zones === null || occupancy === null,
      // A grazing in the window only has an area without a place on the map, so the free part of
      // the field is unknown
      occupancyUnknown: occupancy?.unknown ?? false,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}
