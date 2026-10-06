import { listFarmGroups } from "@nmi-agro/fdm-core"
import { data } from "react-router"
import type { OrganizationFarmGroup } from "~/lib/farm-groups"
import { reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

/**
 * Reads the explicit farm selection from the `farmIds` search parameter.
 *
 * Groups are expanded to farm ids by the client, so this parameter is the only source of
 * truth for the selection. A renamed or deleted group therefore does not affect the URL.
 *
 * @param url - The request URL.
 * @returns The selected farm ids, or `undefined` when no selection was made.
 * @throws A 400 response when the parameter is present but contains no ids.
 */
export function parseFarmIdsParam(url: URL): string[] | undefined {
  if (!url.searchParams.has("farmIds")) {
    return undefined
  }
  const farmIds = url.searchParams.get("farmIds")?.split(",").filter(Boolean)
  if (!farmIds || farmIds.length === 0) {
    throw data("invalid: farmIds", {
      status: 400,
      statusText: "invalid: farmIds",
    })
  }
  return farmIds
}

/**
 * Restricts the farms of an organization to the explicit selection in the `farmIds` parameter.
 *
 * @param farms - All farms of the organization.
 * @param farmIds - The selected farm ids, or `undefined` to keep all farms.
 * @returns The selected farms.
 * @throws A 403 response when the selection contains a farm that is not part of `farms`.
 */
export function selectFarms<T extends { b_id_farm: string }>(
  farms: T[],
  farmIds: string[] | undefined,
): T[] {
  if (!farmIds) {
    return farms
  }
  const allowed = new Set(farms.map((farm) => farm.b_id_farm))
  if (farmIds.some((b_id_farm) => !allowed.has(b_id_farm))) {
    const statusText = "You do not have permission to view the selected farms"
    throw data(statusText, { status: 403, statusText })
  }
  const selected = new Set(farmIds)
  return farms.filter((farm) => selected.has(farm.b_id_farm))
}

/**
 * Loads the farm groups of an organization for the group picker.
 *
 * Only farms the organization has access to are returned as member. Failures are reported and
 * result in no groups, so a problem with groups never blocks the page itself.
 *
 * @param principal_id - The signed-in user.
 * @param b_id_organization - The organization.
 * @param farmIds - The ids of the farms of the organization.
 * @returns The groups of the organization, an empty list when there are none.
 */
export async function getOrganizationFarmGroups(
  principal_id: string,
  b_id_organization: string,
  farmIds: string[],
): Promise<OrganizationFarmGroup[]> {
  try {
    const known = new Set(farmIds)
    const groups = await listFarmGroups(fdm, principal_id, b_id_organization)
    return groups.map((group) => ({
      b_id_group: group.b_id_group,
      b_name_group: group.b_name_group,
      b_id_farms: group.b_id_farms.filter((b_id_farm) => known.has(b_id_farm)),
    }))
  } catch (error) {
    reportError(error)
    return []
  }
}
