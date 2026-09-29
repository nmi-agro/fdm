import { and, eq, inArray, or, sql } from "drizzle-orm"
import type { HelpdeskPrincipalId } from "./authorization.types"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { checkHelpdeskPermission } from "./authorization"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import { createId } from "./id"

export type SavedReply = schema.SavedReplyTypeSelect
export type SavedReplySummary = Omit<SavedReply, "body">
export type SavedReplyVariable = string
export type SavedReplyContext = Partial<{ [k in SavedReplyVariable]: string }>

/**
 * Creates a new saved reply template that may be used to easily compose message text in the future.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param title Title for the saved reply. It is the label shown while choosing a saved reply.
 * @param body Body of the saved reply. It contains the actual message text that will be used when composing
 * a reply.
 * @param createdBy Principal ID of the user who created the saved reply.
 * @param category Optional category for the saved reply. It can be used to group similar replies together.
 * @param isShared Indicates whether the saved reply is shared with other users.
 * @returns The ID of the newly created saved reply.
 */
export async function createSavedReply(
  fdm: FdmHelpdeskType,
  title: schema.SavedReplyTypeInsert["title"],
  body: schema.SavedReplyTypeInsert["body"],
  createdBy: schema.SavedReplyTypeInsert["created_by"],
  category?: schema.SavedReplyTypeInsert["category"],
  isShared?: schema.SavedReplyTypeInsert["is_shared"],
) {
  try {
    return await fdm.transaction(async (tx) => {
      await checkHelpdeskPermission(tx, "helpdesk", "read", "", createdBy, "createSavedReply")
      const reply_id = createId()
      await tx.insert(schema.savedReplies).values({
        reply_id: reply_id,
        title: title,
        body: body,
        created_by: createdBy,
        category: category,
        is_shared: isShared,
      })
      return reply_id
    })
  } catch (err) {
    throw handleError(err, "Exception for createSavedReply", {
      title,
      createdBy,
      category,
      isShared,
    })
  }
}

/**
 * Updates an existing saved reply. Throws a permission error if the user does not have write access to the
 * saved reply or if the saved reply does not exist.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @param reply_id ID of the reply to update.
 * @param title New title. May be set to undefined to leave the title unchanged.
 * @param body New body. May be set to undefined to leave the body unchanged.
 * @param category New category. May be set to undefined to leave the category unchanged.
 * @param is_shared New shared status. May be set to undefined to leave the shared status unchanged.
 */
export async function updateSavedReply(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  reply_id: schema.SavedReplyTypeSelect["reply_id"],
  title?: schema.SavedReplyTypeInsert["title"],
  body?: schema.SavedReplyTypeInsert["body"],
  category?: schema.SavedReplyTypeInsert["category"],
  is_shared?: schema.SavedReplyTypeInsert["is_shared"],
) {
  try {
    await fdm.transaction(async (tx) => {
      await checkHelpdeskPermission(
        tx,
        "saved_reply",
        "write",
        reply_id,
        principal_id,
        "updateSavedReply",
      )

      await tx
        .update(schema.savedReplies)
        .set({
          title: title,
          body: body,
          category: category,
          is_shared: is_shared,
          updated: sql`now()`,
        })
        .where(eq(schema.savedReplies.reply_id, reply_id))
    })
  } catch (err) {
    throw handleError(err, "Exception for updateSavedReply", {
      principal_id,
      reply_id,
      title,
      category,
      is_shared,
    })
  }
}

/**
 * Deletes an existing saved reply. Throws a permission error if the user does not have write access to the
 * saved reply or if the saved reply does not exist.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @param reply_id ID of the reply to delete.
 */
export async function deleteSavedReply(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  reply_id: schema.SavedReplyTypeSelect["reply_id"],
) {
  try {
    await fdm.transaction(async (tx) => {
      await checkHelpdeskPermission(
        tx,
        "saved_reply",
        "write",
        reply_id,
        principal_id,
        "deleteSavedReply",
      )

      await tx.delete(schema.savedReplies).where(eq(schema.savedReplies.reply_id, reply_id))
    })
  } catch (err) {
    throw handleError(err, "Exception for deleteSavedReply", {
      principal_id,
      reply_id,
    })
  }
}

/**
 * Gets all reply templates that are saved on the helpdesk and the principal has access to. It throws a
 * permission error if the principal is not an agent.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @param category Optional category to filter the saved replies.
 * @returns A list of saved reply summaries that the principal has access to.
 */
export async function getSavedReplies(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  category?: schema.SavedReplyTypeSelect["category"],
): Promise<SavedReplySummary[]> {
  try {
    await checkHelpdeskPermission(fdm, "helpdesk", "read", "", principal_id, "getSavedReplies")

    const helpdeskWritePermission = await checkHelpdeskPermission(
      fdm,
      "helpdesk",
      "write",
      "",
      principal_id,
      "getSavedReplies",
      false,
    )

    const principal_ids = Array.isArray(principal_id) ? principal_id : [principal_id]
    return await fdm
      .select({
        reply_id: schema.savedReplies.reply_id,
        title: schema.savedReplies.title,
        category: schema.savedReplies.category,
        created_by: schema.savedReplies.created_by,
        is_shared: schema.savedReplies.is_shared,
        usage_count: schema.savedReplies.usage_count,
        created: schema.savedReplies.created,
        updated: schema.savedReplies.updated,
      })
      .from(schema.savedReplies)
      .where(
        and(
          sql`TRUE`,
          !helpdeskWritePermission
            ? or(
                schema.savedReplies.is_shared,
                inArray(schema.savedReplies.created_by, principal_ids),
              )
            : undefined,
          typeof category === "string" ? eq(schema.savedReplies.category, category) : undefined,
        ),
      )
  } catch (err) {
    throw handleError(err, "Exception for getSavedReplies", { category })
  }
}

/**
 * Gets the saved reply with the given ID. Throws a permission error if the principal does not have access to
 * the saved reply or if it does not exist.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @param reply_id ID of the reply to get.
 * @returns a aved reply object with the body included.
 */
export async function getSavedReply(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  reply_id: string,
) {
  try {
    await checkHelpdeskPermission(
      fdm,
      "saved_reply",
      "read",
      reply_id,
      principal_id,
      "getSavedReply",
    )

    return (
      await fdm
        .select()
        .from(schema.savedReplies)
        .where(and(eq(schema.savedReplies.reply_id, reply_id)))
    )[0]
  } catch (err) {
    throw handleError(err, "Exception for getSavedReply", {
      principal_id,
      reply_id,
    })
  }
}

/**
 * Ensures that the key is something that can be correctly substituted by replacing instances of {{key}} found
 * in the saved reply body.
 * @param expr Key to validate.
 */
function validateContextKey(expr: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(expr)) {
    throw new Error(`Context key ${expr} is not in the expected format.`)
  }
}

const punct = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"
  .split("")
  .map((x) => `\\${x}`)
  .join("")

const savedReplyWordPattern = `([^\\s${punct}]+)`
const savedReplySeparatorPattern = `(?:\\s|[${punct}])+`
const maxSavedReplyRegexParts = 128
const maxSavedReplyRegexPatternLength = 4096

/**
 * Builds the regex to match a given substitution value in the message body that is converted to a template.
 *
 * It tries to ignore whitespace differences and some punctuation in the source text, sometimes yielding more
 * matches than just exact matching would.
 *
 * @param value The value to build the substitution regex for.
 * @returns A RegExp object if successful, or null if the value cannot be used to build a regex.
 */
function buildSavedReplySubstitutionRegex(value: string): RegExp | null {
  // If the matched expression is like Hello, World, it should match something like Hello\nworld too.
  const parts = value.toLowerCase().match(new RegExp(savedReplyWordPattern, "ig"))
  if (!parts) {
    return null
  }

  const normalizedParts = parts.filter((x) => x.trim().length > 0)
  if (normalizedParts.length === 0 || normalizedParts.length > maxSavedReplyRegexParts) {
    return null
  }

  const pattern = normalizedParts.join(savedReplySeparatorPattern)
  if (pattern.length > maxSavedReplyRegexPatternLength) {
    return null
  }

  try {
    return new RegExp(pattern, "ig")
  } catch {
    return null
  }
}

/**
 * Replaces values found in the saved reply context with saved reply substitution points eagerly using regular
 * expressions.
 * This is intended as a substitute for AI-based saved reply generation until that is implemented.
 *
 * @param replyBody Reply body that normally contains the phrases found in the context
 * @param context What would be passed to `applySavedReply` to obtain the provided message body.
 * @returns String with substitution points like {{key_of_context}}. Might not be accurate so the user should
 * be allowed to adjust the result before saving.
 */
export function makeSavedReplyBodySimple(replyBody: string, context: SavedReplyContext) {
  for (const expr in context) {
    validateContextKey(expr)
  }

  const entries = Object.entries(context)
    .filter((a) => a[1] && a[1].trim().length > 1)
    .map(([expr, value]) => {
      return [expr, buildSavedReplySubstitutionRegex(value as string)]
    })
    .filter((a) => a[1] !== null) as [string, RegExp][]

  // Try to find the longest substitutions first
  entries.sort((a, b) => b[1].source.length - a[1].source.length)

  let result = replyBody
  for (const [expr, regExp] of entries) {
    result = result.replaceAll(regExp, `{{${expr}}}`)
  }

  return result
}

/**
 * Replaces instances of {{key}} in a saved reply body with the substitutions found in the context object.
 * @param replyBody Saved reply body that contains the substitution points like {{key}}.
 * @param context Map of keys to their substitutions. It is encouraged to standardize the set of available
 * keys across the application.
 * @returns Reply body with the substitutions applied. It might not be what the user has intended therefore
 * they should be prompted to verify that the substitutions are in place before submitting. Substitution
 * points with no value provided will be left as-is.
 * @throws if the library is refusing to substitute one of the keys. Keys must consist of English alphanumeric
 * characters and underscores, without any whitespace.
 */
export function applySavedReply(replyBody: string, context: SavedReplyContext): string {
  try {
    for (const expr in context) {
      validateContextKey(expr)
    }
    let result = replyBody
    for (const expr in context) {
      result = result.replaceAll(`{{${expr}}}`, () => context[expr] ?? `{{${expr}}}`)
    }
    return result
  } catch (err) {
    throw handleError(err, "Exception for applySavedReply", { replyBody, context })
  }
}
