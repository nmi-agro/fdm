import { and, eq } from "drizzle-orm"
import { beforeAll, describe, expect, inject, it } from "vitest"
import type { FdmAuth } from "./authentication"
import { createFdmAuth } from "./authentication"
import { listPrincipalsForResource } from "./authorization"
import * as authNSchema from "./db/schema-authn"
import * as authZSchema from "./db/schema-authz"
import { addFarm, grantRoleToFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.d"
import { createId } from "./id"
import {
    acceptInvitation,
    autoAcceptInvitationsForNewUser,
    declineInvitation,
    listPendingInvitationsForPrincipal,
    MAX_INVITATIONS_PENDING_PER_TARGET,
    MAX_INVITATIONS_PER_INVITER_PER_HOUR,
} from "./invitation"

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
        const principals = await listPrincipalsForResource(fdm, "farm", farmId)
        const grantee = principals.find((p) => p.principal_id === newUserId)
        expect(grantee).toBeDefined()
        expect(grantee?.role).toBe("advisor")

        // Invitation should be marked as accepted
        const invitations = await fdm
            .select()
            .from(authZSchema.invitation)
            .where(
                and(
                    eq(authZSchema.invitation.target_email, targetEmail),
                    eq(authZSchema.invitation.resource_id, farmId),
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
            .update(authZSchema.invitation)
            .set({ expires: new Date("2000-01-01") })
            .where(eq(authZSchema.invitation.target_email, expiredEmail))

        const expiredUser = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: expiredEmail,
                name: "expireduser_auto",
                username: "expireduser_auto",
                password: "password",
            } as any,
        })

        await autoAcceptInvitationsForNewUser(
            fdm,
            expiredEmail,
            expiredUser.user.id,
        )

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
            .from(authZSchema.invitation)
            .where(eq(authZSchema.invitation.target_email, expiredEmail))
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
            autoAcceptInvitationsForNewUser(
                fdm,
                noInviteEmail,
                noInviteUser.user.id,
            ),
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
        await autoAcceptInvitationsForNewUser(
            fdm,
            mixedCaseEmail,
            caseUser.user.id,
        )

        const principals = await listPrincipalsForResource(
            fdm,
            "farm",
            yetAnotherFarmId,
        )
        const grantee = principals.find(
            (p) => p.principal_id === caseUser.user.id,
        )
        expect(grantee).toBeDefined()
        expect(grantee?.role).toBe("advisor")
    })
})

describe("acceptInvitation", () => {
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
        fdmAuth = createFdmAuth(
            fdm,
            {
                clientId: "mock_google_client_id",
                clientSecret: "mock_google_client_secret",
            },
            {
                clientId: "mock_ms_client_id",
                clientSecret: "mock_ms_client_secret",
            },
            undefined,
            true,
        )

        const owner = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "accept_owner@example.com",
                name: "accept_owner",
                username: "accept_owner",
                password: "password",
            } as any,
        })
        ownerPrincipalId = owner.user.id

        farmId = await addFarm(
            fdm,
            ownerPrincipalId,
            "Accept Test Farm",
            "ACC001",
            "Accept Lane",
            "10001",
        )
    })

    it("should accept an email-targeted invitation and grant the role", async () => {
        const email = "accept_email_target@example.com"
        await grantRoleToFarm(fdm, ownerPrincipalId, email, farmId, "advisor")

        const target = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email,
                name: "accept_email_target",
                username: "accept_email_target",
                password: "password",
            } as any,
        })
        // Mark email as verified
        await fdm
            .update(authNSchema.user)
            .set({ emailVerified: true })
            .where(eq(authNSchema.user.id, target.user.id))

        // Get invitation_id via fdm-core function
        const pending = await listPendingInvitationsForPrincipal(
            fdm,
            target.user.id,
        )
        const invitation = pending.find((i) => i.resource_id === farmId)
        expect(invitation).toBeDefined()
        if (!invitation) {
            throw new Error(
                "Test did not create an invitation as expected, cannot continue with test",
            )
        }

        await acceptInvitation(fdm, invitation.invitation_id, target.user.id)

        const principals = await listPrincipalsForResource(fdm, "farm", farmId)
        expect(
            principals.find((p) => p.principal_id === target.user.id)?.role,
        ).toBe("advisor")
    })

    it("should throw if invitation does not exist", async () => {
        const user = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "accept_notfound@example.com",
                name: "accept_notfound",
                username: "accept_notfound",
                password: "password",
            } as any,
        })
        await expect(
            acceptInvitation(fdm, createId(), user.user.id),
        ).rejects.toThrowError("Exception for acceptInvitation")
    })

    it("should throw if invitation is already accepted", async () => {
        const email = "accept_double@example.com"
        await grantRoleToFarm(
            fdm,
            ownerPrincipalId,
            email,
            farmId,
            "researcher",
        )

        const target = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email,
                name: "accept_double",
                username: "accept_double",
                password: "password",
            } as any,
        })
        await fdm
            .update(authNSchema.user)
            .set({ emailVerified: true })
            .where(eq(authNSchema.user.id, target.user.id))

        const pending = await listPendingInvitationsForPrincipal(
            fdm,
            target.user.id,
        )
        const invitation = pending.find((i) => i.resource_id === farmId)
        if (!invitation) {
            throw new Error(
                "Test did not create an invitation as expected, cannot continue with test",
            )
        }
        await acceptInvitation(fdm, invitation.invitation_id, target.user.id)

        await expect(
            acceptInvitation(fdm, invitation.invitation_id, target.user.id),
        ).rejects.toThrowError("Exception for acceptInvitation")
    })

    it("should throw if user email does not match email-targeted invitation", async () => {
        const email = "accept_mismatch_target@example.com"
        await grantRoleToFarm(fdm, ownerPrincipalId, email, farmId, "advisor")

        // Register the actual target so we can look up their pending invitation
        const targetUser = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email,
                name: "accept_mismatch_target",
                username: "accept_mismatch_target",
                password: "password",
            } as any,
        })
        const wrongUser = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "accept_mismatch_wrong@example.com",
                name: "accept_mismatch_wrong",
                username: "accept_mismatch_wrong",
                password: "password",
            } as any,
        })

        const pending = await listPendingInvitationsForPrincipal(
            fdm,
            targetUser.user.id,
        )
        const invitation = pending.find((i) => i.resource_id === farmId)
        expect(invitation).toBeDefined()
        if (!invitation) {
            throw new Error(
                "Test did not create an invitation as expected, cannot continue with test",
            )
        }

        await expect(
            acceptInvitation(fdm, invitation.invitation_id, wrongUser.user.id),
        ).rejects.toThrowError("Exception for acceptInvitation")
    })

    it("should throw if invitation is expired", async () => {
        const email = "accept_expired@example.com"
        const expiredFarmId = await addFarm(
            fdm,
            ownerPrincipalId,
            "Accept Expired Farm",
            "ACCEXP",
            "Accept Expired Lane",
            "10002",
        )
        await grantRoleToFarm(
            fdm,
            ownerPrincipalId,
            email,
            expiredFarmId,
            "researcher",
        )

        // Expire the invitation
        await fdm
            .update(authZSchema.invitation)
            .set({ expires: new Date("2000-01-01") })
            .where(eq(authZSchema.invitation.target_email, email))

        const target = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email,
                name: "accept_expired",
                username: "accept_expired",
                password: "password",
            } as any,
        })
        await fdm
            .update(authNSchema.user)
            .set({ emailVerified: true })
            .where(eq(authNSchema.user.id, target.user.id))

        // Get invitation_id - must use direct query since listPendingInvitationsForPrincipal filters out expired
        const rows = await fdm
            .select()
            .from(authZSchema.invitation)
            .where(
                and(
                    eq(authZSchema.invitation.target_email, email),
                    eq(authZSchema.invitation.resource_id, expiredFarmId),
                ),
            )
        const invitation_id = rows[0].invitation_id

        await expect(
            acceptInvitation(fdm, invitation_id, target.user.id),
        ).rejects.toThrowError("Exception for acceptInvitation")
    })
})

describe("declineInvitation", () => {
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
        fdmAuth = createFdmAuth(
            fdm,
            {
                clientId: "mock_google_client_id",
                clientSecret: "mock_google_client_secret",
            },
            {
                clientId: "mock_ms_client_id",
                clientSecret: "mock_ms_client_secret",
            },
            undefined,
            true,
        )

        const owner = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "decline_owner@example.com",
                name: "decline_owner",
                username: "decline_owner",
                password: "password",
            } as any,
        })
        ownerPrincipalId = owner.user.id

        farmId = await addFarm(
            fdm,
            ownerPrincipalId,
            "Decline Test Farm",
            "DEC001B",
            "Decline Lane",
            "10003",
        )
    })

    it("should decline an email-targeted invitation", async () => {
        const email = "decline_email_target@example.com"
        await grantRoleToFarm(fdm, ownerPrincipalId, email, farmId, "advisor")

        const target = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email,
                name: "decline_email_target",
                username: "decline_email_target",
                password: "password",
            } as any,
        })

        // Mark email as verified
        await fdm
            .update(authNSchema.user)
            .set({ emailVerified: true })
            .where(eq(authNSchema.user.id, target.user.id))

        const pending = await listPendingInvitationsForPrincipal(
            fdm,
            target.user.id,
        )
        const invitation = pending.find((i) => i.resource_id === farmId)
        expect(invitation).toBeDefined()
        if (!invitation) {
            throw new Error(
                "Test did not create an invitation as expected, cannot continue with test",
            )
        }

        await declineInvitation(fdm, invitation.invitation_id, target.user.id)

        // Invitation should now be declined — listPendingInvitationsForPrincipal no longer returns it
        const afterDecline = await listPendingInvitationsForPrincipal(
            fdm,
            target.user.id,
        )
        expect(
            afterDecline.find(
                (i) => i.invitation_id === invitation?.invitation_id,
            ),
        ).toBeUndefined()
    })

    it("should throw if invitation does not exist", async () => {
        const user = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "decline_notfound@example.com",
                name: "decline_notfound",
                username: "decline_notfound",
                password: "password",
            } as any,
        })
        await expect(
            declineInvitation(fdm, createId(), user.user.id),
        ).rejects.toThrowError("Exception for declineInvitation")
    })

    it("should throw if invitation is already declined", async () => {
        const email = "decline_double@example.com"
        await grantRoleToFarm(
            fdm,
            ownerPrincipalId,
            email,
            farmId,
            "researcher",
        )

        const target = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email,
                name: "decline_double",
                username: "decline_double",
                password: "password",
            } as any,
        })

        // Mark email as verified
        await fdm
            .update(authNSchema.user)
            .set({ emailVerified: true })
            .where(eq(authNSchema.user.id, target.user.id))

        const pending = await listPendingInvitationsForPrincipal(
            fdm,
            target.user.id,
        )
        const invitation = pending.find((i) => i.resource_id === farmId)
        if (!invitation) {
            throw new Error(
                "Test did not create an invitation as expected, cannot continue with test",
            )
        }
        await declineInvitation(fdm, invitation.invitation_id, target.user.id)

        await expect(
            declineInvitation(fdm, invitation.invitation_id, target.user.id),
        ).rejects.toThrowError("Exception for declineInvitation")
    })

    it("should throw if invitation is expired", async () => {
        const email = "decline_expired@example.com"
        const expiredFarmId = await addFarm(
            fdm,
            ownerPrincipalId,
            "Decline Expired Farm",
            "DECEXP",
            "Decline Expired Lane",
            "10004",
        )
        await grantRoleToFarm(
            fdm,
            ownerPrincipalId,
            email,
            expiredFarmId,
            "researcher",
        )

        // Expire the invitation — must use raw query, no fdm-core API for this
        await fdm
            .update(authZSchema.invitation)
            .set({ expires: new Date("2000-01-01") })
            .where(eq(authZSchema.invitation.target_email, email))

        const target = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email,
                name: "decline_expired",
                username: "decline_expired",
                password: "password",
            } as any,
        })

        // Must use raw query: listPendingInvitationsForPrincipal filters out expired
        const rows = await fdm
            .select()
            .from(authZSchema.invitation)
            .where(
                and(
                    eq(authZSchema.invitation.target_email, email),
                    eq(authZSchema.invitation.resource_id, expiredFarmId),
                ),
            )
        const invitation_id = rows[0].invitation_id

        await expect(
            declineInvitation(fdm, invitation_id, target.user.id),
        ).rejects.toThrowError("Exception for declineInvitation")
    })

    it("should throw if a different user tries to decline a principal-targeted invitation", async () => {
        const targetUser = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "decline_target_principal@example.com",
                name: "decline_target_principal",
                username: "decline_target_principal",
                password: "password",
            } as any,
        })
        const wrongUser = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "decline_wrong_principal@example.com",
                name: "decline_wrong_principal",
                username: "decline_wrong_principal",
                password: "password",
            } as any,
        })

        const principalFarmId = await addFarm(
            fdm,
            ownerPrincipalId,
            "Decline Principal Farm",
            "DECPRI",
            "Decline Principal Lane",
            "10005",
        )
        await grantRoleToFarm(
            fdm,
            ownerPrincipalId,
            "decline_target_principal",
            principalFarmId,
            "advisor",
        )

        const pending = await listPendingInvitationsForPrincipal(
            fdm,
            targetUser.user.id,
        )
        const invitation = pending.find(
            (i) => i.resource_id === principalFarmId,
        )
        expect(invitation).toBeDefined()
        if (!invitation) {
            throw new Error(
                "Test did not create an invitation as expected, cannot continue with test",
            )
        }

        await expect(
            declineInvitation(fdm, invitation.invitation_id, wrongUser.user.id),
        ).rejects.toThrowError("Exception for declineInvitation")
    })
})

describe("listPendingInvitationsForPrincipal", () => {
    let fdm: FdmServerType
    let fdmAuth: FdmAuth
    let ownerPrincipalId: string

    beforeAll(async () => {
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        fdm = createFdmServer(host, port, user, password, database)
        fdmAuth = createFdmAuth(
            fdm,
            {
                clientId: "mock_google_client_id",
                clientSecret: "mock_google_client_secret",
            },
            {
                clientId: "mock_ms_client_id",
                clientSecret: "mock_ms_client_secret",
            },
            undefined,
            true,
        )

        const owner = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "list_inv_owner@example.com",
                name: "list_inv_owner",
                username: "list_inv_owner",
                password: "password",
            } as any,
        })
        ownerPrincipalId = owner.user.id
    })

    it("should return empty array for a non-existent user", async () => {
        const invitations = await listPendingInvitationsForPrincipal(
            fdm,
            createId(),
        )
        expect(invitations).toEqual([])
    })

    it("should return email-targeted invitations for a user by email", async () => {
        const targetUser = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "list_inv_emailuser@example.com",
                name: "list_inv_emailuser",
                username: "list_inv_emailuser",
                password: "password",
            } as any,
        })

        const emailFarmId = await addFarm(
            fdm,
            ownerPrincipalId,
            "List Inv Email Farm",
            "LSIEMA",
            "List Inv Email Lane",
            "10007",
        )
        await grantRoleToFarm(
            fdm,
            ownerPrincipalId,
            "list_inv_emailuser@example.com",
            emailFarmId,
            "researcher",
        )

        const invitations = await listPendingInvitationsForPrincipal(
            fdm,
            targetUser.user.id,
        )
        const emailInv = invitations.find((i) => i.resource_id === emailFarmId)
        expect(emailInv).toBeDefined()
        expect(emailInv?.status).toBe("pending")
    })

    it("should include org-targeted invitations for a user who is an org admin", async () => {
        const orgAdmin = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "list_inv_orgadmin@example.com",
                name: "list_inv_orgadmin",
                username: "list_inv_orgadmin",
                password: "password",
            } as any,
        })

        // No fdm-core API for org creation — use raw insert (same pattern as authorization.test.ts)
        const orgId = createId()
        const orgSlug = `list-inv-org-${orgId.toLowerCase()}`
        await fdm.insert(authNSchema.organization).values({
            id: orgId,
            name: "List Inv Org",
            slug: orgSlug,
            createdAt: new Date(),
        })
        await fdm.insert(authNSchema.member).values({
            id: createId(),
            organizationId: orgId,
            userId: orgAdmin.user.id,
            role: "admin",
            createdAt: new Date(),
        })

        const orgFarmId = await addFarm(
            fdm,
            ownerPrincipalId,
            "List Inv Org Farm",
            "LSIORG",
            "List Inv Org Lane",
            "10006",
        )
        await grantRoleToFarm(
            fdm,
            ownerPrincipalId,
            orgSlug,
            orgFarmId,
            "advisor",
        )

        const invitations = await listPendingInvitationsForPrincipal(
            fdm,
            orgAdmin.user.id,
        )
        const orgInv = invitations.find((i) => i.target_principal_id === orgId)
        expect(orgInv).toBeDefined()
        expect(orgInv?.status).toBe("pending")
    })
})

describe("createInvitation spam prevention", () => {
    let fdm: FdmServerType
    let fdmAuth: FdmAuth
    let rateLimitOwnerPrincipalId: string
    let rateLimitFarmId: string
    let pendingCapOwnerPrincipalId: string

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

        const rateLimitOwner = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "spam_ratelimit_owner@example.com",
                name: "spam_ratelimit_owner",
                username: "spam_ratelimit_owner",
                password: "password",
            } as any,
        })
        rateLimitOwnerPrincipalId = rateLimitOwner.user.id
        rateLimitFarmId = await addFarm(
            fdm,
            rateLimitOwnerPrincipalId,
            "Rate Limit Farm",
            "RLF001",
            "Rate Limit Lane",
            "55555",
        )

        const pendingCapOwner = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "spam_pendingcap_owner@example.com",
                name: "spam_pendingcap_owner",
                username: "spam_pendingcap_owner",
                password: "password",
            } as any,
        })
        pendingCapOwnerPrincipalId = pendingCapOwner.user.id
    })

    it("should reject when inviter exceeds hourly rate limit", async () => {
        // Send exactly MAX invitations to different email addresses (they don't exist as users)
        for (let i = 0; i < MAX_INVITATIONS_PER_INVITER_PER_HOUR; i++) {
            await grantRoleToFarm(
                fdm,
                rateLimitOwnerPrincipalId,
                `rl_target_${i}@example.com`,
                rateLimitFarmId,
                "advisor",
            )
        }

        // The next one should be rejected by the rate limiter
        await expect(
            grantRoleToFarm(
                fdm,
                rateLimitOwnerPrincipalId,
                "rl_overflow@example.com",
                rateLimitFarmId,
                "advisor",
            ),
        ).rejects.toThrowError("Exception for grantRoleToFarm")
    })

    it("should reject when target already has too many pending invitations", async () => {
        const targetEmail = "pending_flood@example.com"

        // Create MAX farms and invite the same target to each
        for (let i = 0; i < MAX_INVITATIONS_PENDING_PER_TARGET; i++) {
            const farmId = await addFarm(
                fdm,
                pendingCapOwnerPrincipalId,
                `Flood Farm ${i}`,
                `FLD${String(i).padStart(3, "0")}`,
                "Flood Street",
                "66666",
            )
            await grantRoleToFarm(
                fdm,
                pendingCapOwnerPrincipalId,
                targetEmail,
                farmId,
                "advisor",
            )
        }

        // The next invitation to the same target should be rejected
        const overflowFarmId = await addFarm(
            fdm,
            pendingCapOwnerPrincipalId,
            "Flood Farm Overflow",
            "FLDX01",
            "Flood Street",
            "66666",
        )
        await expect(
            grantRoleToFarm(
                fdm,
                pendingCapOwnerPrincipalId,
                targetEmail,
                overflowFarmId,
                "advisor",
            ),
        ).rejects.toThrowError("Exception for grantRoleToFarm")
    })
})
