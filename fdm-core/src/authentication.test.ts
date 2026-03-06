import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmAuth } from "./authentication"
import {
    createDisplayUsername,
    createFdmAuth,
    splitFullName,
    updateUserProfile,
} from "./authentication"
import * as authNSchema from "./db/schema-authn"
import type { FdmType } from "./fdm"
import { createFdmServer } from "./fdm-server"
import { createId } from "./id"

describe("createFdmAuth", () => {
    let fdm: FdmType
    let fdmAuth: FdmAuth
    let googleAuth: { clientSecret: string; clientId: string }
    let microsoftAuth: { clientSecret: string; clientId: string }

    beforeEach(() => {
        // Mock environment variables
        googleAuth = {
            clientId: "mock_google_client_id",
            clientSecret: "mock_google_client_secret",
        }
        microsoftAuth = {
            clientId: "mock_ms_client_id",
            clientSecret: "mock_ms_client_secret",
        }

        // Create a mock FdmServer instance
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        fdm = createFdmServer(host, port, user, password, database)
    })

    it("should create an auth instance with the correct database adapter", () => {
        // Create the auth server using the mock FdmServer instance
        fdmAuth = createFdmAuth(fdm, googleAuth, microsoftAuth)
        expect(fdmAuth).toBeDefined()

        // Verify auth providers are correctly configured
        expect(fdmAuth.options.socialProviders?.google).toBeDefined()
        expect(fdmAuth.options.socialProviders?.microsoft).toBeDefined()

        // Verify database adapter is properly connected
        expect(fdmAuth.options.database).toBeDefined()
    })
})

describe("updateUserProfile", () => {
    let fdm: FdmType
    let userId: string

    beforeAll(async () => {
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        fdm = createFdmServer(host, port, user, password, database)

        // Create a test user
        const email = "testuser@example.com"
        const name = "Test User"
        const insertResult = await fdm
            .insert(authNSchema.user)
            .values({
                id: createId(),
                email,
                name,
                emailVerified: false,
                lang: "nl-NL",
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .returning({ id: authNSchema.user.id })

        userId = insertResult[0].id
    })

    it("should update user profile information", async () => {
        const newFirstName = "John"
        const newSurname = "Doe"
        const newLang = "nl-NL" as const

        await updateUserProfile(fdm, userId, newFirstName, newSurname, newLang)

        const updatedUser = await fdm
            .select()
            .from(authNSchema.user)
            .where(eq(authNSchema.user.id, userId))
            .limit(1)
        expect(updatedUser[0].firstname).toBe(newFirstName)
        expect(updatedUser[0].surname).toBe(newSurname)
        expect(updatedUser[0].lang).toBe(newLang)
        expect(updatedUser[0].displayUsername).toBe("John Doe")
    })

    it("should handle partial updates to user profile", async () => {
        const newFirstName = "Jane"
        await updateUserProfile(fdm, userId, newFirstName)

        const updatedUser = await fdm
            .select()
            .from(authNSchema.user)
            .where(eq(authNSchema.user.id, userId))
            .limit(1)
        expect(updatedUser[0].firstname).toBe(newFirstName)
    })

    it("should handle database errors during profile update", async () => {
        // Mock the transaction function to throw an error
        const mockFdm = {
            ...fdm,
            transaction: async () => {
                throw new Error("Database update failed")
            },
        } as unknown as FdmType
        await expect(
            updateUserProfile(mockFdm, userId, "NewName"),
        ).rejects.toThrowError("Exception for updateUserProfile")
    })
})

describe("splitFullName", () => {
    let splittedFullName: { firstname: string | null; surname: string | null }

    it("should split a full name with first and last name", () => {
        splittedFullName = splitFullName("John Doe")
        expect(splittedFullName.firstname).toBe("John")
        expect(splittedFullName.surname).toBe("Doe")
    })

    it("should handle a single name", () => {
        splittedFullName = splitFullName("Jane ")
        expect(splittedFullName.firstname).toBe("Jane")
        expect(splittedFullName.surname).toBeNull()
    })

    it("should handle a name with middle name", () => {
        splittedFullName = splitFullName("John Middle Doe")
        expect(splittedFullName.firstname).toBe("John")
        expect(splittedFullName.surname).toBe("Doe")
    })

    it("should handle 'LastName, FirstName' format", () => {
        splittedFullName = splitFullName("Doe, John")
        expect(splittedFullName.firstname).toBe("John")
        expect(splittedFullName.surname).toBe("Doe")
    })

    it("should handle empty name", () => {
        splittedFullName = splitFullName("")
        expect(splittedFullName.firstname).toBeNull()
        expect(splittedFullName.surname).toBeNull()
    })

    it("should handle undefined name", () => {
        splittedFullName = splitFullName(undefined)
        expect(splittedFullName.firstname).toBeNull()
        expect(splittedFullName.surname).toBeNull()
    })

    it("should handle name with extra spaces", () => {
        splittedFullName = splitFullName("  John   Doe  ")
        expect(splittedFullName.firstname).toBe("John")
        expect(splittedFullName.surname).toBe("Doe")
    })

    it("should handle name with comma and extra spaces", () => {
        splittedFullName = splitFullName("  Doe  ,   John  ")
        expect(splittedFullName.firstname).toBe("John")
        expect(splittedFullName.surname).toBe("Doe")
    })
})

describe("createDisplayUsername", () => {
    it("should return full name when both first and last names are provided", () => {
        const firstname = "John"
        const surname = "Doe"
        const displayName = createDisplayUsername(firstname, surname)
        expect(displayName).toBe("John Doe")
    })

    it("should return only first name when only first name is provided", () => {
        const firstname = "John"
        const surname = null
        const displayName = createDisplayUsername(firstname, surname)
        expect(displayName).toBe("John")
    })

    it("should return only last name when only last name is provided", () => {
        const firstname = null
        const surname = "Doe"
        const displayName = createDisplayUsername(firstname, surname)
        expect(displayName).toBe("Doe")
    })

    it("should return null when neither first nor last name is provided", () => {
        const firstname = null
        const surname = null
        const displayName = createDisplayUsername(firstname, surname)
        expect(displayName).toBeNull()
    })
})
