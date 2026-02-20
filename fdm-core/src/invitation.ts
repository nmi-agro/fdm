import { and, eq } from "drizzle-orm"
import * as authZSchema from "./db/schema-authz"
import { handleError } from "./error"
import type { FdmType } from "./fdm"
import { grantRole } from "./authorization"

/**
 * Automatically accepts all pending farm invitations for a newly verified user.
 *
 * This function looks up pending invitations matching the user's email address
 * and grants the corresponding roles. It MUST only be called when `emailVerified`
 * is confirmed to be true.
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
            // Find all pending invitations for this email
            const pendingInvitations = await tx
                .select()
                .from(authZSchema.farmInvitation)
                .where(
                    and(
                        eq(authZSchema.farmInvitation.target_email, normalizedEmail),
                        eq(authZSchema.farmInvitation.status, "pending"),
                    ),
                )

            const now = new Date()
            for (const invitation of pendingInvitations) {
                // Skip expired invitations
                if (invitation.expires < now) {
                    await tx
                        .update(authZSchema.farmInvitation)
                        .set({ status: "expired" })
                        .where(
                            eq(
                                authZSchema.farmInvitation.invitation_id,
                                invitation.invitation_id,
                            ),
                        )
                    continue
                }

                // Grant the role to the user
                await grantRole(
                    tx,
                    "farm",
                    invitation.role as "owner" | "advisor" | "researcher",
                    invitation.farm_id,
                    user_id,
                )

                // Mark invitation as accepted
                await tx
                    .update(authZSchema.farmInvitation)
                    .set({
                        status: "accepted",
                        accepted_at: now,
                        target_principal_id: user_id,
                    })
                    .where(
                        eq(
                            authZSchema.farmInvitation.invitation_id,
                            invitation.invitation_id,
                        ),
                    )
            }
        })
    } catch (err) {
        throw handleError(err, "Exception for autoAcceptInvitationsForNewUser", {
            user_id,
        })
    }
}
