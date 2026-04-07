import { and, count, eq, gt, inArray, or } from "drizzle-orm"
import isEmail from "validator/lib/isEmail.js"
import { grantRole, listPrincipalsForResource } from "./authorization"
import type { Resource, Role } from "./authorization.types"
import * as authNSchema from "./db/schema-authn"
import * as authZSchema from "./db/schema-authz"
import { handleError } from "./error"
import type { FdmType } from "./fdm.types"
import { createId } from "./id"
import { identifyPrincipal } from "./principal"

/**
 * Maximum number of invitations an inviter can send within a rolling one-hour window.
 * Enforced in {@link createInvitation} to prevent spam campaigns.
 */
export const MAX_INVITATIONS_PER_INVITER_PER_HOUR = 20

/**
 * Maximum number of globally pending invitations a single target (email or principal)
 * may have at once across all resources.
 * Enforced in {@link createInvitation} to prevent inbox flooding.
 */
export const MAX_INVITATIONS_PENDING_PER_TARGET = 10

/**
 * Creates an invitation for a principal or email address to access a resource.
 *
 * If the target is a registered principal, a principal-based invitation is created.
 * If the target is a valid email address, an email-based invitation is created for
 * unregistered users; access will be auto-granted upon registration and email verification.
 *
 * The inviter must have the necessary permission (enforced by the caller).
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param resource - The resource type (e.g. 'farm', 'field').
 * @param resource_id - The identifier of the resource.
 * @param inviter_id - The ID of the principal creating the invitation.
 * @param target - The username, email, or slug of the invitee.
 * @param role - The role to grant upon acceptance.
 * @param expires - Optional expiry date; defaults to 7 days from now.
 *
 * @throws {Error} If the target is already a member, or target is invalid.
 */
export async function createInvitation(
    fdm: FdmType,
    resource: Resource,
    resource_id: string,
    inviter_id: string,
    target: string,
    role: Role,
    expires?: Date,
): Promise<void> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            const normalizedTarget = target.toLowerCase().trim()

            // Check if target is a registered principal (user or organization)
            const targetDetails = await identifyPrincipal(tx, normalizedTarget)

            let targetEmail: string | null = null
            let targetPrincipalId: string | null = null

            if (targetDetails) {
                targetPrincipalId = targetDetails.id

                // Check if target is already a member of this resource
                const existingMembers = await listPrincipalsForResource(
                    tx,
                    resource,
                    resource_id,
                )
                const isAlreadyMember = existingMembers.some(
                    (m) => m.principal_id === targetPrincipalId,
                )
                if (isAlreadyMember) {
                    throw new Error(
                        "Target is already a member of this resource",
                    )
                }
            } else {
                if (!isEmail(normalizedTarget)) {
                    throw new Error(
                        "Target not found and not a valid email address",
                    )
                }
                targetEmail = normalizedTarget
            }

            // Rate limit: prevent an inviter from sending too many invitations per hour
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
            const [rateRow] = await tx
                .select({ value: count() })
                .from(authZSchema.invitation)
                .where(
                    and(
                        eq(authZSchema.invitation.inviter_id, inviter_id),
                        gt(authZSchema.invitation.created, oneHourAgo),
                    ),
                )
            if (rateRow.value >= MAX_INVITATIONS_PER_INVITER_PER_HOUR) {
                throw new Error(
                    "Rate limit exceeded: too many invitations sent in the last hour",
                )
            }

            const expiresDate =
                expires ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

            if (targetEmail) {
                const existing = await tx
                    .select()
                    .from(authZSchema.invitation)
                    .where(
                        and(
                            eq(authZSchema.invitation.resource, resource),
                            eq(authZSchema.invitation.resource_id, resource_id),
                            eq(
                                authZSchema.invitation.target_email,
                                targetEmail,
                            ),
                            eq(authZSchema.invitation.status, "pending"),
                        ),
                    )
                    .limit(1)

                if (existing.length > 0) {
                    await tx
                        .update(authZSchema.invitation)
                        .set({ role, inviter_id, expires: expiresDate })
                        .where(
                            eq(
                                authZSchema.invitation.invitation_id,
                                existing[0].invitation_id,
                            ),
                        )
                } else {
                    // Pending cap: prevent flooding a target's inbox across resources
                    const [pendingRow] = await tx
                        .select({ value: count() })
                        .from(authZSchema.invitation)
                        .where(
                            and(
                                eq(
                                    authZSchema.invitation.target_email,
                                    targetEmail,
                                ),
                                eq(authZSchema.invitation.status, "pending"),
                            ),
                        )
                    if (
                        pendingRow.value >= MAX_INVITATIONS_PENDING_PER_TARGET
                    ) {
                        throw new Error(
                            "Target has too many pending invitations. Please try again later.",
                        )
                    }

                    await tx.insert(authZSchema.invitation).values({
                        invitation_id: createId(),
                        resource,
                        resource_id,
                        target_email: targetEmail,
                        role,
                        inviter_id,
                        expires: expiresDate,
                    })
                }
            } else {
                const existing = await tx
                    .select()
                    .from(authZSchema.invitation)
                    .where(
                        and(
                            eq(authZSchema.invitation.resource, resource),
                            eq(authZSchema.invitation.resource_id, resource_id),
                            eq(
                                authZSchema.invitation.target_principal_id,
                                targetPrincipalId!,
                            ),
                            eq(authZSchema.invitation.status, "pending"),
                        ),
                    )
                    .limit(1)

                if (existing.length > 0) {
                    await tx
                        .update(authZSchema.invitation)
                        .set({ role, inviter_id, expires: expiresDate })
                        .where(
                            eq(
                                authZSchema.invitation.invitation_id,
                                existing[0].invitation_id,
                            ),
                        )
                } else {
                    // Pending cap: prevent flooding a target's inbox across resources
                    const [pendingRow] = await tx
                        .select({ value: count() })
                        .from(authZSchema.invitation)
                        .where(
                            and(
                                eq(
                                    authZSchema.invitation.target_principal_id,
                                    targetPrincipalId!,
                                ),
                                eq(authZSchema.invitation.status, "pending"),
                            ),
                        )
                    if (
                        pendingRow.value >= MAX_INVITATIONS_PENDING_PER_TARGET
                    ) {
                        throw new Error(
                            "Target has too many pending invitations. Please try again later.",
                        )
                    }

                    await tx.insert(authZSchema.invitation).values({
                        invitation_id: createId(),
                        resource,
                        resource_id,
                        target_principal_id: targetPrincipalId,
                        role,
                        inviter_id,
                        expires: expiresDate,
                    })
                }
            }
        })
    } catch (err) {
        throw handleError(err, "Exception for createInvitation", {
            resource,
            resource_id,
            role,
        })
    }
}

/**
 * Accepts a pending invitation on behalf of the acting user.
 *
 * Uses an atomic conditional UPDATE to prevent TOCTOU races.
 * For user-targeted invitations: verifies email is verified and matches the invitation target.
 * For organization-targeted invitations: verifies the acting user is an admin or owner.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param invitation_id - The unique identifier of the invitation to accept.
 * @param user_id - The ID of the user accepting the invitation.
 *
 * @throws {Error} If the invitation is not found, already processed, expired, or the user is not authorized.
 */
export async function acceptInvitation(
    fdm: FdmType,
    invitation_id: string,
    user_id: string,
): Promise<void> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            // Atomically claim the invitation: only succeeds if still pending and not expired
            const claimed = await tx
                .update(authZSchema.invitation)
                .set({ status: "accepted", accepted_at: new Date() })
                .where(
                    and(
                        eq(authZSchema.invitation.invitation_id, invitation_id),
                        eq(authZSchema.invitation.status, "pending"),
                        gt(authZSchema.invitation.expires, new Date()),
                    ),
                )
                .returning()

            if (claimed.length === 0) {
                const existing = await tx
                    .select()
                    .from(authZSchema.invitation)
                    .where(
                        eq(authZSchema.invitation.invitation_id, invitation_id),
                    )
                    .limit(1)

                if (existing.length === 0) {
                    throw new Error("Invitation not found")
                }
                const inv = existing[0]
                if (inv.status !== "pending") {
                    throw new Error(`Invitation is already ${inv.status}`)
                }
                await tx
                    .update(authZSchema.invitation)
                    .set({ status: "expired" })
                    .where(
                        eq(authZSchema.invitation.invitation_id, invitation_id),
                    )
                throw new Error("Invitation has expired")
            }

            const invitation = claimed[0]
            let granteeId: string

            if (invitation.target_principal_id) {
                const orgMembership = await tx
                    .select()
                    .from(authNSchema.member)
                    .where(
                        and(
                            eq(
                                authNSchema.member.organizationId,
                                invitation.target_principal_id,
                            ),
                            eq(authNSchema.member.userId, user_id),
                        ),
                    )
                    .limit(1)

                if (orgMembership.length > 0) {
                    // Organization target: verify user is admin or owner
                    if (!["admin", "owner"].includes(orgMembership[0].role)) {
                        throw new Error(
                            "Only admins or owners can accept invitations on behalf of an organization",
                        )
                    }
                } else {
                    // User target: verify it matches the accepting user
                    if (invitation.target_principal_id !== user_id) {
                        throw new Error("This invitation is not for you")
                    }
                    const userRecord = await tx
                        .select({
                            emailVerified: authNSchema.user.emailVerified,
                        })
                        .from(authNSchema.user)
                        .where(eq(authNSchema.user.id, user_id))
                        .limit(1)

                    if (
                        userRecord.length === 0 ||
                        !userRecord[0].emailVerified
                    ) {
                        throw new Error(
                            "Email must be verified before accepting an invitation",
                        )
                    }
                }

                granteeId = invitation.target_principal_id
            } else if (invitation.target_email) {
                const userRecord = await tx
                    .select({
                        email: authNSchema.user.email,
                        emailVerified: authNSchema.user.emailVerified,
                    })
                    .from(authNSchema.user)
                    .where(eq(authNSchema.user.id, user_id))
                    .limit(1)

                if (userRecord.length === 0) {
                    throw new Error("User not found")
                }
                if (
                    userRecord[0].email.toLowerCase().trim() !==
                    invitation.target_email
                ) {
                    throw new Error(
                        "This invitation is not for your email address",
                    )
                }
                if (!userRecord[0].emailVerified) {
                    throw new Error(
                        "Email must be verified before accepting an invitation",
                    )
                }
                granteeId = user_id
            } else {
                throw new Error("Invalid invitation: no target specified")
            }

            await grantRole(
                tx,
                invitation.resource as Resource,
                invitation.role as Role,
                invitation.resource_id,
                granteeId,
            )

            // Update target_principal_id if this was an email-based invitation
            if (!invitation.target_principal_id) {
                await tx
                    .update(authZSchema.invitation)
                    .set({ target_principal_id: granteeId })
                    .where(
                        eq(authZSchema.invitation.invitation_id, invitation_id),
                    )
            }
        })
    } catch (err) {
        throw handleError(err, "Exception for acceptInvitation", {
            invitation_id,
            user_id,
        })
    }
}

/**
 * Declines a pending invitation on behalf of the acting user.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param invitation_id - The unique identifier of the invitation to decline.
 * @param user_id - The ID of the user declining the invitation.
 *
 * @throws {Error} If the invitation is not found, already processed, expired, or the user is not authorized.
 */
export async function declineInvitation(
    fdm: FdmType,
    invitation_id: string,
    user_id: string,
): Promise<void> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            const invitations = await tx
                .select()
                .from(authZSchema.invitation)
                .where(eq(authZSchema.invitation.invitation_id, invitation_id))
                .limit(1)

            if (invitations.length === 0) {
                throw new Error("Invitation not found")
            }
            const invitation = invitations[0]

            if (invitation.status !== "pending") {
                throw new Error(`Invitation is already ${invitation.status}`)
            }

            if (invitation.expires < new Date()) {
                await tx
                    .update(authZSchema.invitation)
                    .set({ status: "expired" })
                    .where(
                        eq(authZSchema.invitation.invitation_id, invitation_id),
                    )
                throw new Error("Invitation has expired")
            }

            if (invitation.target_principal_id) {
                const orgMembership = await tx
                    .select()
                    .from(authNSchema.member)
                    .where(
                        and(
                            eq(
                                authNSchema.member.organizationId,
                                invitation.target_principal_id,
                            ),
                            eq(authNSchema.member.userId, user_id),
                        ),
                    )
                    .limit(1)

                if (orgMembership.length > 0) {
                    if (!["admin", "owner"].includes(orgMembership[0].role)) {
                        throw new Error(
                            "Only admins or owners can decline invitations on behalf of an organization",
                        )
                    }
                } else {
                    if (invitation.target_principal_id !== user_id) {
                        throw new Error("This invitation is not for you")
                    }
                }
            } else if (invitation.target_email) {
                const userRecord = await tx
                    .select({
                        email: authNSchema.user.email,
                        emailVerified: authNSchema.user.emailVerified,
                    })
                    .from(authNSchema.user)
                    .where(eq(authNSchema.user.id, user_id))
                    .limit(1)

                if (
                    userRecord.length === 0 ||
                    userRecord[0].email.toLowerCase().trim() !==
                        invitation.target_email
                ) {
                    throw new Error(
                        "This invitation is not for your email address",
                    )
                }
                if (!userRecord[0].emailVerified) {
                    throw new Error(
                        "Email must be verified before declining an invitation",
                    )
                }
            }

            await tx
                .update(authZSchema.invitation)
                .set({ status: "declined" })
                .where(eq(authZSchema.invitation.invitation_id, invitation_id))
        })
    } catch (err) {
        throw handleError(err, "Exception for declineInvitation", {
            invitation_id,
            user_id,
        })
    }
}

/**
 * Lists all pending (non-expired) invitations for a given user across all resources.
 *
 * Returns invitations where the target matches the user's principal ID, email address,
 * or an organization for which the user is an admin or owner.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param user_id - The ID of the user to retrieve invitations for.
 *
 * @returns A Promise that resolves to an array of pending invitation records.
 */
export async function listPendingInvitationsForPrincipal(
    fdm: FdmType,
    user_id: string,
): Promise<authZSchema.invitationTypeSelect[]> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            const userRecord = await tx
                .select({ email: authNSchema.user.email })
                .from(authNSchema.user)
                .where(eq(authNSchema.user.id, user_id))
                .limit(1)

            if (userRecord.length === 0) {
                return []
            }
            const userEmail = userRecord[0].email.toLowerCase().trim()

            const orgMemberships = await tx
                .select({ organizationId: authNSchema.member.organizationId })
                .from(authNSchema.member)
                .where(
                    and(
                        eq(authNSchema.member.userId, user_id),
                        inArray(authNSchema.member.role, ["admin", "owner"]),
                    ),
                )
            const orgIds = orgMemberships.map(
                (m: { organizationId: string }) => m.organizationId,
            )

            const now = new Date()

            const conditions = [
                and(
                    eq(authZSchema.invitation.target_email, userEmail),
                    eq(authZSchema.invitation.status, "pending"),
                    gt(authZSchema.invitation.expires, now),
                ),
                and(
                    eq(authZSchema.invitation.target_principal_id, user_id),
                    eq(authZSchema.invitation.status, "pending"),
                    gt(authZSchema.invitation.expires, now),
                ),
            ]

            if (orgIds.length > 0) {
                conditions.push(
                    and(
                        inArray(
                            authZSchema.invitation.target_principal_id,
                            orgIds,
                        ),
                        eq(authZSchema.invitation.status, "pending"),
                        gt(authZSchema.invitation.expires, now),
                    ),
                )
            }

            return await tx
                .select()
                .from(authZSchema.invitation)
                .where(or(...conditions))
        })
    } catch (err) {
        throw handleError(
            err,
            "Exception for listPendingInvitationsForPrincipal",
            {
                user_id,
            },
        )
    }
}

/**
 * Automatically accepts all pending invitations for a newly verified user.
 *
 * Looks up pending invitations matching the user's email address across all resources
 * and grants the corresponding roles. MUST only be called when `emailVerified` is confirmed.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param email - The verified email address of the user.
 * @param user_id - The ID of the newly verified user.
 */
export async function autoAcceptInvitationsForNewUser(
    fdm: FdmType,
    email: string,
    user_id: string,
): Promise<void> {
    try {
        const normalizedEmail = email.toLowerCase().trim()

        await fdm.transaction(async (tx: FdmType) => {
            const pendingInvitations = await tx
                .select()
                .from(authZSchema.invitation)
                .where(
                    and(
                        eq(
                            authZSchema.invitation.target_email,
                            normalizedEmail,
                        ),
                        eq(authZSchema.invitation.status, "pending"),
                    ),
                )

            const now = new Date()
            for (const inv of pendingInvitations) {
                if (inv.expires < now) {
                    await tx
                        .update(authZSchema.invitation)
                        .set({ status: "expired" })
                        .where(
                            eq(
                                authZSchema.invitation.invitation_id,
                                inv.invitation_id,
                            ),
                        )
                    continue
                }

                try {
                    await tx.transaction(async (savepointTx: FdmType) => {
                        await grantRole(
                            savepointTx,
                            inv.resource as Resource,
                            inv.role as Role,
                            inv.resource_id,
                            user_id,
                        )

                        await savepointTx
                            .update(authZSchema.invitation)
                            .set({
                                status: "accepted",
                                accepted_at: now,
                                target_principal_id: user_id,
                            })
                            .where(
                                eq(
                                    authZSchema.invitation.invitation_id,
                                    inv.invitation_id,
                                ),
                            )
                    })
                } catch (e) {
                    console.warn(
                        `Failed to auto-accept invitation ${inv.invitation_id} for user ${user_id}:`,
                        e,
                    )
                }
            }
        })
    } catch (err) {
        throw handleError(
            err,
            "Exception for autoAcceptInvitationsForNewUser",
            {
                user_id,
            },
        )
    }
}
