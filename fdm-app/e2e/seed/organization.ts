/**
 * Seeds a synthetic organization for the end-to-end tests: an advisory firm with access to a
 * farm, and a farm group with that farm in it. The names are made up.
 */
import {
  acceptInvitation,
  addFarmToGroup,
  createFarmGroup,
  createFdmAuth,
  type createFdmServer,
  grantRoleToFarm,
  listPendingInvitationsForFarm,
} from "@nmi-agro/fdm-core"

type Fdm = ReturnType<typeof createFdmServer>

/** The organization the seed creates. */
export const DEMO_ORGANIZATION = {
  name: "Demo Adviesbureau",
  slug: "demo-adviesbureau",
} as const

/** What {@link seedOrganization} created. */
export interface SeededOrganization {
  /** The organization id (`b_id_organization`). */
  id: string
  slug: string
  /** The id of the farm group (`b_id_group`). */
  group: string
}

/**
 * Creates the demo organization with `owner` as its owner, gives it advisor access to the farm
 * through an accepted invitation (as in the app), and adds the farm to a new farm group.
 *
 * @param fdm - The database connection.
 * @param owner - The principal id of a user who owns the farm.
 * @param b_id_farm - The farm.
 * @param year - The year from which the farm is in the group.
 * @param details - The name and slug of the organization (default: {@link DEMO_ORGANIZATION}).
 *   The slug must be unique in the database.
 * @returns The ids of the organization and the group.
 * @throws When the farm has no pending invitation for the organization after sharing it.
 */
export async function seedOrganization(
  fdm: Fdm,
  owner: string,
  b_id_farm: string,
  year: number,
  details: { name: string; slug: string } = DEMO_ORGANIZATION,
): Promise<SeededOrganization> {
  const auth = createFdmAuth(fdm, undefined, undefined, undefined, true)
  const organization = await auth.api.createOrganization({
    body: { name: details.name, slug: details.slug, userId: owner },
  })
  if (!organization) throw new Error("The demo organization could not be created")

  await grantRoleToFarm(fdm, owner, details.slug, b_id_farm, "advisor")
  const invitation = (await listPendingInvitationsForFarm(fdm, owner, b_id_farm)).find(
    (pending) => pending.target_principal_id === organization.id,
  )
  if (!invitation) throw new Error("No invitation for the demo organization was found")
  await acceptInvitation(fdm, invitation.invitation_id, owner)

  const group = await createFarmGroup(fdm, owner, organization.id, "Demo groep")
  await addFarmToGroup(fdm, owner, group, b_id_farm, new Date(Date.UTC(year, 0, 1, 12)))

  return { id: organization.id, slug: details.slug, group }
}
