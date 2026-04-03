import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmAuth } from "./authentication"
import { createFdmAuth } from "./authentication"
import { listPrincipalsForResource } from "./authorization"
import * as schema from "./db/schema"
import * as authNSchema from "./db/schema-authn"
import * as authZSchema from "./db/schema-authz"
import {
    addFarm,
    cancelInvitationForFarm,
    getFarm,
    getFarms,
    grantRoleToFarm,
    isAllowedToDeleteFarm,
    isAllowedToShareFarm,
    listPendingInvitationsForFarm,
    listPendingInvitationsForUser,
    listPrincipalsForFarm,
    removeFarm,
    revokePrincipalFromFarm,
    updateFarm,
    updateRoleOfInvitationForFarm,
    updateRoleOfPrincipalAtFarm,
} from "./farm"
import type { FdmType } from "./fdm"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.d"
import { addFertilizer, addFertilizerToCatalogue } from "./fertilizer"
import { addField, getFields } from "./field"
import { createId } from "./id"
import { acceptInvitation, declineInvitation } from "./invitation"
import { getPrincipal } from "./principal"

describe("Farm Functions", () => {
    let fdm: FdmServerType
    let principal_id: string
    let target_username: string
    let target_id: string
    let b_id_farm: string
    let farmName: string
    let farmBusinessId: string
    let farmAddress: string
    let farmPostalCode: string
    let fdmAuth: FdmAuth

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

        // Create principal_id
        const user1 = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "user10@example.com",
                name: "user10",
                username: "user10",
                password: "password",
            } as any,
        })
        principal_id = user1.user.id

        // Create target_username
        target_username = "user15"
        const target = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: "user15@example.com",
                name: "user15",
                username: target_username,
                password: "password",
            } as any,
        })
        target_id = target.user.id

        // Mark target's email as verified so acceptInvitation works
        await fdm
            .update(authNSchema.user)
            .set({ emailVerified: true })
            .where(eq(authNSchema.user.id, target_id))

        // Create a test farm
        farmName = "Test Farm"
        farmBusinessId = "123456"
        farmAddress = "123 Farm Lane"
        farmPostalCode = "12345"
        b_id_farm = await addFarm(
            fdm,
            principal_id,
            farmName,
            farmBusinessId,
            farmAddress,
            farmPostalCode,
        )
    })
    describe("getFarm", () => {
        it("should retrieve a farm's details if the principal has read access", async () => {
            const farm = await getFarm(fdm, principal_id, b_id_farm)
            expect(farm).toEqual(
                expect.objectContaining({
                    b_id_farm: b_id_farm,
                    b_name_farm: farmName,
                    b_businessid_farm: farmBusinessId,
                    b_address_farm: farmAddress,
                    b_postalcode_farm: farmPostalCode,
                    roles: [
                        {
                            principal_id: principal_id,
                            principal_type: "user",
                            role: "owner",
                        },
                    ],
                }),
            )
        })

        it("should throw an error if the principal does not have read access", async () => {
            const other_principal_id = createId()
            await expect(
                getFarm(fdm, other_principal_id, b_id_farm),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })

        it("should handle errors during farm retrieval", async () => {
            // Mock the select function to throw an error
            const mockSelect = async () => {
                throw new Error("Database query failed")
            }
            const fdmMock = {
                ...fdm,
                transaction: async (cb: (tx: FdmType) => Promise<FdmType>) => {
                    // provide a tx object whose select throws
                    const tx = { select: mockSelect }
                    return cb(tx)
                },
            } as unknown as FdmType
            await expect(
                getFarm(fdmMock, principal_id, b_id_farm),
            ).rejects.toThrowError("Exception for getFarm")
        })
    })

    describe("getFarms", () => {
        it("should retrieve a list of farms accessible by the principal", async () => {
            const farms = await getFarms(fdm, principal_id)
            expect(farms).toBeDefined()
            expect(farms.length).toBeGreaterThanOrEqual(1)
            expect(
                farms.some((farm) => farm.b_id_farm === b_id_farm),
            ).toBeTruthy() // Assert that the test farm is in the list
        })

        it("should handle errors during farm list retrieval", async () => {
            // Mock the listResources function to throw an error
            const mockListResources = async () => {
                throw new Error("Listing resources failed")
            }
            const authorizationMock = {
                ...fdm,
                listResources: mockListResources,
            }
            await expect(
                getFarms(authorizationMock, principal_id),
            ).rejects.toThrowError("Exception for getFarms")
        })
    })

    describe("updateFarm", () => {
        it("should update a farm's details if the principal has write access", async () => {
            const updatedFarmName = "Updated Farm Name"
            const updatedFarmBusinessId = "987654"
            const updatedFarmAddress = "789 Updated Lane"
            const updatedFarmPostalCode = "98765"

            const updatedFarm = await updateFarm(
                fdm,
                principal_id,
                b_id_farm,
                updatedFarmName,
                updatedFarmBusinessId,
                updatedFarmAddress,
                updatedFarmPostalCode,
            )

            expect(updatedFarm).toEqual(
                expect.objectContaining({
                    b_id_farm: b_id_farm,
                    b_name_farm: updatedFarmName,
                    b_businessid_farm: updatedFarmBusinessId,
                    b_address_farm: updatedFarmAddress,
                    b_postalcode_farm: updatedFarmPostalCode,
                }),
            )
        })

        it("should throw an error if the principal does not have write access", async () => {
            const other_principal_id = createId()
            const updatedFarmName = "Updated Farm Name"
            const updatedFarmBusinessId = "987654"
            const updatedFarmAddress = "789 Updated Lane"
            const updatedFarmPostalCode = "98765"

            await expect(
                updateFarm(
                    fdm,
                    other_principal_id,
                    b_id_farm,
                    updatedFarmName,
                    updatedFarmBusinessId,
                    updatedFarmAddress,
                    updatedFarmPostalCode,
                ),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })

        it("should handle errors during farm update", async () => {
            // Mock the update function to throw an error
            const mockUpdate = async () => {
                throw new Error("Database update failed")
            }
            const fdmMock = {
                ...fdm,
                update: mockUpdate,
            }

            const updatedFarmName = "Updated Farm Name"
            const updatedFarmBusinessId = "987654"
            const updatedFarmAddress = "789 Updated Lane"
            const updatedFarmPostalCode = "98765"

            await expect(
                updateFarm(
                    fdmMock,
                    principal_id,
                    b_id_farm,
                    updatedFarmName,
                    updatedFarmBusinessId,
                    updatedFarmAddress,
                    updatedFarmPostalCode,
                ),
            ).rejects.toThrowError("Exception for updateFarm")
        })
    })

    describe("grantRoleToFarm", () => {
        it("should create an invitation for a principal for a given farm", async () => {
            await grantRoleToFarm(
                fdm,
                principal_id,
                target_username,
                b_id_farm,
                "advisor",
            )

            // Verify invitation was created (not a direct role grant)
            const invitations = await fdm
                .select()
                .from(authZSchema.invitation)
                .where(eq(authZSchema.invitation.resource_id, b_id_farm))
            const invitation = invitations.find(
                (i) => i.target_principal_id === target_id,
            )
            expect(invitation).toBeDefined()
            expect(invitation?.role).toBe("advisor")
            expect(invitation?.status).toBe("pending")

            if (!invitation) {
                throw new Error(
                    "Test did not create an invitation as expected, cannot continue with test",
                )
            }
            // Accept the invitation so subsequent tests (updateRole, revoke) work
            await acceptInvitation(fdm, invitation.invitation_id, target_id)

            // Now the role should be granted
            const principals = await listPrincipalsForResource(
                fdm,
                "farm",
                b_id_farm,
            )
            const advisor = principals.find((p) => p.principal_id === target_id)
            expect(advisor).toEqual(
                expect.objectContaining({
                    principal_id: target_id,
                    role: "advisor",
                }),
            )
        })

        it("should throw an error if the principal does not have share permission", async () => {
            const other_principal_id = createId()
            await expect(
                grantRoleToFarm(
                    fdm,
                    other_principal_id,
                    target_username,
                    b_id_farm,
                    "advisor",
                ),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })

        it("should handle errors during the grant role process", async () => {
            // Mock the checkPermission function to throw an error
            const mockCheckPermission = async () => {
                throw new Error("Permission check failed")
            }
            const fdmMock = {
                ...fdm,
                checkPermission: mockCheckPermission,
            }

            await expect(
                grantRoleToFarm(
                    fdmMock,
                    principal_id,
                    target_username,
                    b_id_farm,
                    "advisor",
                ),
            ).rejects.toThrowError("Exception for grantRoleToFarm")
        })

        it("should throw an error if the target principal does not exist", async () => {
            const nonExistentUsername = "nonexistentuser"
            await expect(
                grantRoleToFarm(
                    fdm,
                    principal_id,
                    nonExistentUsername,
                    b_id_farm,
                    "advisor",
                ),
            ).rejects.toThrowError("Exception for grantRoleToFarm")
        })

        it("should throw an error if target is already a member of the farm", async () => {
            // target_id already has advisor role from the first test
            await expect(
                grantRoleToFarm(
                    fdm,
                    principal_id,
                    target_username,
                    b_id_farm,
                    "advisor",
                ),
            ).rejects.toThrowError("Exception for grantRoleToFarm")
        })

        it("should create an email-based invitation for an unregistered email", async () => {
            const unregisteredEmail = "newuser_unregistered@example.com"
            await grantRoleToFarm(
                fdm,
                principal_id,
                unregisteredEmail,
                b_id_farm,
                "researcher",
            )

            const invitations = await fdm
                .select()
                .from(authZSchema.invitation)
                .where(
                    eq(authZSchema.invitation.target_email, unregisteredEmail),
                )
            expect(invitations.length).toBeGreaterThanOrEqual(1)
            expect(invitations[0].status).toBe("pending")
            expect(invitations[0].role).toBe("researcher")
        })
    })

    describe("updateRoleOfPrincipalAtFarm", () => {
        it("should update a role to a principal for a given farm", async () => {
            await updateRoleOfPrincipalAtFarm(
                fdm,
                principal_id,
                target_username,
                b_id_farm,
                "researcher",
            )

            const principals = await listPrincipalsForResource(
                fdm,
                "farm",
                b_id_farm,
            )
            const researcher = principals.find((p) => p.role === "researcher")

            expect(researcher).toEqual(
                expect.objectContaining({
                    principal_id: researcher?.principal_id,
                    role: "researcher",
                }),
            )
        })

        it("should throw an error if the principal does not have share permission", async () => {
            const other_principal_id = createId()
            await expect(
                updateRoleOfPrincipalAtFarm(
                    fdm,
                    other_principal_id,
                    target_username,
                    b_id_farm,
                    "researcher",
                ),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })

        it("should handle errors during the update role process", async () => {
            // Mock the updateRole function to throw an error
            const mockUpdateRole = async () => {
                throw new Error("Update role failed")
            }
            const fdmMock = {
                ...fdm,
                updateRole: mockUpdateRole,
            }

            await expect(
                updateRoleOfPrincipalAtFarm(
                    fdmMock,
                    principal_id,
                    target_username,
                    b_id_farm,
                    "researcher",
                ),
            ).rejects.toThrowError("Exception for updateRoleOfPrincipalAtFarm")
        })

        it("should throw an error if target principal does not exist", async () => {
            const nonExistentUsername = "nonexistentuser"
            await expect(
                updateRoleOfPrincipalAtFarm(
                    fdm,
                    principal_id,
                    nonExistentUsername,
                    b_id_farm,
                    "advisor",
                ),
            ).rejects.toThrowError("Exception for updateRoleOfPrincipalAtFarm")
        })
    })

    describe("revokePrincipalFromFarm", () => {
        it("should revoke a principal from a given farm", async () => {
            await revokePrincipalFromFarm(
                fdm,
                principal_id,
                target_username,
                b_id_farm,
            )

            const targetPrincipal = await getPrincipal(fdm, target_username)

            const principals = await listPrincipalsForResource(
                fdm,
                "farm",
                b_id_farm,
            )
            const revokee = principals.find(
                (p) => p.principal_id === targetPrincipal?.id,
            )

            expect(revokee).toBeUndefined()
        })

        it("should throw an error if the principal does not have share permission", async () => {
            const other_principal_id = createId()
            await expect(
                revokePrincipalFromFarm(
                    fdm,
                    other_principal_id,
                    target_username,
                    b_id_farm,
                ),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })

        it("should handle errors during the revoke principal process", async () => {
            // Mock the revokePrincipal function to throw an error
            const mockRevokePrincipal = async () => {
                throw new Error("Revoke principal failed")
            }
            const fdmMock = {
                ...fdm,
                revokePrincipal: mockRevokePrincipal,
            }
            await grantRoleToFarm(
                fdm,
                principal_id,
                target_username,
                b_id_farm,
                "advisor",
            )

            await expect(
                revokePrincipalFromFarm(
                    fdmMock,
                    principal_id,
                    target_username,
                    b_id_farm,
                ),
            ).rejects.toThrowError("Exception for revokePrincipalFromFarm")
        })

        it("should throw an error if the target principal does not exist", async () => {
            const nonExistentUsername = "nonexistentuser"

            await expect(
                revokePrincipalFromFarm(
                    fdm,
                    principal_id,
                    nonExistentUsername,
                    b_id_farm,
                ),
            ).rejects.toThrowError("Exception for revokePrincipalFromFarm")
        })

        it("should throw an error if trying to revoke the last owner", async () => {
            // revoke current user from owner role
            await expect(
                revokePrincipalFromFarm(
                    fdm,
                    principal_id,
                    principal_id,
                    b_id_farm,
                ),
            ).rejects.toThrowError("Exception for revokePrincipalFromFarm")
        })
    })

    describe("listPrincipalsForFarm", () => {
        it("should list principals associated with a farm", async () => {
            const principals = await listPrincipalsForFarm(
                fdm,
                principal_id,
                b_id_farm,
            )
            expect(principals).toBeDefined()
            expect(principals.length).toBeGreaterThanOrEqual(1)

            const ownerPrincipal = await getPrincipal(fdm, principal_id)
            const targetPrincipal = await getPrincipal(fdm, target_id)

            const owner = principals.find(
                (p) => p?.username === ownerPrincipal?.username,
            )
            expect(owner).toBeDefined()
            expect(owner?.username).toBe(ownerPrincipal?.username)
            expect(owner?.type).toBe(ownerPrincipal?.type)
            expect(owner?.isVerified).toBe(ownerPrincipal?.isVerified)

            const advisor = principals.find(
                (p) => p?.username === targetPrincipal?.username,
            )
            expect(advisor).toBeDefined()
            expect(advisor?.username).toBe(targetPrincipal?.username)
            expect(advisor?.type).toBe(targetPrincipal?.type)
            expect(advisor?.isVerified).toBe(targetPrincipal?.isVerified)
        })

        it("should handle errors during the list principals process", async () => {
            // Mock the listPrincipalsForResource function to throw an error
            const mockListPrincipalsForResource = async () => {
                throw new Error("Listing principals failed")
            }
            const fdmMock = {
                ...fdm,
                listPrincipalsForResource: mockListPrincipalsForResource,
            }

            await expect(
                listPrincipalsForFarm(fdmMock, principal_id, b_id_farm),
            ).rejects.toThrowError("Exception for listPrincipalsForFarm")
        })

        it("should throw an error if the principal does not have read access", async () => {
            const other_principal_id = createId()
            await expect(
                listPrincipalsForFarm(fdm, other_principal_id, b_id_farm),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })

        it("should include organization as a pending principal when org is invited", async () => {
            // No fdm-core API for org creation — use raw insert (same pattern as authorization.test.ts)
            const orgId = createId()
            const orgSlug = `listprincipals-org-${orgId.toLowerCase()}`
            await fdm.insert(authNSchema.organization).values({
                id: orgId,
                name: "ListPrincipals Org",
                slug: orgSlug,
                createdAt: new Date(),
            })

            const orgFarmId = await addFarm(
                fdm,
                principal_id,
                "Org Principals Farm",
                "ORGPRI",
                "Org Principals Lane",
                "20001",
            )
            await grantRoleToFarm(
                fdm,
                principal_id,
                orgSlug,
                orgFarmId,
                "advisor",
            )

            const principals = await listPrincipalsForFarm(
                fdm,
                principal_id,
                orgFarmId,
            )
            const orgPrincipal = principals.find((p) => p.id === orgId)
            expect(orgPrincipal).toBeDefined()
            expect(orgPrincipal?.type).toBe("organization")
        })

        it("should include invitation_id and invitation_expires_at for pending principals", async () => {
            const pendingFarmId = await addFarm(
                fdm,
                principal_id,
                "Pending Principals Farm",
                "PNDPRI",
                "Pending Lane",
                "20003",
            )
            await grantRoleToFarm(
                fdm,
                principal_id,
                target_username,
                pendingFarmId,
                "advisor",
            )

            const principals = await listPrincipalsForFarm(
                fdm,
                principal_id,
                pendingFarmId,
            )
            const pending = principals.find((p) => p.status === "pending")
            expect(pending).toBeDefined()
            expect(pending?.invitation_id).toBeDefined()
            expect(typeof pending?.invitation_id).toBe("string")
            expect(pending?.invitation_expires_at).toBeDefined()
            expect(pending?.invitation_expires_at).toBeInstanceOf(Date)
        })
    })

    describe("isAllowedToShareFarm", () => {
        it("should return true if principal is allowed to share the farm", async () => {
            const isAllowed = await isAllowedToShareFarm(
                fdm,
                principal_id,
                b_id_farm,
            )
            expect(isAllowed).toBe(true)
        })

        it("should return false if principal is not allowed to share the farm", async () => {
            const other_principal_id = createId()

            const isAllowed = await isAllowedToShareFarm(
                fdm,
                other_principal_id,
                b_id_farm,
            )

            expect(isAllowed).toBe(false)
        })
    })

    describe("isAllowedToDeleteFarm", () => {
        it("should return true if principal is allowed to delete the farm", async () => {
            const isAllowed = await isAllowedToDeleteFarm(
                fdm,
                principal_id,
                b_id_farm,
            )
            expect(isAllowed).toBe(true)
        })

        it("should return false if principal is not allowed to delete the farm", async () => {
            const other_principal_id = createId()

            const isAllowed = await isAllowedToDeleteFarm(
                fdm,
                other_principal_id,
                b_id_farm,
            )

            expect(isAllowed).toBe(false)
        })
    })

    describe("removeFarm", () => {
        let testFarmId: string
        let testPrincipalId: string
        let testFertilizerCatalogueId: string

        beforeAll(async () => {
            // Create a new principal for this test suite
            const user = await fdmAuth.api.signUpEmail({
                headers: undefined,
                body: {
                    email: "testuser_removefarm@example.com",
                    name: "testuser_removefarm",
                    username: "testuser_removefarm",
                    password: "password",
                } as any,
            })
            testPrincipalId = user.user.id

            // Create a new farm for testing removal
            testFarmId = await addFarm(
                fdm,
                testPrincipalId,
                "Farm to Remove",
                "999999",
                "Delete Lane",
                "99999",
            )

            // Add a field to the farm
            await addField(
                fdm,
                testPrincipalId,
                testFarmId,
                "Field to Delete",
                "source-field-id",
                {
                    type: "Polygon",
                    coordinates: [
                        [
                            [0, 0],
                            [0, 1],
                            [1, 1],
                            [1, 0],
                            [0, 0],
                        ],
                    ],
                },
                new Date(),
                "unknown",
            )

            // Add a custom fertilizer to the farm's catalogue
            testFertilizerCatalogueId = await addFertilizerToCatalogue(
                fdm,
                testPrincipalId,
                testFarmId,
                {
                    p_name_nl: "Custom Fertilizer",
                    p_source: testFarmId,
                    p_type: "mineral",
                } as any, // Cast to any to simplify properties for test
            )

            // Add an acquired fertilizer to the farm
            await addFertilizer(
                fdm,
                testPrincipalId,
                testFertilizerCatalogueId,
                testFarmId,
                100,
                new Date(),
            )

            // Grant another principal a role on this farm
            await grantRoleToFarm(
                fdm,
                testPrincipalId,
                target_username, // Using an existing target_username from outer scope
                testFarmId,
                "advisor",
            )
        })

        it("should successfully remove a farm and all its associated data", async () => {
            await removeFarm(fdm, testPrincipalId, testFarmId)

            // Verify farm is deleted
            await expect(
                getFarm(fdm, testPrincipalId, testFarmId),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action", // Permission denied because farm is deleted
            )

            // Verify fields are deleted (expect permission denied as farm is gone)
            await expect(
                getFields(fdm, testPrincipalId, testFarmId),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )

            // Verify fertilizer acquiring records are deleted
            const fertilizerAcquiringRecords = await fdm
                .select()
                .from(schema.fertilizerAcquiring)
                .where(eq(schema.fertilizerAcquiring.b_id_farm, testFarmId))
            expect(fertilizerAcquiringRecords).toEqual([])

            // Verify custom fertilizer from catalogue is deleted
            const customFertilizerCatalogue = await fdm
                .select()
                .from(schema.fertilizersCatalogue)
                .where(
                    eq(
                        schema.fertilizersCatalogue.p_id_catalogue,
                        testFertilizerCatalogueId,
                    ),
                )
            expect(customFertilizerCatalogue).toEqual([])

            // Verify principals are revoked
            const principals = await listPrincipalsForResource(
                fdm,
                "farm",
                testFarmId,
            )
            expect(principals).toEqual([])

            // Verify farm invitations are deleted
            const farmInvitations = await fdm
                .select()
                .from(authZSchema.invitation)
                .where(eq(authZSchema.invitation.resource_id, testFarmId))
            expect(farmInvitations).toEqual([])
        })

        it("should throw an error if the principal does not have write access", async () => {
            const other_principal_id = createId()
            const newFarmId = await addFarm(
                fdm,
                principal_id, // Farm owned by principal_id
                "Another Farm",
                "111111",
                "Other Lane",
                "11111",
            )
            await expect(
                removeFarm(fdm, other_principal_id, newFarmId),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })

        it("should handle errors during farm removal", async () => {
            const newFarmId = await addFarm(
                fdm,
                principal_id,
                "Farm for Error Test",
                "222222",
                "Error Lane",
                "22222",
            )
            // Mock the delete function to throw an error
            const mockDelete = async () => {
                throw new Error("Database delete failed")
            }
            const fdmMock = {
                ...fdm,
                delete: mockDelete,
            } as unknown as FdmType // Cast to FdmType to satisfy type checking

            await expect(
                removeFarm(fdmMock, principal_id, newFarmId),
            ).rejects.toThrowError("Exception for removeFarm")
        })

        it("should throw an error if the farm does not exist", async () => {
            const nonExistentFarmId = createId()
            await expect(
                removeFarm(fdm, principal_id, nonExistentFarmId),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })
    })

    describe("acceptInvitation", () => {
        let invitationFarmId: string
        let invitationId: string

        beforeAll(async () => {
            // Create a fresh farm for invitation tests
            invitationFarmId = await addFarm(
                fdm,
                principal_id,
                "Invitation Test Farm",
                "INV001",
                "Invitation Lane",
                "11111",
            )
        })

        it("should accept a pending invitation and grant the role", async () => {
            await grantRoleToFarm(
                fdm,
                principal_id,
                target_username,
                invitationFarmId,
                "researcher",
            )

            const rows = await fdm
                .select()
                .from(authZSchema.invitation)
                .where(eq(authZSchema.invitation.resource_id, invitationFarmId))
            invitationId = rows[0].invitation_id

            await acceptInvitation(fdm, invitationId, target_id)

            const principals = await listPrincipalsForResource(
                fdm,
                "farm",
                invitationFarmId,
            )
            const grantee = principals.find((p) => p.principal_id === target_id)
            expect(grantee).toBeDefined()
            expect(grantee?.role).toBe("researcher")
        })

        it("should throw if invitation is already accepted", async () => {
            await expect(
                acceptInvitation(fdm, invitationId, target_id),
            ).rejects.toThrowError("Exception for acceptInvitation")
        })

        it("should throw if invitation does not exist", async () => {
            await expect(
                acceptInvitation(fdm, createId(), target_id),
            ).rejects.toThrowError("Exception for acceptInvitation")
        })

        it("should throw if the user is not the invitation target", async () => {
            const otherFarmId = await addFarm(
                fdm,
                principal_id,
                "Other Farm",
                "OTH001",
                "Other Lane",
                "22222",
            )
            await grantRoleToFarm(
                fdm,
                principal_id,
                target_username,
                otherFarmId,
                "advisor",
            )
            const rows = await fdm
                .select()
                .from(authZSchema.invitation)
                .where(eq(authZSchema.invitation.resource_id, otherFarmId))
            const otherInvitationId = rows[0].invitation_id

            const wrongUser = await fdmAuth.api.signUpEmail({
                headers: undefined,
                body: {
                    email: "wronguser@example.com",
                    name: "wronguser",
                    username: "wronguser",
                    password: "password",
                } as any,
            })

            await expect(
                acceptInvitation(fdm, otherInvitationId, wrongUser.user.id),
            ).rejects.toThrowError("Exception for acceptInvitation")
        })
    })

    describe("declineInvitation", () => {
        let declineFarmId: string
        let declineInvitationId: string

        beforeAll(async () => {
            declineFarmId = await addFarm(
                fdm,
                principal_id,
                "Decline Test Farm",
                "DEC001",
                "Decline Lane",
                "33333",
            )
            await grantRoleToFarm(
                fdm,
                principal_id,
                target_username,
                declineFarmId,
                "advisor",
            )
            const rows = await fdm
                .select()
                .from(authZSchema.invitation)
                .where(eq(authZSchema.invitation.resource_id, declineFarmId))
            declineInvitationId = rows[0].invitation_id
        })

        it("should decline a pending invitation", async () => {
            await declineInvitation(fdm, declineInvitationId, target_id)

            const rows = await fdm
                .select()
                .from(authZSchema.invitation)
                .where(
                    eq(
                        authZSchema.invitation.invitation_id,
                        declineInvitationId,
                    ),
                )
            expect(rows[0].status).toBe("declined")
        })

        it("should throw if invitation is already declined", async () => {
            await expect(
                declineInvitation(fdm, declineInvitationId, target_id),
            ).rejects.toThrowError("Exception for declineInvitation")
        })

        it("should throw if the user is not the invitation target", async () => {
            const anotherFarmId = await addFarm(
                fdm,
                principal_id,
                "Another Decline Farm",
                "DEC002",
                "Another Decline Lane",
                "44444",
            )
            await grantRoleToFarm(
                fdm,
                principal_id,
                target_username,
                anotherFarmId,
                "advisor",
            )
            const rows = await fdm
                .select()
                .from(authZSchema.invitation)
                .where(eq(authZSchema.invitation.resource_id, anotherFarmId))
            const anotherInvitationId = rows[0].invitation_id

            const otherUser = await fdmAuth.api.signUpEmail({
                headers: undefined,
                body: {
                    email: "otherwronguser@example.com",
                    name: "otherwronguser",
                    username: "otherwronguser",
                    password: "password",
                } as any,
            })

            await expect(
                declineInvitation(fdm, anotherInvitationId, otherUser.user.id),
            ).rejects.toThrowError("Exception for declineInvitation")
        })
    })

    describe("listPendingInvitationsForFarm", () => {
        let listFarmId: string

        beforeAll(async () => {
            listFarmId = await addFarm(
                fdm,
                principal_id,
                "List Invitations Farm",
                "LIST001",
                "List Lane",
                "55555",
            )
            await grantRoleToFarm(
                fdm,
                principal_id,
                target_username,
                listFarmId,
                "advisor",
            )
        })

        it("should return pending invitations for a farm", async () => {
            const invitations = await listPendingInvitationsForFarm(
                fdm,
                principal_id,
                listFarmId,
            )
            expect(invitations.length).toBeGreaterThanOrEqual(1)
            expect(invitations[0].status).toBe("pending")
            expect(invitations[0].resource_id).toBe(listFarmId)
        })

        it("should throw if principal does not have share permission", async () => {
            const otherId = createId()
            await expect(
                listPendingInvitationsForFarm(fdm, otherId, listFarmId),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })
    })

    describe("cancelInvitationForFarm", () => {
        let cancelFarmId: string
        let cancelInvitationId: string

        beforeAll(async () => {
            cancelFarmId = await addFarm(
                fdm,
                principal_id,
                "Cancel Invitation Farm",
                "CAN001",
                "Cancel Lane",
                "77001",
            )
            await grantRoleToFarm(
                fdm,
                principal_id,
                target_username,
                cancelFarmId,
                "advisor",
            )
            const invitations = await listPendingInvitationsForFarm(
                fdm,
                principal_id,
                cancelFarmId,
            )
            cancelInvitationId = invitations[0].invitation_id
        })

        it("should remove the invitation from pending list after cancellation", async () => {
            await cancelInvitationForFarm(fdm, principal_id, cancelInvitationId)

            // After cancellation the invitation should no longer appear in pending list
            const invitations = await listPendingInvitationsForFarm(
                fdm,
                principal_id,
                cancelFarmId,
            )
            const found = invitations.find(
                (i) => i.invitation_id === cancelInvitationId,
            )
            expect(found).toBeUndefined()
        })

        it("should throw if the invitation is already cancelled", async () => {
            await expect(
                cancelInvitationForFarm(fdm, principal_id, cancelInvitationId),
            ).rejects.toThrowError("Exception for cancelInvitationForFarm")
        })

        it("should throw if the invitation does not exist", async () => {
            await expect(
                cancelInvitationForFarm(fdm, principal_id, createId()),
            ).rejects.toThrowError("Exception for cancelInvitationForFarm")
        })

        it("should throw if the principal does not have share permission", async () => {
            const anotherCancelFarmId = await addFarm(
                fdm,
                principal_id,
                "Cancel Invitation Farm 2",
                "CAN002",
                "Cancel Lane 2",
                "77002",
            )
            await grantRoleToFarm(
                fdm,
                principal_id,
                target_username,
                anotherCancelFarmId,
                "advisor",
            )
            const invitations = await listPendingInvitationsForFarm(
                fdm,
                principal_id,
                anotherCancelFarmId,
            )
            const invId = invitations[0].invitation_id

            const otherPrincipalId = createId()
            await expect(
                cancelInvitationForFarm(fdm, otherPrincipalId, invId),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })
    })

    describe("updateRoleOfInvitationForFarm", () => {
        let updateInvFarmId: string
        let updateInvitationId: string

        beforeEach(async () => {
            const randomId = Math.random().toString(36).substring(7)
            updateInvFarmId = await addFarm(
                fdm,
                principal_id,
                `Update Invitation Role Farm ${randomId}`,
                `UPD${randomId}`,
                "Update Lane",
                "88001",
            )
            await grantRoleToFarm(
                fdm,
                principal_id,
                target_username,
                updateInvFarmId,
                "advisor",
            )
            const invitations = await listPendingInvitationsForFarm(
                fdm,
                principal_id,
                updateInvFarmId,
            )
            updateInvitationId = invitations[0].invitation_id
        })

        it("should update the role on a pending invitation", async () => {
            await updateRoleOfInvitationForFarm(
                fdm,
                principal_id,
                updateInvitationId,
                "researcher",
            )

            // Verify via listPrincipalsForFarm: the pending entry should show the new role
            const principals = await listPrincipalsForFarm(
                fdm,
                principal_id,
                updateInvFarmId,
            )
            const pending = principals.find(
                (p) =>
                    p.status === "pending" &&
                    p.invitation_id === updateInvitationId,
            )
            expect(pending).toBeDefined()
            expect(pending?.role).toBe("researcher")
        })

        it("should throw if the invitation does not exist", async () => {
            await expect(
                updateRoleOfInvitationForFarm(
                    fdm,
                    principal_id,
                    createId(),
                    "owner",
                ),
            ).rejects.toThrowError(
                "Exception for updateRoleOfInvitationForFarm",
            )
        })

        it("should throw if the invitation is not pending", async () => {
            // Cancel the invitation first so it is no longer pending
            await cancelInvitationForFarm(fdm, principal_id, updateInvitationId)

            await expect(
                updateRoleOfInvitationForFarm(
                    fdm,
                    principal_id,
                    updateInvitationId,
                    "owner",
                ),
            ).rejects.toThrowError(
                "Exception for updateRoleOfInvitationForFarm",
            )
        })

        it("should throw if the principal does not have share permission", async () => {
            const anotherUpdateFarmId = await addFarm(
                fdm,
                principal_id,
                "Update Invitation Role Farm 2",
                "UPD002",
                "Update Lane 2",
                "88002",
            )
            await grantRoleToFarm(
                fdm,
                principal_id,
                target_username,
                anotherUpdateFarmId,
                "advisor",
            )
            const invitations = await listPendingInvitationsForFarm(
                fdm,
                principal_id,
                anotherUpdateFarmId,
            )
            const invId = invitations[0].invitation_id

            const otherPrincipalId = createId()
            await expect(
                updateRoleOfInvitationForFarm(
                    fdm,
                    otherPrincipalId,
                    invId,
                    "researcher",
                ),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })
    })

    describe("listPendingInvitationsForUser", () => {
        let listUserFarmId: string
        let listUserTarget: { user: { id: string } }
        let listUserTargetId: string

        beforeAll(async () => {
            listUserTarget = await fdmAuth.api.signUpEmail({
                headers: undefined,
                body: {
                    email: "listuser@example.com",
                    name: "listuser",
                    username: "listuser",
                    password: "password",
                } as any,
            })
            listUserTargetId = listUserTarget.user.id

            listUserFarmId = await addFarm(
                fdm,
                principal_id,
                "List User Invitations Farm",
                "LSTU001",
                "List User Lane",
                "66666",
            )
            await grantRoleToFarm(
                fdm,
                principal_id,
                "listuser@example.com",
                listUserFarmId,
                "researcher",
            )
        })

        it("should return pending invitations for a user by email", async () => {
            const invitations = await listPendingInvitationsForUser(
                fdm,
                listUserTargetId,
            )
            expect(invitations.length).toBeGreaterThanOrEqual(1)
            const inv = invitations.find(
                (i) => i.resource_id === listUserFarmId,
            )
            expect(inv).toBeDefined()
            expect(inv?.status).toBe("pending")
        })

        it("should return pending invitations for a user by principal_id", async () => {
            // target_id has pending invitations from other tests
            const invitations = await listPendingInvitationsForUser(
                fdm,
                target_id,
            )
            // Target may have invitations from earlier tests (email-based or principal-based)
            expect(Array.isArray(invitations)).toBe(true)
        })

        it("should return empty array if user does not exist or has no invitations", async () => {
            const nonExistentUserId = createId()
            const invitations = await listPendingInvitationsForUser(
                fdm,
                nonExistentUserId,
            )
            expect(invitations).toEqual([])
        })

        it("should include org_name when invitation targets an organization", async () => {
            const orgAdminUser = await fdmAuth.api.signUpEmail({
                headers: undefined,
                body: {
                    email: "listuser_orgadmin@example.com",
                    name: "listuser_orgadmin",
                    username: "listuser_orgadmin",
                    password: "password",
                } as any,
            })

            const orgId = createId()
            const orgSlug = `pending-inv-org-${orgId.toLowerCase()}`
            await fdm.insert(authNSchema.organization).values({
                id: orgId,
                name: "Pending Invitations Org",
                slug: orgSlug,
                createdAt: new Date(),
            })
            await fdm.insert(authNSchema.member).values({
                id: createId(),
                organizationId: orgId,
                userId: orgAdminUser.user.id,
                role: "owner",
                createdAt: new Date(),
            })

            const orgInvFarmId = await addFarm(
                fdm,
                principal_id,
                "List User Org Inv Farm",
                "LSUORG",
                "List User Org Lane",
                "20002",
            )
            await grantRoleToFarm(
                fdm,
                principal_id,
                orgSlug,
                orgInvFarmId,
                "advisor",
            )

            const invitations = await listPendingInvitationsForUser(
                fdm,
                orgAdminUser.user.id,
            )
            const orgInv = invitations.find(
                (i) => i.resource_id === orgInvFarmId,
            )
            expect(orgInv).toBeDefined()
            expect(orgInv?.org_name).toBe("Pending Invitations Org")
        })
    })
})
