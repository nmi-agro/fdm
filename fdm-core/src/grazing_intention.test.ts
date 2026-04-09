import { beforeEach, describe, expect, inject, it } from "vitest"
import { addFarm } from "./farm"
import type { FdmType } from "./fdm.types"
import { createFdmServer } from "./fdm-server"
import {
    getGrazingIntention,
    getGrazingIntentions,
    removeGrazingIntention,
    setGrazingIntention,
} from "./grazing_intention"

describe("Grazing Intention", () => {
    let fdm: FdmType
    let principal_id: string
    let b_id_farm: string

    beforeEach(async () => {
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        fdm = createFdmServer(host, port, user, password, database)
        principal_id = "test_principal"

        // Create a test farm
        b_id_farm = await addFarm(
            fdm,
            principal_id,
            "Test Farm for Grazing",
            "654321",
            "321 Farm Road",
            "54321",
        )
    })

    describe("setGrazingIntention", () => {
        it("should add a new grazing intention", async () => {
            const b_grazing_intention_year = 2025
            const intention = true

            await setGrazingIntention(
                fdm,
                principal_id,
                b_id_farm,
                b_grazing_intention_year,
                intention,
            )

            const result = await getGrazingIntention(
                fdm,
                principal_id,
                b_id_farm,
                b_grazing_intention_year,
            )
            expect(result).toBe(intention)
        })

        it("should update an existing grazing intention", async () => {
            const b_grazing_intention_year = 2026
            await setGrazingIntention(
                fdm,
                principal_id,
                b_id_farm,
                b_grazing_intention_year,
                true,
            )
            await setGrazingIntention(
                fdm,
                principal_id,
                b_id_farm,
                b_grazing_intention_year,
                false,
            )

            const result = await getGrazingIntention(
                fdm,
                principal_id,
                b_id_farm,
                b_grazing_intention_year,
            )
            expect(result).toBe(false)
        })

        it("should throw an error if principal does not have permission", async () => {
            const invalidPrincipal = "invalid_user"
            await expect(
                setGrazingIntention(
                    fdm,
                    invalidPrincipal,
                    b_id_farm,
                    2027,
                    true,
                ),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })
    })

    describe("getGrazingIntention", () => {
        it("should return the correct intention for a given b_grazing_intention_year", async () => {
            const b_grazing_intention_year = 2028
            await setGrazingIntention(
                fdm,
                principal_id,
                b_id_farm,
                b_grazing_intention_year,
                true,
            )

            const result = await getGrazingIntention(
                fdm,
                principal_id,
                b_id_farm,
                b_grazing_intention_year,
            )
            expect(result).toBe(true)
        })

        it("should return false if no intention is set for the b_grazing_intention_year", async () => {
            const b_grazing_intention_year = 2029
            const result = await getGrazingIntention(
                fdm,
                principal_id,
                b_id_farm,
                b_grazing_intention_year,
            )
            expect(result).toBe(false)
        })

        it("should throw an error if principal does not have permission", async () => {
            const invalidPrincipal = "invalid_user"
            await expect(
                getGrazingIntention(fdm, invalidPrincipal, b_id_farm, 2030),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })
    })

    describe("getGrazingIntentions", () => {
        it("should return all grazing intentions for a farm", async () => {
            await setGrazingIntention(fdm, principal_id, b_id_farm, 2031, true)
            await setGrazingIntention(fdm, principal_id, b_id_farm, 2032, false)

            const intentions = await getGrazingIntentions(
                fdm,
                principal_id,
                b_id_farm,
            )
            expect(intentions.length).toBe(2)
            expect(intentions.map((i) => i.b_grazing_intention_year)).toEqual(
                expect.arrayContaining([2031, 2032]),
            )
        })

        it("should return an empty array if no intentions are set", async () => {
            const new_b_id_farm = await addFarm(
                fdm,
                principal_id,
                "Farm Without Intentions",
                undefined,
                undefined,
                undefined,
            )
            const intentions = await getGrazingIntentions(
                fdm,
                principal_id,
                new_b_id_farm,
            )
            expect(intentions.length).toBe(0)
        })

        it("should throw an error if principal does not have permission", async () => {
            const invalidPrincipal = "invalid_user"
            await expect(
                getGrazingIntentions(fdm, invalidPrincipal, b_id_farm),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })
    })

    describe("removeGrazingIntention", () => {
        it("should remove an existing grazing intention", async () => {
            const b_grazing_intention_year = 2033
            await setGrazingIntention(
                fdm,
                principal_id,
                b_id_farm,
                b_grazing_intention_year,
                true,
            )

            let result = await getGrazingIntention(
                fdm,
                principal_id,
                b_id_farm,
                b_grazing_intention_year,
            )
            expect(result).toBe(true)

            await removeGrazingIntention(
                fdm,
                principal_id,
                b_id_farm,
                b_grazing_intention_year,
            )

            result = await getGrazingIntention(
                fdm,
                principal_id,
                b_id_farm,
                b_grazing_intention_year,
            )
            expect(result).toBe(false)
        })

        it("should not throw an error when removing a non-existent intention", async () => {
            const b_grazing_intention_year = 2034
            await expect(
                removeGrazingIntention(
                    fdm,
                    principal_id,
                    b_id_farm,
                    b_grazing_intention_year,
                ),
            ).resolves.not.toThrow()
        })

        it("should throw an error if principal does not have permission", async () => {
            const b_grazing_intention_year = 2035
            await setGrazingIntention(
                fdm,
                principal_id,
                b_id_farm,
                b_grazing_intention_year,
                true,
            )
            const invalidPrincipal = "invalid_user"

            await expect(
                removeGrazingIntention(
                    fdm,
                    invalidPrincipal,
                    b_id_farm,
                    b_grazing_intention_year,
                ),
            ).rejects.toThrowError(
                "Principal does not have permission to perform this action",
            )
        })
    })
})
