import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, inject, it } from "vitest"
import { type BetterAuth, createFdmAuth } from "./authentication"
import * as authNSchema from "./db/schema-authn"
import type { FdmType } from "./fdm"
import { createFdmServer } from "./fdm-server"
import { createId } from "./id"
import { getPrincipal, identifyPrincipal, lookupPrincipal } from "./principal"

describe("Principals", () => {
    let fdm: FdmType
    let user_id: string
    let organization_id: string
    let userName: string
    let organizationName: string
    let organizationSlug: string
    let userEmail: string
    let fdmAuth: BetterAuth

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
        userName = "testuser"
        userEmail = "user5@example.com"

        user_id = (
            await fdmAuth.api.signUpEmail({
                headers: undefined,
                body: {
                    email: userEmail,
                    name: "Test User",
                    firstname: "Test",
                    surname: "User",
                    username: userName,
                    password: "password",
                } as any,
            })
        ).user.id

        organizationSlug = "test-org"
        organizationName = "Test Organization"
        organization_id = createId()

        await fdm.insert(authNSchema.organization).values({
            id: organization_id,
            name: organizationName,
            slug: organizationSlug,
            createdAt: new Date(),
            metadata: JSON.stringify({
                description: "Test organization",
                isVerified: false,
            }),
        })

        await fdm.insert(authNSchema.member).values({
            id: createId(),
            organizationId: organization_id,
            userId: user_id,
            role: "owner",
            createdAt: new Date(),
        })
    })

    describe("getPrincipal", () => {
        it("should retrieve user details when principal_id is a user ID", async () => {
            const principal = await getPrincipal(fdm, user_id)
            expect(principal).toBeDefined()
            expect(principal?.username).toBe(userName)
            expect(principal?.type).toBe("user")
            expect(principal?.image).toBeNull()
            expect(principal?.isVerified).toBe(false)
        })

        it("should retrieve organization details when principal_id is an organization ID", async () => {
            const principal = await getPrincipal(fdm, organization_id)
            expect(principal).toBeDefined()
            expect(principal?.username).toBe(organizationSlug)
            expect(principal?.type).toBe("organization")
            expect(principal?.image).toBeNull()
            expect(principal?.isVerified).toBe(false)
        })

        it("should return undefinedif principal_id does not exist in either user or organization table", async () => {
            const nonExistentId = createId()
            const principal = await getPrincipal(fdm, nonExistentId)
            expect(principal).toBeUndefined()
        })

        it("should handle database errors and throw an error", async () => {
            // Mock the transaction function to throw an error
            const mockFdm = {
                ...fdm,
                transaction: async () => {
                    throw new Error("Database transaction failed")
                },
            } as unknown as FdmType

            // Act & Assert
            await expect(getPrincipal(mockFdm, user_id)).rejects.toThrowError(
                "Exception for getPrincipal",
            )
        })

        it("should retrieve user details even when image is null", async () => {
            // Update user to have null image
            await fdm
                .update(authNSchema.user)
                .set({ image: null })
                .where(eq(authNSchema.user.id, user_id))

            const principal = await getPrincipal(fdm, user_id)

            expect(principal).toBeDefined()
            expect(principal?.username).toBe(userName)
            expect(principal?.type).toBe("user")
            expect(principal?.image).toBeNull()
            expect(principal?.isVerified).toBe(false)
        })

        it("should retrieve organization details even when logo is null", async () => {
            // Update organization to have null logo
            await fdm
                .update(authNSchema.organization)
                .set({ logo: null })
                .where(eq(authNSchema.organization.id, organization_id))

            const principal = await getPrincipal(fdm, organization_id)

            expect(principal).toBeDefined()
            expect(principal?.username).toBe(organizationSlug)
            expect(principal?.type).toBe("organization")
            expect(principal?.image).toBeNull()
            expect(principal?.isVerified).toBe(false)
        })

        it("should handle organization with missing metadata", async () => {
            //Update organization without metadata
            await fdm
                .update(authNSchema.organization)
                .set({ metadata: null })
                .where(eq(authNSchema.organization.id, organization_id))
            const principal = await getPrincipal(fdm, organization_id)
            expect(principal).toBeDefined()
            expect(principal?.username).toBe(organizationSlug)
            expect(principal?.type).toBe("organization")
            expect(principal?.image).toBeNull()
            expect(principal?.isVerified).toBe(false)
        })
    })

    describe("identifyPrincipal", () => {
        it("should identify a principal by username", async () => {
            const principalDetails = await identifyPrincipal(fdm, userName)
            expect(principalDetails).toBeDefined()
            expect(principalDetails?.id).toEqual(user_id)
            expect(principalDetails?.username).toBe(userName)
            expect(principalDetails?.type).toBe("user")
        })

        it("should identify a principal by email", async () => {
            const principalDetails = await identifyPrincipal(fdm, userEmail)
            expect(principalDetails).toBeDefined()
            expect(principalDetails?.id).toEqual(user_id)
            expect(principalDetails?.username).toBe(userName)
            expect(principalDetails?.type).toBe("user")
        })

        it("should identify a principal by organization slug", async () => {
            const principalDetails = await identifyPrincipal(
                fdm,
                organizationSlug,
            )
            expect(principalDetails).toBeDefined()
            expect(principalDetails?.id).toEqual(organization_id)
            expect(principalDetails?.username).toBe(organizationSlug)
            expect(principalDetails?.type).toBe("organization")
        })

        it("should return undefined if no principal is found", async () => {
            const nonExistentIdentifier = "nonexistent"
            const principalDetails = await identifyPrincipal(
                fdm,
                nonExistentIdentifier,
            )
            expect(principalDetails).toBeUndefined()
        })

        it("should handle database errors and throw an error", async () => {
            // Mock the transaction function to throw an error
            const mockFdm = {
                ...fdm,
                transaction: async () => {
                    throw new Error("Database transaction failed")
                },
            } as unknown as FdmType

            // Act & Assert
            await expect(
                identifyPrincipal(mockFdm, userName),
            ).rejects.toThrowError("Exception for identifyPrincipal")
        })

        it("should prioritize username over organization slug if both exist", async () => {
            //Create an organization with the same slug as a username. This should never happen
            //in real world scenario, however, this unit test should demonstrate expected behaviour
            const conflictingSlug = userName
            const conflictingOrganization_id = createId()

            await fdm.insert(authNSchema.organization).values({
                id: conflictingOrganization_id,
                name: "Conflicting Organization",
                slug: conflictingSlug,
                createdAt: new Date(),
                metadata: JSON.stringify({
                    description: "Test description",
                    isVerified: false,
                }),
            })

            const principalDetails = await identifyPrincipal(
                fdm,
                conflictingSlug,
            )

            //The user should be prioritized.
            expect(principalDetails).toBeDefined()
            expect(principalDetails?.id).toEqual(user_id)
            expect(principalDetails?.username).toBe(userName)
            expect(principalDetails?.type).toBe("user")

            //Clean up conflicting organization
            await fdm
                .delete(authNSchema.organization)
                .where(
                    eq(authNSchema.organization.id, conflictingOrganization_id),
                )
                .execute()
        })
    })

    describe("lookupPrincipal", () => {
        it("should find a user by email", async () => {
            const identifier = userEmail
            const results = await lookupPrincipal(fdm, identifier)

            expect(results).toBeDefined()
            expect(results.length).toBe(1)
            expect(results[0].username).toBe(userName)
            expect(results[0].type).toBe("user")
        })

        it("should return an empty array when no principal matches identifier", async () => {
            const identifier = "nonexistent"
            const results = await lookupPrincipal(fdm, identifier)
            expect(results).toBeDefined()
            expect(results.length).toBe(0)
        })

        it("should find organizations by partial name", async () => {
            const identifier = "Organ"
            const results = await lookupPrincipal(fdm, identifier)
            expect(results).toBeDefined()
            expect(
                results.filter((x) =>
                    x.displayUserName?.match(new RegExp(identifier, "i")),
                ).length,
            ).toBeGreaterThanOrEqual(1)
            expect(results.some((r) => r.type === "organization")).toBe(true)
        })

        it("should find organizations by partial slug", async () => {
            const identifier = "test-org"
            const results = await lookupPrincipal(fdm, identifier)

            expect(results).toBeDefined()
            expect(results.length).toBeGreaterThanOrEqual(1)
            expect(
                results.filter((x) =>
                    x.username?.match(new RegExp(identifier, "i")),
                ).length,
            ).toBeGreaterThanOrEqual(1)
            expect(results.some((r) => r.type === "organization")).toBe(true)
        })

        it("should find users by partial name", async () => {
            const identifier = "Test"
            const results = await lookupPrincipal(fdm, identifier)

            expect(results).toBeDefined()
            expect(results.length).toBeGreaterThanOrEqual(1) // Could be more than user matching that pattern in the test db
            expect(
                results.filter((x) =>
                    x.displayUserName?.match(new RegExp(identifier, "i")),
                ).length,
            ).toBeGreaterThanOrEqual(1)
            expect(results.some((r) => r.type === "user")).toBe(true)
        })

        it("should find users by partial username", async () => {
            const identifier = "testuser"
            const results = await lookupPrincipal(fdm, identifier)

            expect(results).toBeDefined()
            expect(results.length).toBeGreaterThanOrEqual(1) // Could be more than one user matching that pattern in the test db
            expect(
                results.filter((x) =>
                    x.username?.match(new RegExp(identifier, "i")),
                ).length,
            ).toBeGreaterThanOrEqual(1)
            expect(results.some((r) => r.type === "user")).toBe(true)
        })

        it("should find users by firstname", async () => {
            const identifier = "Test"
            const results = await lookupPrincipal(fdm, identifier)

            expect(results).toBeDefined()
            expect(results.length).toBeGreaterThanOrEqual(1) // Could be more than one user matching that pattern in the test db
            expect(
                results.filter((x) =>
                    x.displayUserName?.match(new RegExp(identifier, "i")),
                ).length,
            ).toBeGreaterThanOrEqual(1)
            expect(results.some((r) => r.type === "user")).toBe(true)
        })

        it("should find users by surname", async () => {
            const identifier = "User"
            const results = await lookupPrincipal(fdm, identifier)
            expect(results).toBeDefined()
            expect(
                results.filter((x) =>
                    x.displayUserName?.match(new RegExp(identifier, "i")),
                ).length,
            ).toBeGreaterThanOrEqual(1)
            expect(results.some((r) => r.type === "user")).toBe(true)
        })

        it("should handle database errors and throw an error", async () => {
            const mockFdm = {
                ...fdm,
                transaction: async () => {
                    throw new Error("Database transaction failed")
                },
            } as unknown as FdmType // Type assertion to FdmType

            await expect(lookupPrincipal(mockFdm, "test")).rejects.toThrowError(
                "Exception for LookupPrincipal",
            )
        })

        it("should prioritize email match of user over slug match of organization", async () => {
            // Create an organization with slug same as one of the user email
            const conflicting_organization_id = createId()

            await fdm.insert(authNSchema.organization).values({
                id: conflicting_organization_id,
                name: "Conflicting Organization",
                slug: userEmail,
                createdAt: new Date(),
                metadata: JSON.stringify({
                    description: "Test description",
                    isVerified: false,
                }),
            })

            const identifier = userEmail
            const results = await lookupPrincipal(fdm, identifier)

            expect(results).toBeDefined()
            expect(results.length).toBe(1)
            expect(results[0].username).toBe(userName) // Should prioritize the user.

            // Clean up conflicting organization
            await fdm
                .delete(authNSchema.organization)
                .where(
                    eq(
                        authNSchema.organization.id,
                        conflicting_organization_id,
                    ),
                )
                .execute()
        })

        it("should handle empty identifier", async () => {
            const identifier = ""
            const results = await lookupPrincipal(fdm, identifier)
            expect(results).toBeDefined()
            expect(results.length).toBe(0)
        })
    })
})
