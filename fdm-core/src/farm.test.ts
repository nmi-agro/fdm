import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, inject, it } from "vitest"
import type { FdmAuth } from "./authentication"
import { createFdmAuth } from "./authentication"
import { listPrincipalsForResource } from "./authorization"
import * as schema from "./db/schema"
import {
    addFarm,
    getFarm,
    getFarms,
    grantRoleToFarm,
    isAllowedToDeleteFarm,
    isAllowedToShareFarm,
    listPrincipalsForFarm,
    removeFarm,
    revokePrincipalFromFarm,
    updateFarm,
    updateRoleOfPrincipalAtFarm,
} from "./farm"
import type { FdmType } from "./fdm"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.d"
import { addFertilizer, addFertilizerToCatalogue } from "./fertilizer"
import { addField, getFields } from "./field"
import { createId } from "./id"
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
        it("should grant a role to a principal for a given farm", async () => {
            await grantRoleToFarm(
                fdm,
                principal_id,
                target_username,
                b_id_farm,
                "advisor",
            )

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
})
