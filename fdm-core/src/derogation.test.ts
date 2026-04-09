import { beforeAll, describe, expect, inject, it } from "vitest"
import {
    addDerogation,
    isDerogationGrantedForYear,
    listDerogations,
    removeDerogation,
} from "./derogation"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.types"
import { createId } from "./id"

describe("Derogation Functions", () => {
    let fdm: FdmServerType
    let principal_id: string
    let b_id_farm: string

    beforeAll(async () => {
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        fdm = createFdmServer(host, port, user, password, database)
        principal_id = createId()

        b_id_farm = await addFarm(
            fdm,
            principal_id,
            "Test Farm",
            "123456",
            "123 Farm Lane",
            "12345",
        )
    })

    describe("addDerogation", () => {
        it("should add a new derogation for a farm with a valid year (2006)", async () => {
            const year = 2006
            const b_id_derogation = await addDerogation(
                fdm,
                principal_id,
                b_id_farm,
                year,
            )
            expect(b_id_derogation).toBeDefined()
        })

        it("should add a new derogation for a farm with a valid year (2025)", async () => {
            const year = 2025
            const b_id_derogation = await addDerogation(
                fdm,
                principal_id,
                b_id_farm,
                year,
            )
            expect(b_id_derogation).toBeDefined()
        })

        it("should throw an error if the derogation year is before 2006", async () => {
            const year = 2005
            await expect(
                addDerogation(fdm, principal_id, b_id_farm, year),
            ).rejects.toThrowError(
                "Derogation year must be between 2006 and 2025.",
            )
        })

        it("should throw an error if the derogation year is after 2025", async () => {
            const year = 2026
            await expect(
                addDerogation(fdm, principal_id, b_id_farm, year),
            ).rejects.toThrowError(
                "Derogation year must be between 2006 and 2025.",
            )
        })

        it("should throw an error if the principal does not have write access", async () => {
            const other_principal_id = createId()
            const year = 2024
            await expect(
                addDerogation(fdm, other_principal_id, b_id_farm, year),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })

        it("should throw an error if derogation is already granted for that year", async () => {
            const year = 2021
            await addDerogation(fdm, principal_id, b_id_farm, year)
            await expect(
                addDerogation(fdm, principal_id, b_id_farm, year),
            ).rejects.toThrowError("Exception for addDerogation")
        })
    })

    describe("listDerogations", () => {
        it("should list all derogations for a farm", async () => {
            const year = 2024
            await addDerogation(fdm, principal_id, b_id_farm, year)
            const derogations = await listDerogations(
                fdm,
                principal_id,
                b_id_farm,
            )
            expect(derogations.length).toBeGreaterThanOrEqual(1)
        })

        it("should throw an error if the principal does not have read access", async () => {
            const other_principal_id = createId()
            await expect(
                listDerogations(fdm, other_principal_id, b_id_farm),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })
    })

    describe("isDerogationGrantedForYear", () => {
        it("should return true if a derogation is granted for the specified year", async () => {
            const year = 2017
            await addDerogation(fdm, principal_id, b_id_farm, year)
            const isGranted = await isDerogationGrantedForYear(
                fdm,
                principal_id,
                b_id_farm,
                year,
            )
            expect(isGranted).toBe(true)
        })

        it("should return false if a derogation is not granted for the specified year", async () => {
            const year = 2023
            const isGranted = await isDerogationGrantedForYear(
                fdm,
                principal_id,
                b_id_farm,
                year,
            )
            expect(isGranted).toBe(false)
        })

        it("should throw an error if the principal does not have read access", async () => {
            const other_principal_id = createId()
            const year = 2024
            await expect(
                isDerogationGrantedForYear(
                    fdm,
                    other_principal_id,
                    b_id_farm,
                    year,
                ),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })
    })

    describe("removeDerogation", () => {
        it("should remove a derogation from a farm", async () => {
            const year = 2018
            const b_id_derogation = await addDerogation(
                fdm,
                principal_id,
                b_id_farm,
                year,
            )
            await removeDerogation(fdm, principal_id, b_id_derogation)
            const isGranted = await isDerogationGrantedForYear(
                fdm,
                principal_id,
                b_id_farm,
                year,
            )
            expect(isGranted).toBe(false)
        })

        it("should throw an error if the principal does not have write access", async () => {
            const year = 2012
            const b_id_derogation = await addDerogation(
                fdm,
                principal_id,
                b_id_farm,
                year,
            )
            const other_principal_id = createId()
            await expect(
                removeDerogation(fdm, other_principal_id, b_id_derogation),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })

        it("should throw an error if the derogation does not exist", async () => {
            const non_existent_derogation_id = createId()
            await expect(
                removeDerogation(fdm, principal_id, non_existent_derogation_id),
            ).rejects.toThrowError("Exception for removeDerogation")
        })
    })
})
