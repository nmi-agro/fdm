import { and, desc, eq, inArray, isNull } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type { AddFarmVerificationInput, FarmVerification } from "./verification.types"
import { checkPermission, writeAuditEntry } from "./authorization"
import * as schema from "./db/schema"
import * as authZSchema from "./db/schema-authz"
import { handleError } from "./error"
import { createId } from "./id"

/**
 * Stores the result of one completed farm verification attempt.
 *
 * This function does not contact an external verification provider. The caller
 * must first complete the provider-specific verification request for the farm's
 * stored KvK number, then pass the request result:
 *
 * - Use `verified` when the provider confirms the farm relationship.
 * - Use `not_verified` when the provider completes the request but does not
 *   confirm the relationship.
 * - Do not call this function for a faulting or incomplete request, because
 *   that does not establish a verification result.
 *
 * The function records the principal, verification method, result, and exact
 * KvK snapshot as one historical row. It requires write permission on the farm
 * and compares the supplied snapshot with the farm's current KvK while holding
 * the farm row lock. This prevents a concurrent KvK change from being accepted
 * as the basis for the result. It also writes an audit entry and stores that
 * entry's ID on the verification row.
 *
 * Each attempt creates a new row, including repeated attempts by the same
 * principal. Existing measurements are never overwritten. The current
 * implementation accepts only the `rvo_eherkenning` method.
 *
 * @param fdm The FDM database instance created with {@link createFdmServer}.
 * @param principal_id The user or organization principal that performed the
 *   verification. This principal is recorded on the verification row.
 * @param b_id_farm The identifier of the farm used in the provider request.
 * @param verification The method, completed request result, and exact KvK
 *   snapshot used for the provider request.
 * @returns The generated verification ID.
 * @throws {Error} If the principal lacks write permission, the farm does not
 *   exist, the verification method is not yet supported, the KvK snapshot does
 *   not match the farm, or the transaction fails. Errors are returned as
 *   `BaseError` instances through {@link handleError}.
 *
 * @alpha
 */
export async function addFarmVerification(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  verification: AddFarmVerificationInput,
): Promise<string> {
  try {
    if (verification.verification_method !== "rvo_eherkenning") {
      throw new Error("Verification method is not supported yet")
    }
    const start = performance.now()
    return await fdm.transaction(async (tx) => {
      await checkPermission(tx, "farm", "write", b_id_farm, principal_id, "addFarmVerification")

      const farm = await tx
        .select({ b_businessid_farm: schema.farms.b_businessid_farm })
        .from(schema.farms)
        .where(eq(schema.farms.b_id_farm, b_id_farm))
        .limit(1)
        .for("update")

      if (farm.length === 0) {
        throw new Error("Farm not found")
      }
      if (farm[0].b_businessid_farm !== verification.b_businessid_farm) {
        throw new Error("Farm KvK number does not match verification snapshot")
      }

      const audit_id = await writeAuditEntry(
        tx,
        "addFarmVerification",
        "farm",
        "write",
        principal_id,
        "farm",
        b_id_farm,
        Math.round(performance.now() - start),
      )
      const verification_id = createId()
      const resolvedPrincipalId = Array.isArray(principal_id)
        ? principal_id[0] || "unknown"
        : principal_id || "unknown"

      await tx.insert(authZSchema.farmVerification).values({
        verification_id,
        b_id_farm,
        principal_id: resolvedPrincipalId,
        b_businessid_farm: verification.b_businessid_farm,
        verification_method: verification.verification_method,
        verification_result: verification.verification_result,
        audit_id,
      })

      return verification_id
    })
  } catch (err) {
    throw handleError(err, "Exception for addFarmVerification", {
      b_id_farm,
      b_businessid_farm: verification.b_businessid_farm,
    })
  }
}

/**
 * Lists the complete append-only verification history for a farm.
 *
 * The result includes both active and revoked rows, ordered from newest to
 * oldest by `verified_at`. Rows retain the principal and KvK snapshot that were
 * recorded at verification time, so callers can audit which principal proved
 * the relationship and which identifier was trusted.
 *
 * Access is checked against the farm rather than against the principal recorded
 * on each verification. A principal with read permission can therefore inspect
 * the farm's complete verification history, including proofs created by other
 * users. Each row also contains the result of that attempt; a `not_verified`
 * row does not revoke or alter earlier measurements.
 *
 * @param fdm The FDM database instance created with {@link createFdmServer}.
 * @param principal_id The principal requesting the history. This principal
 *   must have read permission on the farm.
 * @param b_id_farm The identifier of the farm whose verification history is
 *   requested.
 * @returns A promise resolving to verification rows ordered newest first.
 *   Revoked rows are included and can be identified by a non-null
 *   `revoked_at`. The latest row for each principal is the result currently
 *   used for that principal's verification status.
 * @throws {Error} If the principal lacks read permission or the database query
 *   fails. Errors are returned as `BaseError` instances through
 *   {@link handleError}.
 *
 * @alpha
 */
export async function getFarmVerifications(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
): Promise<FarmVerification[]> {
  try {
    return await fdm.transaction(async (tx) => {
      await checkPermission(tx, "farm", "read", b_id_farm, principal_id, "getFarmVerifications")
      return await tx
        .select()
        .from(authZSchema.farmVerification)
        .where(eq(authZSchema.farmVerification.b_id_farm, b_id_farm))
        .orderBy(desc(authZSchema.farmVerification.verified_at))
    })
  } catch (err) {
    throw handleError(err, "Exception for getFarmVerifications", { b_id_farm })
  }
}

/**
 * Lists the latest positive verification result for each principal on a farm.
 *
 * This is the farm-wide verification view: it does not restrict the result to
 * the requesting principal. Each returned row includes the `principal_id` that
 * supplied the proof, which lets applications show whether a farm was verified
 * by the current user or by another user with access.
 *
 * Only rows without a `revoked_at` timestamp are considered. For each
 * principal, only the latest result is considered; a later `not_verified`
 * result therefore hides that principal's older positive measurements. Results
 * returned by this helper are all `verified` rows, ordered newest first.
 *
 * @param fdm The FDM database instance created with {@link createFdmServer}.
 * @param principal_id The principal requesting the active proofs. This
 *   principal must have read permission on the farm.
 * @param b_id_farm The identifier of the farm to inspect.
 * @returns A promise resolving to the latest positive verification row for
 *   each principal, ordered newest first.
 * @throws {Error} If the principal lacks read permission or the database query
 *   fails. Errors are returned as `BaseError` instances through
 *   {@link handleError}.
 *
 * @alpha
 */
export async function getActiveFarmVerifications(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
): Promise<FarmVerification[]> {
  try {
    return await fdm.transaction(async (tx) => {
      await checkPermission(
        tx,
        "farm",
        "read",
        b_id_farm,
        principal_id,
        "getActiveFarmVerifications",
      )
      const verifications = await tx
        .select()
        .from(authZSchema.farmVerification)
        .where(
          and(
            eq(authZSchema.farmVerification.b_id_farm, b_id_farm),
            isNull(authZSchema.farmVerification.revoked_at),
          ),
        )
        .orderBy(desc(authZSchema.farmVerification.verified_at))

      const latestByPrincipal = new Map<string, FarmVerification>()
      for (const verification of verifications) {
        if (!latestByPrincipal.has(verification.principal_id)) {
          latestByPrincipal.set(verification.principal_id, verification)
        }
      }

      return [...latestByPrincipal.values()].filter(
        (verification) => verification.verification_result === "verified",
      )
    })
  } catch (err) {
    throw handleError(err, "Exception for getActiveFarmVerifications", { b_id_farm })
  }
}

/**
 * Gets the newest non-revoked verification result for a farm.
 *
 * The lookup is farm-wide and may return a proof created by another principal
 * who has access to the same farm. The result may be either `verified` or
 * `not_verified`; use {@link getActiveFarmVerifications} when the caller needs
 * only principals whose latest result is positive.
 *
 * Revoked rows are ignored. If every historical verification has been revoked,
 * or if the farm has never had a verification attempt, the function returns
 * `null`.
 *
 * @param fdm The FDM database instance created with {@link createFdmServer}.
 * @param principal_id The principal requesting the latest proof. This
 *   principal must have read permission on the farm.
 * @param b_id_farm The identifier of the farm to inspect.
 * @returns A promise resolving to the newest non-revoked verification result,
 *   or `null` when no such result exists.
 * @throws {Error} If the principal lacks read permission or the database query
 *   fails. Errors are returned as `BaseError` instances through
 *   {@link handleError}.
 *
 * @alpha
 */
export async function getLatestFarmVerification(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
): Promise<FarmVerification | null> {
  try {
    return await fdm.transaction(async (tx) => {
      await checkPermission(
        tx,
        "farm",
        "read",
        b_id_farm,
        principal_id,
        "getLatestFarmVerification",
      )
      const verification = await tx
        .select()
        .from(authZSchema.farmVerification)
        .where(
          and(
            eq(authZSchema.farmVerification.b_id_farm, b_id_farm),
            isNull(authZSchema.farmVerification.revoked_at),
          ),
        )
        .orderBy(desc(authZSchema.farmVerification.verified_at))
        .limit(1)

      return verification[0] ?? null
    })
  } catch (err) {
    throw handleError(err, "Exception for getLatestFarmVerification", { b_id_farm })
  }
}

/**
 * Checks whether a principal's latest non-revoked verification result is
 * positive.
 *
 * Unlike {@link getActiveFarmVerifications}, this helper is principal-specific:
 * it answers whether the supplied principal has personally recorded a latest
 * `verified` result. A later `not_verified` result makes this return `false`
 * while preserving all earlier measurements. It does not answer whether the
 * farm is verified by someone else.
 * Applications that need the farm-wide state should use
 * {@link getActiveFarmVerifications} or {@link getLatestFarmVerification}.
 *
 * @param fdm The FDM database instance created with {@link createFdmServer}.
 * @param principal_id The principal whose verification status is checked. The
 *   type also permits an array of principal IDs for callers that resolve a
 *   principal set together.
 * @param b_id_farm The identifier of the farm to inspect.
 * @returns A promise resolving to `true` when at least one supplied principal's
 *   latest non-revoked result is `verified`, otherwise `false`.
 * @throws {Error} If the principal lacks read permission or the database query
 *   fails. Errors are returned as `BaseError` instances through
 *   {@link handleError}.
 *
 * @alpha
 */
export async function isFarmVerifiedForPrincipal(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
): Promise<boolean> {
  try {
    return await fdm.transaction(async (tx) => {
      await checkPermission(
        tx,
        "farm",
        "read",
        b_id_farm,
        principal_id,
        "isFarmVerifiedForPrincipal",
      )
      const principals = Array.isArray(principal_id) ? principal_id : [principal_id]

      const verifications = await tx
        .select({
          principal_id: authZSchema.farmVerification.principal_id,
          verification_result: authZSchema.farmVerification.verification_result,
        })
        .from(authZSchema.farmVerification)
        .where(
          and(
            eq(authZSchema.farmVerification.b_id_farm, b_id_farm),
            inArray(authZSchema.farmVerification.principal_id, principals),
            isNull(authZSchema.farmVerification.revoked_at),
          ),
        )
        .orderBy(desc(authZSchema.farmVerification.verified_at))

      const latestByPrincipal = new Set<string>()
      for (const verification of verifications) {
        if (latestByPrincipal.has(verification.principal_id)) continue
        latestByPrincipal.add(verification.principal_id)
        if (verification.verification_result === "verified") return true
      }

      return false
    })
  } catch (err) {
    throw handleError(err, "Exception for isFarmVerifiedForPrincipal", { b_id_farm })
  }
}

/**
 * Soft-revokes a farm verification without deleting its history.
 *
 * The acting principal must have write permission on the farm. The farm ID is
 * required explicitly so authorization is checked against the caller's stated
 * resource before the verification row is changed.
 *
 * Revocation sets `revoked_at` and leaves the original principal, KvK snapshot,
 * method, timestamps, and audit link intact. Re-revoking an already revoked
 * row fails rather than silently changing historical data.
 *
 * @param fdm The FDM database instance created with {@link createFdmServer}.
 * @param principal_id The principal requesting revocation. This principal must
 *   have write permission on the farm.
 * @param b_id_farm The identifier of the farm containing the verification.
 * @param verification_id The verification ID to revoke.
 * @returns A promise that resolves when the verification has been soft-revoked.
 * @throws {Error} If the verification does not exist, is already revoked, the
 *   principal lacks write permission, or the transaction fails. Errors are
 *   returned as `BaseError` instances through {@link handleError}.
 *
 * @alpha
 */
export async function revokeFarmVerification(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  verification_id: string,
): Promise<void> {
  try {
    await fdm.transaction(async (tx) => {
      await checkPermission(tx, "farm", "write", b_id_farm, principal_id, "revokeFarmVerification")

      const updated = await tx
        .update(authZSchema.farmVerification)
        .set({ revoked_at: new Date() })
        .where(
          and(
            eq(authZSchema.farmVerification.verification_id, verification_id),
            eq(authZSchema.farmVerification.b_id_farm, b_id_farm),
            isNull(authZSchema.farmVerification.revoked_at),
          ),
        )
        .returning({ verification_id: authZSchema.farmVerification.verification_id })

      if (updated.length === 0) {
        throw new Error("Active farm verification not found")
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for revokeFarmVerification", {
      b_id_farm,
      verification_id,
    })
  }
}
