import { and, desc, eq, isNotNull, isNull } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, inject, it } from "vitest"
import { type BetterAuth, createFdmAuth } from "./authentication"
import {
    actions,
    checkPermission,
    getRolesOfPrincipalForResource,
    grantRole,
    listPrincipalsForResource,
    listResources,
    resources,
    revokePrincipal,
    roles,
    updateRole,
} from "./authorization"
import * as authNSchema from "./db/schema-authn"
import * as authZSchema from "./db/schema-authz"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.d"
import { createId } from "./id"

describe("Authorization Functions", () => {
    let fdm: FdmServerType
    let fdmAuth: BetterAuth
    let principal_id: string
    let farm_id: string
    let organization_id: string
    let organization_owner_id: string
    let organization_member_email: string
    let organization_member_id: string
    let host: string
    let port: number
    let user: string
    let password: string
    let database: string

    beforeAll(async () => {
        host = inject("host")
        port = inject("port")
        user = inject("user")
        password = inject("password")
        database = inject("database")
        // Mock environment variables
        const googleAuth = {
            clientId: "mock_google_client_id",
            clientSecret: "mock_google_client_secret",
        }
        const microsoftAuth = {
            clientId: "mock_ms_client_id",
            clientSecret: "mock_ms_client_secret",
        }

        fdm = createFdmServer(host, port, user, password, database, 10) // allow some connections
        fdmAuth = createFdmAuth(fdm, googleAuth, microsoftAuth, undefined, true)
        principal_id = createId()
    })

    beforeEach(async () => {
        farm_id = createId()
        // Create a test farm
        const farmName = "Test Farm"
        const farmBusinessId = "123456"
        const farmAddress = "123 Farm Lane"
        const farmPostalCode = "12345"
        await addFarm(
            fdm,
            farmName,
            farmBusinessId,
            farmAddress,
            farmPostalCode,
            principal_id,
        )
        const organization_owner_username = `orgowner${createId(8).toLowerCase()}`
        const organization_owner: any = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${organization_owner_username}@example.com`,
                name: "Organization Owner",
                firstname: "Organization",
                surname: "Owner",
                username: organization_owner_username,
                password: "password",
            } as any,
        })
        organization_owner_id = organization_owner.user.id

        organization_id = createId()
        await fdm.insert(authNSchema.organization).values({
            id: organization_id,
            name: "Test Organization",
            slug: `test-org-${createId(8).toLowerCase()}`,
            createdAt: new Date(),
            metadata: JSON.stringify({ description: "Test organization" }),
        })

        // Make the owner a member
        await fdm.insert(authNSchema.member).values({
            id: createId(),
            organizationId: organization_id,
            userId: organization_owner_id,
            role: "owner",
            createdAt: new Date(),
        })

        // Set up member details for tests
        organization_member_email = `member${createId(8).toLowerCase()}@example.com`
        const member_user: any = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: organization_member_email,
                name: "Organization Member",
                firstname: "Organization",
                surname: "Member",
                username: `member${createId(8).toLowerCase()}`,
                password: "password",
            } as any,
        })
        organization_member_id = member_user.user.id

        // Manually add member to organization
        await fdm.insert(authNSchema.member).values({
            id: createId(),
            organizationId: organization_id,
            userId: organization_member_id,
            role: "member",
            createdAt: new Date(),
        })
    })

    describe("checkPermission", () => {
        it("should allow access if principal has the required role", async () => {
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)
            await checkPermission(
                fdm,
                "farm",
                "read",
                farm_id,
                principal_id,
                "test",
            )
        })

        it("should throw an error if principal does not have the required role", async () => {
            await expect(
                checkPermission(
                    fdm,
                    "farm",
                    "read",
                    farm_id,
                    createId(),
                    "test",
                ),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })

        it("should not throw an error in non-strict mode if principal does not have the required role", async () => {
            await expect(
                checkPermission(
                    fdm,
                    "farm",
                    "read",
                    farm_id,
                    createId(),
                    "test",
                    false,
                ),
            ).resolves.toBe(false)
        })

        it("should grant access through the organization", async () => {
            await grantRole(fdm, "farm", "owner", farm_id, organization_id)

            await checkPermission(
                fdm,
                "farm",
                "write",
                farm_id,
                organization_member_id,
                "test",
            )
        })

        it("should not grant access through an organization not invited to a farm", async () => {
            await expect(
                checkPermission(
                    fdm,
                    "farm",
                    "write",
                    farm_id,
                    organization_id,
                    "test",
                ),
            ).rejects.toThrow(
                "Principal does not have permission to perform this action",
            )
        })

        it("should not grant permissions higher than the organization permissions", async () => {
            await grantRole(fdm, "farm", "researcher", farm_id, organization_id)

            await expect(
                checkPermission(
                    fdm,
                    "farm",
                    "write",
                    farm_id,
                    organization_member_id,
                    "test",
                ),
            ).rejects.toThrow(
                "Principal does not have permission to perform this action",
            )
        })

        it("should throw an error for unknown resource", async () => {
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)
            await expect(
                checkPermission(
                    fdm,
                    // biome-ignore lint/suspicious/noExplicitAny: Used for testing validation
                    "unknown_resource" as any,
                    "read",
                    farm_id,
                    principal_id,
                    "test",
                ),
            ).rejects.toThrowError("Exception for checkPermission")
        })

        it("should store the audit log when a permission check is performed and allowed", async () => {
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)
            await checkPermission(
                fdm,
                "farm",
                "read",
                farm_id,
                principal_id,
                "test",
            )

            const auditLogs = await fdm
                .select()
                .from(authZSchema.audit)
                .where(eq(authZSchema.audit.principal_id, principal_id))
                .orderBy(desc(authZSchema.audit.audit_timestamp))
            expect(auditLogs.length).toBeGreaterThanOrEqual(1)
            expect(auditLogs[0].target_resource).toBe("farm")
            expect(auditLogs[0].target_resource_id).toBe(farm_id)
            expect(auditLogs[0].action).toBe("read")
            expect(auditLogs[0].allowed).toBe(true)
        })

        it("should store the audit log when a permission check is performed and not allowed", async () => {
            const principal_id_new = createId()

            await expect(
                checkPermission(
                    fdm,
                    "farm",
                    "read",
                    farm_id,
                    principal_id_new,
                    "test",
                ),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )

            const auditLogs = await fdm
                .select()
                .from(authZSchema.audit)
                .where(eq(authZSchema.audit.principal_id, principal_id_new))
                .orderBy(desc(authZSchema.audit.audit_timestamp))
            expect(auditLogs.length).toBeGreaterThanOrEqual(1)
            expect(auditLogs[0].target_resource).toBe("farm")
            expect(auditLogs[0].target_resource_id).toBe(farm_id)
            expect(auditLogs[0].action).toBe("read")
            expect(auditLogs[0].allowed).toBe(false)
        })

        it("should not store the audit log if non-strict", async () => {
            const principal_id_new = createId()

            await expect(
                checkPermission(
                    fdm,
                    "farm",
                    "read",
                    farm_id,
                    principal_id_new,
                    "test",
                    false,
                ),
            ).resolves.toBe(false)

            const auditLogs = await fdm
                .select()
                .from(authZSchema.audit)
                .where(eq(authZSchema.audit.principal_id, principal_id_new))
                .orderBy(desc(authZSchema.audit.audit_timestamp))
            expect(auditLogs).toHaveLength(0)
        })
    })

    describe("grantRole", () => {
        it("should grant a role to a principal for a resource", async () => {
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)

            const roles = await fdm
                .select()
                .from(authZSchema.role)
                .where(
                    and(
                        eq(authZSchema.role.resource, "farm"),
                        eq(authZSchema.role.resource_id, farm_id),
                        eq(authZSchema.role.principal_id, principal_id),
                        eq(authZSchema.role.role, "owner"),
                        isNull(authZSchema.role.deleted),
                    ),
                )
            expect(roles.length).toBe(1)
        })

        it("should throw an error for invalid resource", async () => {
            await expect(
                grantRole(
                    fdm,
                    // biome-ignore lint/suspicious/noExplicitAny: Used for testing validation
                    "unknown_resource" as any,
                    "owner",
                    farm_id,
                    principal_id,
                ),
            ).rejects.toThrowError()
        })

        it("should throw an error for invalid role", async () => {
            await expect(
                grantRole(
                    fdm,
                    "farm",
                    // biome-ignore lint/suspicious/noExplicitAny: Used for testing validation
                    "unknown_role" as any,
                    farm_id,
                    principal_id,
                ),
            ).rejects.toThrowError()
        })

        it("should throw an error for invalid principal_id", async () => {
            await expect(
                // biome-ignore lint/suspicious/noExplicitAny: Used for testing validation
                grantRole(fdm, "farm", "owner", farm_id, null as any),
            ).rejects.toThrowError()
        })

        it("should throw an error if the principal already has a non-deleted role", async () => {
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)

            await expect(
                grantRole(fdm, "farm", "advisor", farm_id, principal_id),
            ).rejects.toThrowError("Exception for grantRole")
        })
    })

    describe("revokePrincipal", () => {
        it("should revoke a role from a principal for a resource", async () => {
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)
            await revokePrincipal(fdm, "farm", farm_id, principal_id)

            const roles = await fdm
                .select()
                .from(authZSchema.role)
                .where(
                    and(
                        eq(authZSchema.role.resource, "farm"),
                        eq(authZSchema.role.resource_id, farm_id),
                        eq(authZSchema.role.principal_id, principal_id),
                        eq(authZSchema.role.role, "owner"),
                        isNotNull(authZSchema.role.deleted),
                    ),
                )
            expect(roles.length).toBe(1)
        })

        it("should not throw an error when revoking a non-existing role", async () => {
            await revokePrincipal(fdm, "farm", farm_id, principal_id)
            const roles = await fdm
                .select()
                .from(authZSchema.role)
                .where(
                    and(
                        eq(authZSchema.role.resource, "farm"),
                        eq(authZSchema.role.resource_id, farm_id),
                        eq(authZSchema.role.principal_id, principal_id),
                        eq(authZSchema.role.role, "owner"),
                        isNotNull(authZSchema.role.deleted),
                    ),
                )
            expect(roles.length).toBe(0)
        })

        it("should throw an error for invalid resource", async () => {
            await expect(
                revokePrincipal(
                    fdm,
                    // biome-ignore lint/suspicious/noExplicitAny: Used for testing validation
                    "unknown_resource" as any,
                    farm_id,
                    principal_id,
                ),
            ).rejects.toThrowError()
        })
    })

    describe("updateRole", () => {
        it("should update the role of a principal for a resource", async () => {
            // Grant initial role
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)

            // Update the role
            await updateRole(fdm, "farm", "advisor", farm_id, principal_id)

            // Verify the new role
            const newRole = await fdm
                .select()
                .from(authZSchema.role)
                .where(
                    and(
                        eq(authZSchema.role.resource, "farm"),
                        eq(authZSchema.role.resource_id, farm_id),
                        eq(authZSchema.role.principal_id, principal_id),
                        eq(authZSchema.role.role, "advisor"),
                        isNull(authZSchema.role.deleted),
                    ),
                )
            expect(newRole.length).toBe(1)

            // Verify the old role is revoked
            const oldRole = await fdm
                .select()
                .from(authZSchema.role)
                .where(
                    and(
                        eq(authZSchema.role.resource, "farm"),
                        eq(authZSchema.role.resource_id, farm_id),
                        eq(authZSchema.role.principal_id, principal_id),
                        eq(authZSchema.role.role, "owner"),
                    ),
                )
            expect(oldRole.length).toBe(1)
            expect(oldRole[0].deleted).not.toBeNull()
        })

        it("should throw an error for invalid resource", async () => {
            await expect(
                updateRole(
                    fdm,
                    // biome-ignore lint/suspicious/noExplicitAny: Used for testing validation
                    "unknown_resource" as any,
                    "advisor",
                    farm_id,
                    principal_id,
                ),
            ).rejects.toThrowError("Exception for updateRole")
        })

        it("should throw an error for invalid role", async () => {
            await expect(
                updateRole(
                    fdm,
                    "farm",
                    // biome-ignore lint/suspicious/noExplicitAny: Used for testing validation
                    "unknown_role" as any,
                    farm_id,
                    principal_id,
                ),
            ).rejects.toThrowError("Exception for updateRole")
        })

        it("should throw an error if the database transaction fails", async () => {
            // Mock the transaction function to throw an error
            const mockTx = async () => {
                throw new Error("Database transaction failed")
            }
            const fdmMock = {
                ...fdm,
                transaction: mockTx,
            }
            // Act & Assert
            await expect(
                updateRole(fdmMock, "farm", "advisor", farm_id, principal_id),
            ).rejects.toThrowError("Exception for updateRole")
        })

        it("should handle case when no old role to revoke", async () => {
            // Update the role
            await updateRole(fdm, "farm", "advisor", farm_id, principal_id)

            // Verify the new role
            const newRole = await fdm
                .select()
                .from(authZSchema.role)
                .where(
                    and(
                        eq(authZSchema.role.resource, "farm"),
                        eq(authZSchema.role.resource_id, farm_id),
                        eq(authZSchema.role.principal_id, principal_id),
                        eq(authZSchema.role.role, "advisor"),
                        isNull(authZSchema.role.deleted),
                    ),
                )
            expect(newRole.length).toBe(1)

            // Verify no old role is revoked
            const oldRole = await fdm
                .select()
                .from(authZSchema.role)
                .where(
                    and(
                        eq(authZSchema.role.resource, "farm"),
                        eq(authZSchema.role.resource_id, farm_id),
                        eq(authZSchema.role.principal_id, principal_id),
                        eq(authZSchema.role.role, "owner"),
                    ),
                )
            expect(oldRole.length).toBe(0)
        })
        it("should handle updating the role to a non existing role", async () => {
            // Grant initial role
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)

            // Update the role
            await updateRole(fdm, "farm", "researcher", farm_id, principal_id)

            // Verify the new role
            const newRole = await fdm
                .select()
                .from(authZSchema.role)
                .where(
                    and(
                        eq(authZSchema.role.resource, "farm"),
                        eq(authZSchema.role.resource_id, farm_id),
                        eq(authZSchema.role.principal_id, principal_id),
                        eq(authZSchema.role.role, "researcher"),
                        isNull(authZSchema.role.deleted),
                    ),
                )
            expect(newRole.length).toBe(1)

            // Verify the old role is revoked
            const oldRole = await fdm
                .select()
                .from(authZSchema.role)
                .where(
                    and(
                        eq(authZSchema.role.resource, "farm"),
                        eq(authZSchema.role.resource_id, farm_id),
                        eq(authZSchema.role.principal_id, principal_id),
                        eq(authZSchema.role.role, "owner"),
                    ),
                )
            expect(oldRole.length).toBe(1)
            expect(oldRole[0].deleted).not.toBeNull()
        })
    })

    describe("listResources", () => {
        it("should list resources a principal has access to", async () => {
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)

            const accessibleResources = await listResources(
                fdm,
                "farm",
                "read",
                principal_id,
            )
            expect(accessibleResources).toContain(farm_id)
        })

        it("should handle multiple roles", async () => {
            const principal_id_new = createId()
            const farm_id2 = createId()
            await grantRole(fdm, "farm", "owner", farm_id, principal_id_new)
            await grantRole(fdm, "farm", "advisor", farm_id2, principal_id_new)

            const accessibleResources = await listResources(
                fdm,
                "farm",
                "read",
                principal_id_new,
            )
            expect(accessibleResources.length).toBe(2)
            expect(accessibleResources).toContain(farm_id)
            expect(accessibleResources).toContain(farm_id2)
        })

        it("should list resources that the user's organization has access to", async () => {
            const farm_id2 = createId()
            await grantRole(fdm, "farm", "owner", farm_id, organization_id)
            await grantRole(fdm, "farm", "advisor", farm_id2, organization_id)

            const accessibleResources = await listResources(
                fdm,
                "farm",
                "read",
                organization_member_id,
            )
            expect(accessibleResources.length).toBe(2)
            expect(accessibleResources).toContain(farm_id)
            expect(accessibleResources).toContain(farm_id2)
        })

        it("should not list duplicates", async () => {
            await grantRole(
                fdm,
                "farm",
                "owner",
                farm_id,
                organization_member_id,
            )
            await grantRole(fdm, "farm", "advisor", farm_id, organization_id)

            const accessibleResources = await listResources(
                fdm,
                "farm",
                "read",
                organization_member_id,
            )
            expect(accessibleResources).toEqual([farm_id])
        })

        it("should handle empty list", async () => {
            const principal_id_new = createId()
            const accessibleResources = await listResources(
                fdm,
                "farm",
                "read",
                principal_id_new,
            )
            expect(accessibleResources.length).toBe(0)
        })
        it("should handle invalid resource", async () => {
            await expect(
                listResources(
                    fdm,
                    // biome-ignore lint/suspicious/noExplicitAny: Checking validation with unit test
                    "unknown_resource" as any,
                    "read",
                    principal_id,
                ),
            ).rejects.toThrowError()
        })
        it("should handle invalid action", async () => {
            await expect(
                listResources(
                    fdm,
                    "farm",
                    // biome-ignore lint/suspicious/noExplicitAny: Checking validation with unit test
                    "unknown_action" as any,
                    principal_id,
                ),
            ).rejects.toThrowError()
        })
    })

    describe("getRolesOfPrincipalForResource", () => {
        it("should get direct roles", async () => {
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)

            const roles = await getRolesOfPrincipalForResource(
                fdm,
                "farm",
                farm_id,
                principal_id,
            )
            expect(roles).toEqual([
                {
                    principal_id: principal_id,
                    role: "owner",
                    principal_type: "user",
                },
            ])
        })

        // it("should get inherited roles", async () => {
        //     const field_id = await addField(
        //         fdm,
        //         principal_id,
        //         farm_id,
        //         "Test Field",
        //         "test source",
        //         {
        //             type: "Polygon",
        //             coordinates: [
        //                 [
        //                     [30, 10],
        //                     [40, 40],
        //                     [20, 40],
        //                     [10, 20],
        //                     [30, 10],
        //                 ],
        //             ],
        //         },
        //         new Date("2023-01-01"),
        //         "owner",
        //         new Date("2024-01-01"),
        //     )
        //     await grantRole(fdm, "farm", "owner", farm_id, principal_id)
        //     await grantRole(fdm, "field", "advisor", field_id, principal_id)

        //     const roles = await getRolesOfPrincipalForResource(
        //         fdm,
        //         "field",
        //         field_id,
        //         principal_id,
        //     )
        //     expect(roles).toEqual(["advisor", "owner"])
        // })

        // it("should get direct roles without inherited roles", async () => {
        //     const field_id = await addField(
        //         fdm,
        //         principal_id,
        //         farm_id,
        //         "Test Field",
        //         "test source",
        //         {
        //             type: "Polygon",
        //             coordinates: [
        //                 [
        //                     [30, 10],
        //                     [40, 40],
        //                     [20, 40],
        //                     [10, 20],
        //                     [30, 10],
        //                 ],
        //             ],
        //         },
        //         new Date("2023-01-01"),
        //         "owner",
        //         new Date("2024-01-01"),
        //     )

        //     await grantRole(fdm, "farm", "advisor", farm_id, principal_id)
        //     await grantRole(fdm, "field", "advisor", field_id, principal_id)

        //     const roles = await getRolesOfPrincipalForResource(
        //         fdm,
        //         "field",
        //         field_id,
        //         principal_id,
        //     )
        //     expect(roles).toEqual(["advisor"])
        // })

        it("should return an empty array if the principal has no roles for the resource", async () => {
            const other_principal_id = createId()

            const roles = await getRolesOfPrincipalForResource(
                fdm,
                "farm",
                farm_id,
                other_principal_id,
            )
            expect(roles).toEqual([])
        })

        it("should get roles derived from an organization", async () => {
            await grantRole(fdm, "farm", "researcher", farm_id, organization_id)

            const roles = await getRolesOfPrincipalForResource(
                fdm,
                "farm",
                farm_id,
                organization_member_id,
            )
            expect(roles).toEqual([
                {
                    principal_id: organization_id,
                    principal_type: "organization",
                    role: "researcher",
                },
            ])
        })

        it("should get all roles", async () => {
            await grantRole(
                fdm,
                "farm",
                "researcher",
                farm_id,
                organization_member_id,
            )
            await grantRole(fdm, "farm", "owner", farm_id, organization_id)

            const roles = await getRolesOfPrincipalForResource(
                fdm,
                "farm",
                farm_id,
                organization_member_id,
            )
            expect(roles.length).toBe(2)
            expect(roles).toContainEqual({
                principal_id: organization_id,
                principal_type: "organization",
                role: "owner",
            })
            expect(roles).toContainEqual({
                principal_id: organization_member_id,
                principal_type: "user",
                role: "researcher",
            })
        })

        it("should get organization's roles as organization roles", async () => {
            await grantRole(fdm, "farm", "researcher", farm_id, organization_id)

            const roles = await getRolesOfPrincipalForResource(
                fdm,
                "farm",
                farm_id,
                organization_id,
            )
            expect(roles).toEqual([
                {
                    principal_id: organization_id,
                    principal_type: "organization",
                    role: "researcher",
                },
            ])
        })

        it("should throw error with invalid resource", async () => {
            await expect(
                getRolesOfPrincipalForResource(
                    fdm,
                    // biome-ignore lint/suspicious/noExplicitAny: Used for testing validation
                    "unknown_resource" as any,
                    farm_id,
                    principal_id,
                ),
            ).rejects.toThrowError(
                "Exception for getRolesOfPrincipalForResource",
            )
        })

        it("should throw an error if the database transaction fails", async () => {
            // Mock the transaction function to throw an error
            const mockTx = async () => {
                throw new Error("Database transaction failed")
            }
            const fdmMock = {
                ...fdm,
                transaction: mockTx,
            }
            // Act & Assert
            await expect(
                getRolesOfPrincipalForResource(
                    fdmMock,
                    "farm",
                    farm_id,
                    principal_id,
                ),
            ).rejects.toThrowError(
                "Exception for getRolesOfPrincipalForResource",
            )
        })
    })

    describe("listPrincipalsForResource", () => {
        let principal_id2: string

        beforeEach(async () => {
            principal_id2 = createId()
        })

        it("should list principals associated with a resource", async () => {
            // Grant roles to two principals
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)
            await grantRole(fdm, "farm", "advisor", farm_id, principal_id2)

            const principals = await listPrincipalsForResource(
                fdm,
                "farm",
                farm_id,
            )

            expect(principals.length).toBe(2)
            expect(principals).toContainEqual({
                principal_id: principal_id,
                role: "owner",
            })
            expect(principals).toContainEqual({
                principal_id: principal_id2,
                role: "advisor",
            })
        })

        it("should return an empty array if no principals are associated with the resource", async () => {
            const principals = await listPrincipalsForResource(
                fdm,
                "farm",
                farm_id,
            )
            expect(principals).toEqual([])
        })

        it("should throw an error for an invalid resource type", async () => {
            await expect(
                listPrincipalsForResource(
                    fdm,
                    // biome-ignore lint/suspicious/noExplicitAny: Used for testing validation
                    "invalid_resource" as any,
                    farm_id,
                ),
            ).rejects.toThrowError("Exception for listPrincipalsForResource")
        })

        it("should handle revoked principals correctly", async () => {
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)
            await revokePrincipal(fdm, "farm", farm_id, principal_id)

            const principals = await listPrincipalsForResource(
                fdm,
                "farm",
                farm_id,
            )
            expect(principals).toEqual([])
        })

        it("should not list revoked roles", async () => {
            // Grant and then revoke the role
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)
            await revokePrincipal(fdm, "farm", farm_id, principal_id)

            // Now check if the role is present in the list
            const result = await listPrincipalsForResource(fdm, "farm", farm_id)
            expect(result.length).toBe(0)
        })

        it("should throw an error if the database transaction fails", async () => {
            // Mock the transaction function to throw an error
            const mockTx = async () => {
                throw new Error("Database transaction failed")
            }
            const fdmMock = {
                ...fdm,
                transaction: mockTx,
            }
            // Act & Assert
            await expect(
                listPrincipalsForResource(fdmMock, "farm", farm_id),
            ).rejects.toThrowError("Exception for listPrincipalsForResource")
        })

        it("should handle different resources", async () => {
            for (const resource of resources) {
                if (resource === "user" || resource === "organization") continue // these resources are not added by the code
                const testResourceId = createId()
                await grantRole(
                    fdm,
                    resource,
                    "owner",
                    testResourceId,
                    principal_id,
                )
                const principals = await listPrincipalsForResource(
                    fdm,
                    resource,
                    testResourceId,
                )

                expect(principals.length).toBe(1)
                expect(principals).toContainEqual({
                    principal_id: principal_id,
                    role: "owner",
                })
            }
        })

        it("should have the correct properties on the result object", async () => {
            await grantRole(fdm, "farm", "owner", farm_id, principal_id)
            const result = await listPrincipalsForResource(fdm, "farm", farm_id)

            expect(result.length).toBe(1)
            expect(result[0]).toHaveProperty("principal_id")
            expect(result[0]).toHaveProperty("role")
            expect(typeof result[0].principal_id).toBe("string")
            expect(typeof result[0].role).toBe("string")
        })
    })
    describe("Authorization Constants", () => {
        it("should have the correct resources", () => {
            expect(resources).toEqual([
                "user",
                "organization",
                "farm",
                "field",
                "cultivation",
                "fertilizer_application",
                "soil_analysis",
                "harvesting",
            ])
        })

        it("should have the correct roles", () => {
            expect(roles).toEqual(["owner", "advisor", "researcher"])
        })

        it("should have the correct actions", () => {
            expect(actions).toEqual(["read", "write", "list", "share"])
        })
    })
})
