import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest"
import { syncMeasuresCatalogueArray } from "./catalogues"
import * as schema from "./db/schema"
import { addFarm, removeFarm } from "./farm"
import type { FdmType } from "./fdm.types"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.types"
import { addField, removeField } from "./field"
import { createId } from "./id"
import {
    addMeasure,
    getMeasure,
    getMeasures,
    getMeasuresForFarm,
    getMeasuresFromCatalogue,
    removeMeasure,
    updateMeasure,
} from "./measure"

const TEST_CATALOGUE_ITEM = {
    m_id: "bln_BM1",
    m_source: "bln",
    m_name: "Toedienen compost",
    m_description: "Toevoeging van compost verbetert de bodemstructuur.",
    m_summary: "Compost toedienen",
    m_source_url: "https://example.com/BM1",
    m_conflicts: ["bln_BM2"],
}

const TEST_CATALOGUE_ITEM_2 = {
    m_id: "bln_BM2",
    m_source: "bln",
    m_name: "Aanleg groenbemester",
    m_description: null,
    m_summary: "Groenbemester inzaaien",
    m_source_url: null,
    m_conflicts: ["bln_BM1"],
}

describe("Measure Data Model", () => {
    let fdm: FdmServerType
    let b_id_farm: string
    let b_id: string
    let principal_id: string

    beforeEach(async () => {
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

        b_id = await addField(
            fdm,
            principal_id,
            b_id_farm,
            "test field",
            "test source",
            {
                type: "Polygon",
                coordinates: [
                    [
                        [30, 10],
                        [40, 40],
                        [20, 40],
                        [10, 20],
                        [30, 10],
                    ],
                ],
            },
            new Date("2023-01-01"),
            "nl_01",
            new Date("2023-12-31"),
        )

        // Seed catalogue entries required by most tests
        await syncMeasuresCatalogueArray(fdm, [
            TEST_CATALOGUE_ITEM,
            TEST_CATALOGUE_ITEM_2,
        ])
    })

    afterAll(async () => {
        // No cleanup needed — each test runs against a fresh isolated database
    })

    describe("getMeasuresFromCatalogue", () => {
        it("should return seeded catalogue entries", async () => {
            const catalogue = await getMeasuresFromCatalogue(fdm)
            expect(catalogue.length).toBeGreaterThanOrEqual(2)
            const ids = catalogue.map((c) => c.m_id)
            expect(ids).toContain("bln_BM1")
            expect(ids).toContain("bln_BM2")
        })

        it("should return entries ordered by source then name", async () => {
            const catalogue = await getMeasuresFromCatalogue(fdm)
            // Aanleg groenbemester < Toedienen compost alphabetically
            const idx1 = catalogue.findIndex((c) => c.m_id === "bln_BM2")
            const idx2 = catalogue.findIndex((c) => c.m_id === "bln_BM1")
            expect(idx1).toBeLessThan(idx2)
        })
    })

    describe("addMeasure", () => {
        it("should create a measure and return b_id_measure", async () => {
            const b_id_measure = await addMeasure(
                fdm,
                principal_id,
                b_id,
                "bln_BM1",
                new Date("2023-03-01"),
            )
            expect(typeof b_id_measure).toBe("string")
            expect(b_id_measure.length).toBeGreaterThan(0)
        })

        it("should insert rows into measures and measure_adopting", async () => {
            const b_id_measure = await addMeasure(
                fdm,
                principal_id,
                b_id,
                "bln_BM1",
                new Date("2023-03-01"),
                new Date("2023-12-31"),
            )

            const measureRow = await fdm
                .select()
                .from(schema.measures)
                .where(eq(schema.measures.b_id_measure, b_id_measure))
                .limit(1)
            expect(measureRow.length).toBe(1)
            expect(measureRow[0].m_id).toBe("bln_BM1")

            const applyingRow = await fdm
                .select()
                .from(schema.measureAdopting)
                .where(
                    eq(schema.measureAdopting.b_id_measure, b_id_measure),
                )
                .limit(1)
            expect(applyingRow.length).toBe(1)
            expect(applyingRow[0].b_id).toBe(b_id)
            expect(applyingRow[0].m_start).toEqual(new Date("2023-03-01"))
            expect(applyingRow[0].m_end).toEqual(new Date("2023-12-31"))
        })

        it("should set m_end to null when not provided (doorlopend)", async () => {
            const b_id_measure = await addMeasure(
                fdm,
                principal_id,
                b_id,
                "bln_BM1",
                new Date("2023-03-01"),
            )
            const rows = await fdm
                .select({ m_end: schema.measureAdopting.m_end })
                .from(schema.measureAdopting)
                .where(
                    eq(schema.measureAdopting.b_id_measure, b_id_measure),
                )
                .limit(1)
            expect(rows[0].m_end).toBeNull()
        })

        it("should throw for unknown m_id (FK violation)", async () => {
            await expect(
                addMeasure(
                    fdm,
                    principal_id,
                    b_id,
                    "bln_UNKNOWN",
                    new Date("2023-03-01"),
                ),
            ).rejects.toThrow()
        })
    })

    describe("getMeasure", () => {
        it("should return joined measure data", async () => {
            const b_id_measure = await addMeasure(
                fdm,
                principal_id,
                b_id,
                "bln_BM1",
                new Date("2023-03-01"),
                new Date("2023-12-31"),
            )

            const measure = await getMeasure(fdm, principal_id, b_id_measure)

            expect(measure.b_id_measure).toBe(b_id_measure)
            expect(measure.m_id).toBe("bln_BM1")
            expect(measure.b_id).toBe(b_id)
            expect(measure.m_name).toBe("Toedienen compost")
            expect(measure.m_summary).toBe("Compost toedienen")
            expect(measure.m_conflicts).toEqual(["bln_BM2"])
            expect(measure.m_start).toEqual(new Date("2023-03-01"))
            expect(measure.m_end).toEqual(new Date("2023-12-31"))
        })

        it("should throw when b_id_measure does not exist", async () => {
            await expect(
                getMeasure(fdm, principal_id, "nonexistent"),
            ).rejects.toThrow()
        })
    })

    describe("getMeasures", () => {
        it("should return all measures for a field", async () => {
            await addMeasure(
                fdm,
                principal_id,
                b_id,
                "bln_BM1",
                new Date("2023-03-01"),
            )
            await addMeasure(
                fdm,
                principal_id,
                b_id,
                "bln_BM2",
                new Date("2023-05-01"),
            )

            const measures = await getMeasures(fdm, principal_id, b_id)
            expect(measures.length).toBe(2)
        })

        it("should filter by timeframe — exclude measures outside range", async () => {
            // Measure with end date within timeframe
            await addMeasure(
                fdm,
                principal_id,
                b_id,
                "bln_BM1",
                new Date("2023-03-01"),
                new Date("2023-06-30"),
            )
            // Doorlopend measure that starts before timeframe end
            await addMeasure(
                fdm,
                principal_id,
                b_id,
                "bln_BM2",
                new Date("2022-01-01"),
            )

            const measures = await getMeasures(fdm, principal_id, b_id, {
                start: new Date("2023-01-01"),
                end: new Date("2023-12-31"),
            })
            expect(measures.length).toBe(2)
        })

        it("should return empty array when no measures match timeframe", async () => {
            await addMeasure(
                fdm,
                principal_id,
                b_id,
                "bln_BM1",
                new Date("2020-01-01"),
                new Date("2020-12-31"),
            )

            const measures = await getMeasures(fdm, principal_id, b_id, {
                start: new Date("2023-01-01"),
                end: new Date("2023-12-31"),
            })
            expect(measures.length).toBe(0)
        })
    })

    describe("getMeasuresForFarm", () => {
        it("should return a Map keyed by b_id", async () => {
            await addMeasure(
                fdm,
                principal_id,
                b_id,
                "bln_BM1",
                new Date("2023-03-01"),
            )

            const map = await getMeasuresForFarm(
                fdm,
                principal_id,
                b_id_farm,
            )
            expect(map).toBeInstanceOf(Map)
            expect(map.has(b_id)).toBe(true)
            expect(map.get(b_id)?.length).toBe(1)
        })

        it("should return empty Map when farm has no measures", async () => {
            const map = await getMeasuresForFarm(
                fdm,
                principal_id,
                b_id_farm,
            )
            expect(map).toBeInstanceOf(Map)
            expect(map.size).toBe(0)
        })
    })

    describe("updateMeasure", () => {
        it("should update start date", async () => {
            const b_id_measure = await addMeasure(
                fdm,
                principal_id,
                b_id,
                "bln_BM1",
                new Date("2023-03-01"),
            )

            await updateMeasure(
                fdm,
                principal_id,
                b_id_measure,
                new Date("2023-04-01"),
            )

            const measure = await getMeasure(fdm, principal_id, b_id_measure)
            expect(measure.m_start).toEqual(new Date("2023-04-01"))
        })

        it("should clear m_end when passed null (doorlopend)", async () => {
            const b_id_measure = await addMeasure(
                fdm,
                principal_id,
                b_id,
                "bln_BM1",
                new Date("2023-03-01"),
                new Date("2023-12-31"),
            )

            await updateMeasure(
                fdm,
                principal_id,
                b_id_measure,
                undefined,
                null,
            )

            const measure = await getMeasure(fdm, principal_id, b_id_measure)
            expect(measure.m_end).toBeNull()
        })

        it("should throw for unknown b_id_measure", async () => {
            await expect(
                updateMeasure(fdm, principal_id, "nonexistent"),
            ).rejects.toThrow()
        })
    })

    describe("removeMeasure", () => {
        it("should delete both measures and measure_adopting rows", async () => {
            const b_id_measure = await addMeasure(
                fdm,
                principal_id,
                b_id,
                "bln_BM1",
                new Date("2023-03-01"),
            )

            await removeMeasure(fdm, principal_id, b_id_measure)

            const measureRows = await fdm
                .select()
                .from(schema.measures)
                .where(eq(schema.measures.b_id_measure, b_id_measure))
            expect(measureRows.length).toBe(0)

            const applyingRows = await fdm
                .select()
                .from(schema.measureAdopting)
                .where(
                    eq(schema.measureAdopting.b_id_measure, b_id_measure),
                )
            expect(applyingRows.length).toBe(0)
        })

        it("should throw for unknown b_id_measure", async () => {
            await expect(
                removeMeasure(fdm, principal_id, "nonexistent"),
            ).rejects.toThrow()
        })
    })
})

describe("FdmType compatibility", () => {
    it("should accept FdmType (not just FdmServerType) for getMeasure", async () => {
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        const fdm: FdmType = createFdmServer(host, port, user, password, database)
        // Just check that the function signature accepts FdmType
        await expect(
            getMeasure(fdm, "any", "nonexistent"),
        ).rejects.toThrow()
    })
})

describe("Measure cascade deletion", () => {
    let fdm: FdmServerType
    let principal_id: string
    let b_id_farm: string
    let b_id: string

    beforeEach(async () => {
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        fdm = createFdmServer(host, port, user, password, database)
        principal_id = "test_principal"
        b_id_farm = await addFarm(fdm, principal_id, "Test Farm", "123456", "Addr", "1234AB")
        b_id = await addField(
            fdm,
            principal_id,
            b_id_farm,
            "Test Field",
            "acquiring",
            { type: "Polygon", coordinates: [[[30, 10], [40, 40], [20, 40], [10, 20], [30, 10]]] },
            new Date("2023-01-01"),
            "nl_01",
        )
        await syncMeasuresCatalogueArray(fdm, [
            { m_id: "bln_DEL1", m_source: "bln", m_name: "Del Measure", m_description: null, m_summary: null, m_source_url: null, m_conflicts: null },
        ])
        await addMeasure(fdm, principal_id, b_id, "bln_DEL1", new Date("2023-01-01"), null)
    })

    it("should delete measures when the field is removed", async () => {
        await removeField(fdm, principal_id, b_id)

        const applyingAfter = await fdm
            .select()
            .from(schema.measureAdopting)
            .where(eq(schema.measureAdopting.b_id, b_id))
        expect(applyingAfter).toHaveLength(0)

        const measuresAfter = await fdm
            .select()
            .from(schema.measures)
            .innerJoin(
                schema.measureAdopting,
                eq(schema.measures.b_id_measure, schema.measureAdopting.b_id_measure),
            )
            .where(eq(schema.measureAdopting.b_id, b_id))
        expect(measuresAfter).toHaveLength(0)
    })

    it("should delete measures when the farm is removed", async () => {
        // Capture the measure_adopting rows for our field before deletion
        const applyingBefore = await fdm
            .select({ b_id_measure: schema.measureAdopting.b_id_measure })
            .from(schema.measureAdopting)
            .where(eq(schema.measureAdopting.b_id, b_id))
        expect(applyingBefore.length).toBeGreaterThan(0)
        const measureIds = applyingBefore.map((r) => r.b_id_measure)

        await removeFarm(fdm, principal_id, b_id_farm)

        const measuresAfter = await fdm
            .select()
            .from(schema.measures)
            .where(inArray(schema.measures.b_id_measure, measureIds))
        expect(measuresAfter).toHaveLength(0)
    })
})
