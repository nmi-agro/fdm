import type { FarmGroup } from "@nmi-agro/fdm-core"
import { data } from "react-router"
import { auth } from "~/lib/auth.server"

/**
 * Finds the organization of the route among the organizations of the signed-in user.
 *
 * @param request - The request, used to identify the user.
 * @param slug - The slug of the organization from the route.
 * @returns The organization.
 * @throws A 404 response when the slug is missing or the user is not a member.
 */
export async function getOrganizationForGroups(request: Request, slug: string | undefined) {
  if (!slug) {
    throw data("not found: organization", { status: 404, statusText: "not found: organization" })
  }
  const organizations = await auth.api.listOrganizations({ headers: request.headers })
  const organization = organizations.find((org) => org.slug === slug)
  if (!organization) {
    throw data("not found: organization", { status: 404, statusText: "not found: organization" })
  }
  return organization
}

/** Formats a date as `YYYY-MM-DD`. */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Prepares a farm group for the interface: dates become `YYYY-MM-DD` strings and periods of farms
 * that are no longer part of the organization are left out.
 *
 * @param group - The farm group from `fdm-core`.
 * @param farmNames - The names of the farms of the organization, by farm id.
 * @returns The group with its periods.
 */
export function serializeGroup(group: FarmGroup, farmNames: Map<string, string | null>) {
  return {
    b_id_group: group.b_id_group,
    b_name_group: group.b_name_group,
    memberships: group.memberships
      .filter((membership) => farmNames.has(membership.b_id_farm))
      .map((membership) => ({
        b_id_farm: membership.b_id_farm,
        b_name_farm: farmNames.get(membership.b_id_farm) ?? null,
        b_group_joined: toDateString(membership.b_group_joined),
        b_group_leaved: membership.b_group_leaved ? toDateString(membership.b_group_leaved) : null,
      })),
  }
}
