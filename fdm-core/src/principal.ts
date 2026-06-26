import { eq, ilike, inArray, or } from "drizzle-orm"
import * as authNSchema from "./db/schema-authn"
import { handleError } from "./error"
import type { FdmType } from "./fdm.types"
import type { Principal } from "./principal.types"

/**
 * Retrieves details of a principal (either a user or an organization) by ID.
 *
 * This function attempts to retrieve details first from the user table, and if not found,
 * then from the organization table.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param principal_id - The unique identifier of the principal.
 * @returns A promise that resolves to an object containing the principal's details,
 *   or undefined if the principal is not found. The resolved object includes the name, image, type,
 *   and verification status of the principal.
 *
 * @throws {Error} - Throws an error if any database operation fails.
 *   The error includes a message and context information about the failed operation.
 *
 * @example
 * ```typescript
 * // Example usage:
 * const principalDetails = await getPrincipal(fdm, "user123");
 * if (principalDetails) {
 *   console.log("Principal Details:", principalDetails);
 * } else {
 *   console.log("Principal not found.");
 * }
 * ```
 */
export async function getPrincipal(
  fdm: FdmType,
  principal_id: string,
): Promise<Principal | undefined> {
  try {
    return (await getPrincipals(fdm, [principal_id])).get(principal_id) ?? undefined
  } catch (err) {
    throw handleError(err, "Exception for getPrincipal", {
      principal_id: principal_id,
    })
  }
}

/**
 * Retrieves details of multiple principals (each is either user or an organization) by ID.
 *
 * This function attempts to retrieve each principal's details first from the user table, and if
 * not found, then from the organization table.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param principal_ids - The unique identifiers of the principals.
 * @returns A promise that resolves to a map from each principal id to its details. A principal ID will be
 * missing from the map if it is not found. Each detail object includes the name, image, type,
 *   and verification status of the principal.
 *
 * @throws {Error} - Throws an error if any database operation fails.
 *   The error includes a message and context information about the failed operation.
 *
 * @example
 * ```typescript
 * // Example usage:
 * const principalDetails = await getPrincipals(fdm, ["user123"]);
 * if (principalDetails.get("user123")) {
 *   console.log("Principal Details:", principalDetails.get("user123"));
 * } else {
 *   console.log("Principal not found.");
 * }
 * ```
 */
export async function getPrincipals(fdm: FdmType, principal_ids: string[]) {
  try {
    return await fdm.transaction(async (tx) => {
      const principalIdsSet = new Set(principal_ids)
      const result: Map<
        string,
        {
          id: string
          username: string
          email: string | null
          initials: string
          displayUserName: string | null
          image: string | null
          type: "user" | "organization"
          isVerified: boolean
        }
      > = new Map()
      // If principal is an user get the details of the user
      if (principalIdsSet.size === 0) return result
      const users = await tx
        .select({
          id: authNSchema.user.id,
          username: authNSchema.user.username,
          displayUserName: authNSchema.user.displayUsername,
          image: authNSchema.user.image,
          isVerified: authNSchema.user.emailVerified,
          firstname: authNSchema.user.firstname,
          surname: authNSchema.user.surname,
          email: authNSchema.user.email,
          name: authNSchema.user.name,
        })
        .from(authNSchema.user)
        .where(inArray(authNSchema.user.id, [...principalIdsSet]))
        .limit(principalIdsSet.size)

      for (const user of users) {
        principalIdsSet.delete(user.id)
        // Determine avatar initials
        let initials = user.email
        if (user.firstname && user.surname) {
          // Select only the first capital letter of firstname and surname
          initials = user.firstname.charAt(0).toUpperCase()

          // Find the first capital letter in the surname
          const surnameParts = user.surname.split(/\s+/) // Split by one or more spaces
          let firstCapitalLetterInSurname = ""

          for (const part of surnameParts) {
            if (part.length > 0) {
              const firstChar = part.charAt(0)
              if (firstChar === firstChar.toUpperCase() && firstChar.match(/[a-zA-Z]/)) {
                firstCapitalLetterInSurname = firstChar.toUpperCase()
                break // Stop at the first capital letter found
              }
            }
          }

          initials += firstCapitalLetterInSurname
        } else if (user.firstname) {
          initials = user.firstname[0]
        } else if (user.name) {
          initials = user.name[0]
        }
        result.set(user.id, {
          id: user.id,
          username: user.username ?? user.email,
          email: user.email,
          initials: initials.toUpperCase(),
          displayUserName: user.displayUserName,
          image: user.image,
          type: "user",
          isVerified: user.isVerified,
        })
      }

      // If principal is an organization get the details of the organization
      if (principalIdsSet.size === 0) return result
      const organizations = await tx
        .select({
          id: authNSchema.organization.id,
          name: authNSchema.organization.name,
          slug: authNSchema.organization.slug,
          logo: authNSchema.organization.logo,
          metadata: authNSchema.organization.metadata,
        })
        .from(authNSchema.organization)
        .where(inArray(authNSchema.organization.id, [...principalIdsSet]))
        .limit(principalIdsSet.size)

      for (const organization of organizations) {
        const metadata = organization.metadata ? JSON.parse(organization.metadata) : null

        result.set(organization.id, {
          id: organization.id,
          username: organization.slug,
          email: null,
          initials: organization.name.charAt(0).toUpperCase(),
          displayUserName: organization.name,
          image: organization.logo,
          type: "organization",
          isVerified: metadata ? metadata.isVerified : false,
        })
      }

      return result
    })
  } catch (err) {
    throw handleError(err, "Exception for getPrincipals", {
      principal_ids: principal_ids,
    })
  }
}

/**
 * Identifies a principal (either a user or an organization) based on a username, email, or org slug.
 *
 * This function searches for a principal, first by checking the user table for a matching username or email,
 * and then, if not found, by checking the organization table for a matching slug.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param identifier - The username, email, or organization slug to search for.
 * @returns A promise that resolves to the matching {@link Principal}, or `undefined` if not found.
 *
 * @throws {Error} - Throws an error if any database operation fails.
 *   The error includes a message and context information about the failed operation.
 *
 * @example
 * ```typescript
 * const principal = await identifyPrincipal(fdm, "john.doe@example.com");
 * if (principal) {
 *   console.log("Principal Details:", principal);
 * } else {
 *   console.log("Principal not found.");
 * }
 * ```
 */
export async function identifyPrincipal(
  fdm: FdmType,
  identifier: string,
): Promise<Principal | undefined> {
  try {
    return await fdm.transaction(async (tx) => {
      // Check if principal is an user
      let principal_id = await tx
        .select({ id: authNSchema.user.id })
        .from(authNSchema.user)
        .where(
          or(eq(authNSchema.user.username, identifier), eq(authNSchema.user.email, identifier)),
        )
        .limit(1)

      if (principal_id.length === 0) {
        // Check if principal is an organization
        principal_id = await tx
          .select({ id: authNSchema.organization.id })
          .from(authNSchema.organization)
          .where(eq(authNSchema.organization.slug, identifier))
          .limit(1)
      }

      if (principal_id.length === 0) {
        return undefined
      }

      // Get the type of the principal
      const principalDetails = await getPrincipal(tx, principal_id[0].id)

      return principalDetails
    })
  } catch (err) {
    throw handleError(err, "Exception for identifyPrincipal", {
      identifier: identifier,
    })
  }
}

/**
 * Looks up principals (users or organizations) based on a partial or complete identifier.
 *
 * This function searches for principals by matching the provided identifier against user emails,
 * and also performs a fuzzy search against organization names and slugs, as well as user usernames,
 * firstnames, surnames and names. It then returns a list of Principal objects representing the matching entities.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param identifier - The string to search for within principal identifiers (email, username, name or slug). Should have at least 1 character
 * @returns A promise that resolves to an array of Principal objects that match the identifier.
 *
 * @throws {Error} - Throws an error if any database operation fails.
 *   The error includes a message and context information about the failed operation.
 *
 * @example
 * ```typescript
 * // Example usage:
 * const searchResults = await lookupPrincipal(fdm, "john");
 * if (searchResults.length > 0) {
 *   console.log("Found Principals:", searchResults);
 * } else {
 *   console.log("No principals found matching the identifier.");
 * }
 * ```
 */
export async function lookupPrincipal(fdm: FdmType, identifier: string): Promise<Principal[]> {
  try {
    return await fdm.transaction(async (tx) => {
      // Lookup if identifier is 1 or more characters
      if (identifier.length <= 1) {
        return []
      }

      // Check if identifier is email of user
      const principals = await tx
        .select({ id: authNSchema.user.id })
        .from(authNSchema.user)
        .where(eq(authNSchema.user.email, identifier))
        .limit(1)

      if (principals.length === 0) {
        // Check if identifier is close to organization name or slug
        const principalOrganizations = await tx
          .select({ id: authNSchema.organization.id })
          .from(authNSchema.organization)
          .where(
            or(
              ilike(authNSchema.organization.name, `%${identifier}%`),
              ilike(authNSchema.organization.slug, `%${identifier}%`),
            ),
          )
          .limit(5)

        principals.push(...principalOrganizations)

        // Check if identifier is close to name of user
        const principalUsers = await tx
          .select({ id: authNSchema.user.id })
          .from(authNSchema.user)
          .where(
            or(
              ilike(authNSchema.user.username, `%${identifier}%`),
              ilike(authNSchema.user.firstname, `%${identifier}%`),
              ilike(authNSchema.user.surname, `%${identifier}%`),
              ilike(authNSchema.user.name, `%${identifier}%`),
            ),
          )
          .limit(5)
        principals.push(...principalUsers)
      }

      // Collect details of principals
      if (principals.length > 0) {
        const principalsDetails = await getPrincipals(
          tx,
          principals.map((p) => p.id),
        )
        return [...principalsDetails.values()].filter((p): p is Principal => p !== undefined)
      }

      return []
    })
  } catch (err) {
    throw handleError(err, "Exception for LookupPrincipal", {
      identifier: identifier,
    })
  }
}
