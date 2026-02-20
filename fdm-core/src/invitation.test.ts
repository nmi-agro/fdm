import { and, eq } from "drizzle-orm"
import { beforeAll, describe, expect, inject, it } from "vitest"
import type { FdmAuth } from "./authentication"
import { createFdmAuth } from "./authentication"
import { listPrincipalsForResource } from "./authorization"
import * as authZSchema from "./db/schema-authz"
import { addFarm, grantRoleToFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.d"
import { autoAcceptInvitationsForNewUser } from "./invitation"

describe("autoAcceptInvitationsForNewUser", () => {
    let fdm: FdmServerType
    let fdmAuth: FdmAuth
    let ownerPrincipalId: string
    let farmId: string

    beforeAll(async () => {
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        fdm = createFdmServer(host, port, user, password, database)

        const googleAuth = {
            clientId: "mock_google_client_id",
            clientSecret: "mock_google_client_secret",
        }
        const microsoftAuth = {
            clientId: "mock_ms_client_id",
            clientSecret: "mock_ms_client_secret",
        }
        fdmAuth = createFdmAuth(fdm, googleAuth, microsoftAuth, undefined, true)

        // Create an owner to create farms
        const owner = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "invowner@example.com",
                name: "invowner",
                username: "invowner",
                password: "password",
            } as any,
        })
        ownerPrincipalId = owner.user.id

        // Create a farm
        farmId = await addFarm(
            fdm,
            ownerPrincipalId,
            "Auto Accept Test Farm",
            "AUTO001",
            "Auto Lane",
            "77777",
        )
    })

    it("should auto-accept a pending email-based invitation when user verifies email", async () => {
        const targetEmail = "inviteduser_auto@example.com"

        // Create email-based invitation
        await grantRoleToFarm(
            fdm,
            ownerPrincipalId,
            targetEmail,
            farmId,
            "advisor",
        )

        // Create user account
        const newUser = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: targetEmail,
                name: "inviteduser_auto",
                username: "inviteduser_auto",
                password: "password",
            } as any,
        })
        const newUserId = newUser.user.id

        // Auto-accept invitations (simulating email verification)
        await autoAcceptInvitationsForNewUser(fdm, targetEmail, newUserId)

        // Role should now be granted
        const principals = await listPrincipalsForResource(
            fdm,
            "farm",
            farmId,
        )
        const grantee = principals.find((p) => p.principal_id === newUserId)
        expect(grantee).toBeDefined()
        expect(grantee?.role).toBe("advisor")

        // Invitation should be marked as accepted
        const invitations = await fdm
            .select()
            .from(authZSchema.farmInvitation)
            .where(
                and(
                    eq(authZSchema.farmInvitation.target_email, targetEmail),
                    eq(authZSchema.farmInvitation.farm_id, farmId),
                ),
            )
        expect(invitations[0].status).toBe("accepted")
        expect(invitations[0].target_principal_id).toBe(newUserId)
    })

    it("should skip expired invitations", async () => {
        const expiredEmail = "expireduser_auto@example.com"
        const anotherFarmId = await addFarm(
            fdm,
            ownerPrincipalId,
            "Expired Invite Farm",
            "EXP001",
            "Expired Lane",
            "88888",
        )

        // Create email-based invitation
        await grantRoleToFarm(
            fdm,
            ownerPrincipalId,
            expiredEmail,
            anotherFarmId,
            "researcher",
        )

        // Manually expire the invitation
        await fdm
            .update(authZSchema.farmInvitation)
            .set({ expires: new Date("2000-01-01") })
            .where(eq(authZSchema.farmInvitation.target_email, expiredEmail))

        const expiredUser = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: expiredEmail,
                name: "expireduser_auto",
                username: "expireduser_auto",
                password: "password",
            } as any,
        })

        await autoAcceptInvitationsForNewUser(fdm, expiredEmail, expiredUser.user.id)

        // Role should NOT be granted
        const principals = await listPrincipalsForResource(
            fdm,
            "farm",
            anotherFarmId,
        )
        const grantee = principals.find(
            (p) => p.principal_id === expiredUser.user.id,
        )
        expect(grantee).toBeUndefined()

        // Invitation should be marked as expired
        const invitations = await fdm
            .select()
            .from(authZSchema.farmInvitation)
            .where(eq(authZSchema.farmInvitation.target_email, expiredEmail))
        expect(invitations[0].status).toBe("expired")
    })

    it("should do nothing if there are no pending invitations for the email", async () => {
        const noInviteEmail = "noinvite@example.com"
        const noInviteUser = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: noInviteEmail,
                name: "noinvite",
                username: "noinvite",
                password: "password",
            } as any,
        })

        // Should not throw, just do nothing
        await expect(
            autoAcceptInvitationsForNewUser(fdm, noInviteEmail, noInviteUser.user.id),
        ).resolves.toBeUndefined()
    })

    it("should handle email case-insensitively", async () => {
        const mixedCaseEmail = "MixedCase_auto@Example.COM"
        const normalizedEmail = mixedCaseEmail.toLowerCase().trim()
        const yetAnotherFarmId = await addFarm(
            fdm,
            ownerPrincipalId,
            "Case Test Farm",
            "CASE001",
            "Case Lane",
            "99999",
        )

        // Create invitation with already-lowercased email (grantRoleToFarm normalizes)
        await grantRoleToFarm(
            fdm,
            ownerPrincipalId,
            mixedCaseEmail,
            yetAnotherFarmId,
            "advisor",
        )

        const caseUser = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: normalizedEmail,
                name: "caseuser",
                username: "caseuser_auto",
                password: "password",
            } as any,
        })

        // Auto-accept with the mixed-case email to exercise normalization
        await autoAcceptInvitationsForNewUser(fdm, mixedCaseEmail, caseUser.user.id)

        const principals = await listPrincipalsForResource(
            fdm,
            "farm",
            yetAnotherFarmId,
        )
        const grantee = principals.find((p) => p.principal_id === caseUser.user.id)
        expect(grantee).toBeDefined()
        expect(grantee?.role).toBe("advisor")
    })
})
