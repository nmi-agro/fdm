import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, inject, it } from "vitest"
import * as schema from "./db/schema"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.types"
import { createId } from "./id"
import {
    addOrganicCertification,
    getOrganicCertification,
    isOrganicCertificationValid,
    listOrganicCertifications,
    removeOrganicCertification,
} from "./organic"

describe("Organic Certifications", () => {
    let fdm: FdmServerType
    let farmId: string
    let principalId: string

    beforeEach(async () => {
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        fdm = createFdmServer(host, port, user, password, database)

        // Create test field and analyses before each test
        const farmName = "Test Farm"
        const farmBusinessId = "123456"
        const farmAddress = "123 Farm Lane"
        const farmPostalCode = "12345"
        principalId = createId()
        farmId = await addFarm(
            fdm,
            principalId,
            farmName,
            farmBusinessId,
            farmAddress,
            farmPostalCode,
        )
    })

    it("should add a new organic certification", async () => {
        const traces = "NL-BIO-01.528-0002967.2025.001"
        const skal = "026281"
        const issued = new Date("2024-01-01T00:00:00Z")
        const expires = new Date("2025-12-31T23:59:59Z")

        const certificationId = await addOrganicCertification(
            fdm,
            principalId,
            farmId,
            traces,
            skal,
            issued,
            expires,
        )

        expect(certificationId).toBeDefined()

        const certifications = await fdm
            .select()
            .from(schema.organicCertifications)
            .where(
                eq(schema.organicCertifications.b_id_organic, certificationId),
            )

        expect(certifications.length).toBe(1)
        expect(certifications[0].b_organic_traces).toBe(traces)
        expect(certifications[0].b_organic_skal).toBe(skal)
        expect(certifications[0].b_organic_issued?.toISOString()).toBe(
            issued.toISOString(),
        )
        expect(certifications[0].b_organic_expires?.toISOString()).toBe(
            expires.toISOString(),
        )

        const fetchedCertification = await getOrganicCertification(
            fdm,
            principalId,
            certificationId,
        )
        expect(fetchedCertification).toBeDefined()
        expect(fetchedCertification?.b_id_organic).toBe(certificationId)
        expect(fetchedCertification?.b_organic_traces).toBe(traces)
    })

    it("should throw an error for invalid TRACES format", async () => {
        const traces = "INVALID-TRACES"
        const skal = "026281"
        const issued = new Date("2024-01-01T00:00:00Z")
        const expires = new Date("2025-12-31T23:59:59Z")

        await expect(
            addOrganicCertification(
                fdm,
                principalId,
                farmId,
                traces,
                skal,
                issued,
                expires,
            ),
        ).rejects.toThrow("Invalid TRACES document number format.")
    })

    it("should throw an error for invalid SKAL format", async () => {
        const traces = "NL-BIO-01.528-0002967.2025.001"
        const skal = "INVALID"
        const issued = new Date("2024-01-01T00:00:00Z")
        const expires = new Date("2025-12-31T23:59:59Z")

        await expect(
            addOrganicCertification(
                fdm,
                principalId,
                farmId,
                traces,
                skal,
                issued,
                expires,
            ),
        ).rejects.toThrow("Invalid SKAL number format.")
    })

    it("should throw an error if issue date is after expiry date", async () => {
        const traces = "NL-BIO-01.528-0002967.2025.001"
        const skal = "026281"
        const issued = new Date("2025-01-01T00:00:00Z")
        const expires = new Date("2024-12-31T23:59:59Z")

        await expect(
            addOrganicCertification(
                fdm,
                principalId,
                farmId,
                traces,
                skal,
                issued,
                expires,
            ),
        ).rejects.toThrow("Issue date must be before expiry date.")
    })

    it("should list organic certifications for a farm", async () => {
        const traces1 = "NL-BIO-01.528-0002967.2025.001"
        const skal1 = "026281"
        const issued1 = new Date("2024-01-01T00:00:00Z")
        const expires1 = new Date("2025-12-31T23:59:59Z")
        await addOrganicCertification(
            fdm,
            principalId,
            farmId,
            traces1,
            skal1,
            issued1,
            expires1,
        )

        const traces2 = "NL-BIO-01.528-0005471.2025.001"
        const skal2 = "024295"
        const issued2 = new Date("2023-06-01T00:00:00Z")
        const expires2 = new Date("2026-05-31T23:59:59Z")
        await addOrganicCertification(
            fdm,
            principalId,
            farmId,
            traces2,
            skal2,
            issued2,
            expires2,
        )

        const certifications = await listOrganicCertifications(
            fdm,
            principalId,
            farmId,
        )

        expect(certifications.length).toBe(2)
        expect(certifications[0].b_organic_traces).toBe(traces1)
        expect(certifications[1].b_organic_traces).toBe(traces2)
    })

    it("should remove an organic certification", async () => {
        const traces = "NL-BIO-01.528-0002967.2025.001"
        const skal = "026281"
        const issued = new Date("2024-01-01T00:00:00Z")
        const expires = new Date("2025-12-31T23:59:59Z")

        const certificationId = await addOrganicCertification(
            fdm,
            principalId,
            farmId,
            traces,
            skal,
            issued,
            expires,
        )

        await removeOrganicCertification(fdm, principalId, certificationId)

        const certifications = await fdm
            .select()
            .from(schema.organicCertifications)
            .where(
                eq(schema.organicCertifications.b_id_organic, certificationId),
            )

        expect(certifications.length).toBe(0)
    })

    it("should check if an organic certification is valid for a given date", async () => {
        const traces = "NL-BIO-01.528-0002967.2025.001"
        const skal = "026281"
        const issued = new Date("2024-01-01T00:00:00Z")
        const expires = new Date("2025-12-31T23:59:59Z")

        await addOrganicCertification(
            fdm,
            principalId,
            farmId,
            traces,
            skal,
            issued,
            expires,
        )

        const validDate = new Date("2025-06-15T12:00:00Z")
        const isValid = await isOrganicCertificationValid(
            fdm,
            principalId,
            farmId,
            validDate,
        )
        expect(isValid).toBe(true)

        const expiredDate = new Date("2026-01-01T00:00:00Z")
        const isExpired = await isOrganicCertificationValid(
            fdm,
            principalId,
            farmId,
            expiredDate,
        )
        expect(isExpired).toBe(false)

        const futureDate = new Date("2023-12-31T23:59:59Z")
        const isFuture = await isOrganicCertificationValid(
            fdm,
            principalId,
            farmId,
            futureDate,
        )
        expect(isFuture).toBe(false)
    })
})
