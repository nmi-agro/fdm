import { and, asc, eq, sql } from "drizzle-orm"
import { checkHelpdeskPermission } from "./authorization"
import { HelpdeskPrincipalId } from "./authorization.types"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { PaginationFilter, TextFilter } from "./filter.types"
import { getPageOffsetAndLimit } from "./pagination"

export type EmailBlock = schema.BlockedEmailTypeSelect

/**
 * Retrieves the email block information for an email address. If the email was not blocked, it returns null.
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param email Email address to get the block for.
 * @returns Email block information if found, otherwise null.
 */
export async function getEmailBlock(
  fdm: FdmHelpdeskType,
  email: schema.BlockedEmailTypeSelect["email"],
): Promise<EmailBlock | null> {
  try {
    const blockedEmail = await fdm
      .select()
      .from(schema.blockedEmails)
      .where(eq(schema.blockedEmails.email, email))
      .limit(1)
    return blockedEmail.length > 0 ? blockedEmail[0] : null
  } catch (err) {
    throw handleError(err, "Exception for getEmailBlock")
  }
}

/**
 * Retrieves all the email block information of the helpdesk, with optional text search by email and reason,
 * and pagination.
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id ID of the user who is searching.
 * @param filters Filters to apply.
 * @returns Array of email block informations.
 * @throws if the principal does not have permission to manage blocked emails.
 */
export async function getEmailBlocks(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  filters: PaginationFilter & TextFilter = {},
) {
  try {
    await checkHelpdeskPermission(fdm, "helpdesk", "write", "", principal_id, "getEmailBlocks")

    const { pageOffset, pageLimit } = getPageOffsetAndLimit(filters)

    let query = fdm
      .select()
      .from(schema.blockedEmails)
      .where(
        and(
          sql`TRUE`,
          typeof filters.text === "string" && filters.text.length > 0
            ? sql`(${schema.blockedEmails.email} || ' ' || coalesce(${schema.blockedEmails.reason}, '')) ilike ${`%${filters.text.replaceAll("%", "\\%")}%`}`
            : undefined,
        ),
      )
      .orderBy(asc(schema.blockedEmails.email))

    if (typeof pageOffset === "number") {
      query = query.offset(pageOffset) as typeof query
    }

    if (typeof pageLimit === "number") {
      query = query.limit(pageLimit) as typeof query
    }

    return await query
  } catch (err) {
    throw handleError(err, "Exception for getEmailBlocks", filters)
  }
}

/**
 * Creates an email block with the reason provided if the email was not blocked already.
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param blocked_by ID of the user who intends to block this email address.
 * @param email Email address to block.
 * @param reason Reason for the block.
 * @throws if the principal blocked_by does not have permission to manage blocked emails.
 */
export async function addEmailBlock(
  fdm: FdmHelpdeskType,
  blocked_by: schema.BlockedEmailTypeInsert["blocked_by"],
  email: schema.BlockedEmailTypeInsert["email"],
  reason?: schema.BlockedEmailTypeInsert["reason"],
) {
  try {
    await checkHelpdeskPermission(fdm, "helpdesk", "write", "", blocked_by, "removeEmailBlock")

    await fdm
      .insert(schema.blockedEmails)
      .values([{ email, blocked_by: blocked_by, reason }])
      .onConflictDoNothing()
  } catch (err) {
    throw handleError(err, "Exception for addEmailBlock")
  }
}

/**
 * Removes the block on an email address, if the email was blocked.
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id ID of the user who intends to unblock this email address.
 * @param email Email address to unblock.
 * @throws if the principal does not have permission to manage blocked emails.
 */
export async function removeEmailBlock(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  email: schema.BlockedEmailTypeSelect["email"],
) {
  try {
    await checkHelpdeskPermission(fdm, "helpdesk", "write", "", principal_id, "removeEmailBlock")

    await fdm.delete(schema.blockedEmails).where(eq(schema.blockedEmails.email, email))
  } catch (err) {
    throw handleError(err, "Exception for removeEmailBlock")
  }
}
