import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { checkHelpdeskPermission } from "./authorization"
import { HelpdeskPrincipalId } from "./authorization.types"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { PaginationFilter, TextFilter } from "./filter.types"
import { getPageOffsetAndLimit } from "./pagination"
import { escapeHTML } from "./sanitization"

export type EmailBlock = schema.BlockedEmailTypeSelect

/**
 * Converts emails into the format that is used for matching.
 * @param email Email address to convert.
 */
function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

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
    const normalizedEmail = normalizeEmail(email)
    const blockedEmail = await fdm
      .select()
      .from(schema.blockedEmails)
      .where(eq(schema.blockedEmails.email, normalizedEmail))
      .limit(1)
    return blockedEmail.length > 0 ? blockedEmail[0] : null
  } catch (err) {
    throw handleError(err, "Exception for getEmailBlock")
  }
}

/**
 * Retrieves the first email block that matches the email address or its domain.
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param email Email address to get the block for.
 * @returns Email block information if found, otherwise null.
 */
export async function getMatchingEmailBlock(
  fdm: FdmHelpdeskType,
  email: string,
): Promise<EmailBlock | null> {
  try {
    const normalizedEmail = normalizeEmail(email)
    if (normalizedEmail.length === 0 || normalizedEmail.length > 254) {
      return {
        email: email,
        blocked_by: "SYSTEM",
        reason: "Invalid email address",
        created: new Date(),
      }
    }
    const toLookFor = [normalizedEmail]
    let domainPart = normalizedEmail
    let emailParts = normalizedEmail.split("@")
    if (emailParts.length === 2) {
      domainPart = emailParts[1]
      toLookFor.push(domainPart)
    }

    const parts = domainPart.split(".")
    if (parts.some((x) => x.trim().length === 0)) {
      return {
        email: normalizedEmail,
        blocked_by: "SYSTEM",
        reason: "Invalid email address",
        created: new Date(),
      }
    }

    while (parts.length > 0) {
      toLookFor.push(`*.${parts.join(".")}`)
      parts.shift()
    }

    const blockedEmail = await fdm
      .select()
      .from(schema.blockedEmails)
      .where(inArray(schema.blockedEmails.email, toLookFor))
      .limit(1)
    return blockedEmail.length > 0 ? blockedEmail[0] : null
  } catch (err) {
    throw handleError(err, "Exception for getMatchingEmailBlock")
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

    const normalizedEmail = normalizeEmail(email)
    await fdm
      .insert(schema.blockedEmails)
      .values([
        {
          email: normalizedEmail,
          blocked_by: blocked_by,
          reason: typeof reason === "string" ? escapeHTML(reason) : null,
        },
      ])
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

    const normalizedEmail = normalizeEmail(email)
    await fdm.delete(schema.blockedEmails).where(eq(schema.blockedEmails.email, normalizedEmail))
  } catch (err) {
    throw handleError(err, "Exception for removeEmailBlock")
  }
}
