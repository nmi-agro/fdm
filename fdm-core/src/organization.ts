import { eq } from "drizzle-orm"
import type { FdmType } from "./fdm.types"
import * as authNSchema from "./db/schema-authn"
import { handleError } from "./error"

/**
 * Returns the roles a user has in each organization the user is a member of, with one query.
 *
 * Use it instead of listing the members of every organization to find the user's own role.
 * The roles are the stored role values of the organization memberships, such as `owner`,
 * `admin` or `member`.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param principal_id - The principal making the request. Only the user itself may read its memberships.
 * @param user_id - The user whose memberships are read.
 * @returns A map of organization id to the roles of the user in that organization. Organizations the user is not a member of are not in the map.
 *
 * @throws {Error} If the principal is not the user, or the database query fails.
 *
 * @alpha
 */
export async function listOrganizationRolesOfUser(
  fdm: FdmType,
  principal_id: string,
  user_id: string,
): Promise<Map<string, string[]>> {
  try {
    if (principal_id !== user_id) {
      throw new Error("Principal does not have permission to perform this action")
    }

    const memberships: { organizationId: string; role: string }[] = await fdm
      .select({
        organizationId: authNSchema.member.organizationId,
        role: authNSchema.member.role,
      })
      .from(authNSchema.member)
      .where(eq(authNSchema.member.userId, user_id))

    const result = new Map<string, string[]>()
    for (const { organizationId, role } of memberships) {
      result.set(organizationId, [...(result.get(organizationId) ?? []), role])
    }
    return result
  } catch (err) {
    throw handleError(err, "Exception for listOrganizationRolesOfUser", { principal_id, user_id })
  }
}
