import { and, eq, inArray, or, sql } from "drizzle-orm"
import type { HelpdeskPrincipalId } from "./authorization.types"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { checkHelpdeskPermission } from "./authorization"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import { createId } from "./id"

export type SavedReply = schema.SavedReplyTypeSelect
export type SavedReplySummary = Pick<SavedReply, "reply_id" | "title">
export type SavedReplyVariable = string
export type SavedReplyContext = Partial<{ [k in SavedReplyVariable]: string }>

export async function createSavedReply(
  fdm: FdmHelpdeskType,
  title: schema.SavedReplyTypeInsert["title"],
  body: schema.SavedReplyTypeInsert["body"],
  createdBy: schema.SavedReplyTypeInsert["created_by"],
  category?: schema.SavedReplyTypeInsert["category"],
  isShared?: schema.SavedReplyTypeInsert["is_shared"],
) {
  try {
    const reply_id = createId()
    await fdm.insert(schema.savedReplies).values({
      reply_id: reply_id,
      title: title,
      body: body,
      created_by: createdBy,
      category: category,
      is_shared: isShared,
    })
    return reply_id
  } catch (err) {
    throw handleError(err, "Exception for createSavedReply", {
      title,
      createdBy,
      category,
      isShared,
    })
  }
}

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

export async function getSavedReply(fdm: FdmHelpdeskType, principal_id: string, reply_id: string) {
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
      const re = `([^\\s${punct}]+)`
      // If the matched expression is like Hello, World, it should match something like Hello\nworld too.
      const parts = (value as string).toLowerCase().match(new RegExp(re, "ig"))
      if (!parts) return [expr, null]
      const regExp = parts.filter((x) => x.trim().length > 0).join(`(\\s|\\n|[${punct}])+`)
      return [expr, regExp]
    })
    .filter((a) => a[1] !== null) as [string, string][]

  // Try to find the longest substitutions first
  entries.sort((a, b) => b[1].length - a[1].length)

  let result = replyBody
  for (const [expr, regExp] of entries) {
    result = result.replaceAll(new RegExp(regExp, "ig"), `{{${expr}}}`)
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
      result = result.replaceAll(`{{${expr}}}`, context[expr] ?? `{{${expr}}}`)
    }
    return result
  } catch (err) {
    throw handleError(err, "Exception for applySavedReply")
  }
}
