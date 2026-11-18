import { getField, getGrazingZonesForField } from "@nmi-agro/fdm-core"
import { data, type LoaderFunctionArgs } from "react-router"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

/**
 * Resource route with what the grazing zone editor needs for a field: the field outline and the
 * zones used earlier on the field, to reuse them or to let a new strip connect to them.
 *
 * Loaded by the zone editor when the user chooses to draw a zone, so the calendar does not have to
 * load every field outline up front. When the earlier zones fail to load, the outline is still
 * returned with `zonesFailed`, so the user can draw a zone.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    const b_id = params.b_id
    if (!b_id) {
      throw data("missing: b_id", { status: 400, statusText: "missing: b_id" })
    }

    const session = await getSession(request)
    const [field, zones] = await Promise.all([
      getField(fdm, session.principal_id, b_id),
      getGrazingZonesForField(fdm, session.principal_id, b_id).catch((error: unknown) => {
        reportError(error, { scope: "grazing-zones" })
        return null
      }),
    ])

    return {
      b_geometry: field.b_geometry,
      zones: (zones ?? []).map((zone) => ({
        l_grazing_geometry_zone: zone.l_grazing_geometry_zone,
        l_grazing_area_grazed: zone.l_grazing_area_grazed,
        last_used: zone.last_used.toISOString(),
        usage_count: zone.usage_count,
        l_herd_names: zone.l_herd_names,
      })),
      zonesFailed: zones === null,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}
