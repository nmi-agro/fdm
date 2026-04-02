import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, inject, it } from "vitest"
import * as schema from "./db/schema"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.d"
import { addField } from "./field"
import { createId } from "./id"
import {
    addSoilAnalysis,
    getCurrentSoilData,
    getSoilAnalyses,
    getSoilAnalysesForFarm,
    getSoilAnalysis,
    getSoilParametersDescription,
    removeSoilAnalysis,
    updateSoilAnalysis,
} from "./soil"
import type { CurrentSoilData } from "./soil.d"

type Polygon = schema.fieldsTypeInsert["b_geometry"]

describe("Soil Analysis Functions", () => {
    let fdm: FdmServerType
    let b_id: string
    let test_a_id: string
    let principal_id: string

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
        principal_id = createId()
        const b_id_farm = await addFarm(
            fdm,
            principal_id,
            farmName,
            farmBusinessId,
            farmAddress,
            farmPostalCode,
        )

        const fieldName = "Test Field"
        const fieldIDSource = "test-field-id"
        const fieldGeometry: Polygon = {
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
        }
        const AcquireDate = new Date("2023-01-01")
        const DiscardingDate = new Date("2023-12-31")
        const acquiringMethod = "nl_01"
        b_id = await addField(
            fdm,
            principal_id,
            b_id_farm,
            fieldName,
            fieldIDSource,
            fieldGeometry,
            AcquireDate,
            acquiringMethod,
            DiscardingDate,
        )
    })

    it("should add a new soil analysis", async () => {
        const a_date = new Date()
        const a_source = "other"
        const a_depth_lower = 30
        const b_sampling_date = new Date()
        // const b_sampling_geometry = 'MULTIPOINT((0 0))'
        const a_p_al = 5
        const a_p_cc = 5
        const b_soiltype_agr = "rivierklei"
        const b_gwl_class = "II"

        test_a_id = await addSoilAnalysis(
            fdm,
            principal_id,
            a_date,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date,
            {
                a_p_al: a_p_al,
                a_p_cc: a_p_cc,
                b_soiltype_agr: b_soiltype_agr,
                b_gwl_class: b_gwl_class,
            },
        )

        expect(test_a_id).toBeDefined()

        const addedAnalysis = await fdm
            .select()
            .from(schema.soilAnalysis)
            .where(eq(schema.soilAnalysis.a_id, test_a_id))
            .limit(1)
        expect(addedAnalysis).toHaveLength(1)
        expect(addedAnalysis[0].a_date).toEqual(a_date)
        expect(addedAnalysis[0].a_source).toEqual(a_source)
        expect(addedAnalysis[0].a_p_al).toEqual(a_p_al)
        expect(addedAnalysis[0].a_p_cc).toEqual(a_p_cc)
        expect(addedAnalysis[0].b_soiltype_agr).toEqual(b_soiltype_agr)
        expect(addedAnalysis[0].b_gwl_class).toEqual(b_gwl_class)

        const addedSampling = await fdm
            .select()
            .from(schema.soilSampling)
            .where(eq(schema.soilSampling.a_id, test_a_id))
            .limit(1)

        expect(addedSampling).toHaveLength(1)
        expect(addedSampling[0].b_id).toEqual(b_id)
        expect(addedSampling[0].b_sampling_date).toEqual(b_sampling_date)
        expect(addedSampling[0].a_depth_lower).toEqual(a_depth_lower)
        expect(addedSampling[0].a_depth_upper).toEqual(0)
    })

    it("should throw an error if lower depth is greater than upper depth", async () => {
        const a_date = new Date()
        const a_source = "other"
        const a_depth_lower = 30
        const a_depth_upper = 60
        const b_sampling_date = new Date()
        // const b_sampling_geometry = 'MULTIPOINT((0 0))'
        const a_p_al = 5
        const a_p_cc = 5
        const b_soiltype_agr = "rivierklei"
        const b_gwl_class = "II"

        await expect(
            addSoilAnalysis(
                fdm,
                principal_id,
                a_date,
                a_source,
                b_id,
                a_depth_lower,
                b_sampling_date,
                {
                    a_p_al: a_p_al,
                    a_p_cc: a_p_cc,
                    b_soiltype_agr: b_soiltype_agr,
                    b_gwl_class: b_gwl_class,
                },
                a_depth_upper,
            ),
        ).rejects.toThrowError("Exception for addSoilAnalysis")
    })

    it("should add a new soil analysis with upper and lower depth", async () => {
        const a_date = new Date()
        const a_source = "other"
        const a_depth_lower = 60
        const a_depth_upper = 30
        const b_sampling_date = new Date()
        // const b_sampling_geometry = 'MULTIPOINT((0 0))'
        const a_p_al = 5
        const a_p_cc = 5
        const b_soiltype_agr = "rivierklei"
        const b_gwl_class = "II"

        test_a_id = await addSoilAnalysis(
            fdm,
            principal_id,
            a_date,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date,
            {
                a_p_al: a_p_al,
                a_p_cc: a_p_cc,
                b_soiltype_agr: b_soiltype_agr,
                b_gwl_class: b_gwl_class,
            },
            a_depth_upper,
        )

        expect(test_a_id).toBeDefined()

        const addedSampling = await fdm
            .select()
            .from(schema.soilSampling)
            .where(eq(schema.soilSampling.a_id, test_a_id))
            .limit(1)

        expect(addedSampling).toHaveLength(1)
        expect(addedSampling[0].b_id).toEqual(b_id)
        expect(addedSampling[0].b_sampling_date).toEqual(b_sampling_date)
        expect(addedSampling[0].a_depth_lower).toEqual(a_depth_lower)
        expect(addedSampling[0].a_depth_upper).toEqual(a_depth_upper)
    })

    // Test updating existing soil data

    it("should update an existing soil analysis", async () => {
        const a_date = new Date()
        const a_source = "other"
        const a_depth_lower = 30
        const b_sampling_date = new Date("2025-02-01")
        // const b_sampling_geometry = 'MULTIPOINT((0 0))'

        test_a_id = await addSoilAnalysis(
            fdm,
            principal_id,
            a_date,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date,
        )

        // Test updating existing soil data
        await updateSoilAnalysis(fdm, principal_id, test_a_id, {
            a_n_rt: 1000,
        })

        const updatedAnalysis = await fdm
            .select()
            .from(schema.soilAnalysis)
            .where(eq(schema.soilAnalysis.a_id, test_a_id))
            .limit(1)
        expect(updatedAnalysis[0].a_n_rt).toEqual(1000)
    })

    // Test removing existing soil data
    it("should remove an existing soil analysis", async () => {
        const a_date = new Date()
        const a_source = "other"
        const a_depth_lower = 30
        const b_sampling_date = new Date()
        // const b_sampling_geometry = 'MULTIPOINT((0 0))'

        test_a_id = await addSoilAnalysis(
            fdm,
            principal_id,
            a_date,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date,
        )

        // Test removing existing soil data
        await removeSoilAnalysis(fdm, principal_id, test_a_id)

        const removedAnalysis = await fdm
            .select()
            .from(schema.soilAnalysis)
            .where(eq(schema.soilAnalysis.a_id, test_a_id))
        expect(removedAnalysis).toHaveLength(0)

        const removedSampling = await fdm
            .select()
            .from(schema.soilSampling)
            .where(eq(schema.soilSampling.a_id, test_a_id))
        expect(removedSampling).toHaveLength(0)
    })

    it("should get latest soil analysis", async () => {
        const a_date_old = new Date("2024-01-02T00:00:00Z")
        const a_source = "other"
        const a_som_loi = 5
        const a_depth_lower = 30
        const b_sampling_date_old = new Date("2024-01-01T00:00:00Z")
        // const b_sampling_geometry = 'MULTIPOINT((0 0))'

        test_a_id = await addSoilAnalysis(
            fdm,
            principal_id,
            a_date_old,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date_old,
        )

        const b_sampling_date_new = new Date(
            b_sampling_date_old.getTime() + 5000,
        ) // Add 5 seconds

        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date_old,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date_new,
            { a_som_loi: a_som_loi },
        )

        const allAnalyses = await getSoilAnalyses(fdm, principal_id, b_id)
        expect(allAnalyses).toHaveLength(2)

        // get soil analysis for field
        const latestAnalysis = await getSoilAnalysis(
            fdm,
            principal_id,
            allAnalyses[0].a_id,
        )
        expect(latestAnalysis?.a_date).toEqual(a_date_old)
        expect(latestAnalysis?.b_sampling_date).toEqual(b_sampling_date_new)
        expect(latestAnalysis?.a_som_loi).toEqual(a_som_loi)
    })

    it("should get all soil analysis", async () => {
        const a_date = new Date()
        const a_source = "other"
        const a_som_loi = 7
        const a_depth_lower = 30
        const b_sampling_date = new Date()
        // const b_sampling_geometry = 'MULTIPOINT((0 0))'

        // Add first soil analysis
        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date,
            { a_som_loi: a_som_loi },
        )

        // Add second soil analysis
        await addSoilAnalysis(
            fdm,
            principal_id,
            new Date(Date.now() + 1000),
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date,
            { a_som_loi: a_som_loi },
        )

        const allAnalyses = await getSoilAnalyses(fdm, principal_id, b_id)
        expect(allAnalyses).toHaveLength(2)
    })

    it("should get soil analyses within a timeframe", async () => {
        // Add soil analyses with different sampling dates
        await addSoilAnalysis(
            fdm,
            principal_id,
            new Date("2023-03-15"),
            "other",
            b_id,
            10,
            new Date("2023-03-15"),
        )
        await addSoilAnalysis(
            fdm,
            principal_id,
            new Date("2023-04-20"),
            "other",
            b_id,
            15,
            new Date("2023-04-20"),
        )
        await addSoilAnalysis(
            fdm,
            principal_id,
            new Date("2023-05-25"),
            "other",
            b_id,
            20,
            new Date("2023-05-25"),
        )
        await addSoilAnalysis(
            fdm,
            principal_id,
            new Date("2023-06-30"),
            "other",
            b_id,
            25,
            new Date("2023-06-30"),
        )

        // Test with a timeframe that includes only the second analysis
        const timeframe1 = {
            start: new Date("2023-04-01"),
            end: new Date("2023-04-30"),
        }
        const analyses1 = await getSoilAnalyses(
            fdm,
            principal_id,
            b_id,
            timeframe1,
        )
        analyses1.forEach((analysis) => {
            expect(analysis.b_sampling_date).toBeInstanceOf(Date)
            expect(analysis.b_sampling_date?.getTime()).toBeGreaterThanOrEqual(
                timeframe1.start.getTime(),
            )
            expect(analysis.b_sampling_date?.getTime()).toBeLessThanOrEqual(
                timeframe1.end.getTime(),
            )
        })

        // Test with a timeframe that includes the second and third analyses
        const timeframe2 = {
            start: new Date("2023-04-01"),
            end: new Date("2023-05-31"),
        }
        const analyses2 = await getSoilAnalyses(
            fdm,
            principal_id,
            b_id,
            timeframe2,
        )
        analyses2.forEach((analysis) => {
            expect(analysis.b_sampling_date).toBeInstanceOf(Date)
            expect(analysis.b_sampling_date?.getTime()).toBeGreaterThanOrEqual(
                timeframe2.start.getTime(),
            )
            expect(analysis.b_sampling_date?.getTime()).toBeLessThanOrEqual(
                timeframe2.end.getTime(),
            )
        })

        // Test with a timeframe that includes all analyses
        const timeframe3 = {
            start: new Date("2023-03-01"),
            end: new Date("2023-06-30"),
        }
        const analyses3 = await getSoilAnalyses(
            fdm,
            principal_id,
            b_id,
            timeframe3,
        )
        analyses3.forEach((analysis) => {
            expect(analysis.b_sampling_date).toBeInstanceOf(Date)
            expect(analysis.b_sampling_date?.getTime()).toBeGreaterThanOrEqual(
                timeframe3.start.getTime(),
            )
            expect(analysis.b_sampling_date?.getTime()).toBeLessThanOrEqual(
                timeframe3.end.getTime(),
            )
        })

        // Test with only start date
        const timeframe4 = {
            start: new Date("2023-05-01"),
            end: undefined,
        }
        const analyses4 = await getSoilAnalyses(
            fdm,
            principal_id,
            b_id,
            timeframe4,
        )
        analyses4.forEach((analysis) => {
            expect(analysis.b_sampling_date).toBeInstanceOf(Date)
            expect(analysis.b_sampling_date?.getTime()).toBeGreaterThanOrEqual(
                timeframe4.start.getTime(),
            )
        })

        // Test with only end date
        const timeframe5 = {
            start: undefined,
            end: new Date("2023-04-30"),
        }
        const analyses5 = await getSoilAnalyses(
            fdm,
            principal_id,
            b_id,
            timeframe5,
        )
        analyses5.forEach((analysis) => {
            expect(analysis.b_sampling_date).toBeInstanceOf(Date)
            expect(analysis.b_sampling_date?.getTime()).toBeLessThanOrEqual(
                timeframe5.end.getTime(),
            )
        })
        // Test with no timeframe
        const analyses6 = await getSoilAnalyses(fdm, principal_id, b_id)
        expect(analyses6).toHaveLength(4)
    })

    it("should get current soil data", async () => {
        const a_date_old = new Date("2024-01-02T00:00:00Z")
        const a_source = "other"
        const a_som_loi_old = 5
        const a_p_al_old = 10
        const a_depth_lower = 30
        const b_sampling_date_old = new Date("2024-01-01T00:00:00Z")

        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date_old,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date_old,
            { a_som_loi: a_som_loi_old, a_p_al: a_p_al_old },
        )

        const b_sampling_date_new = new Date(
            b_sampling_date_old.getTime() + 5000,
        ) // Add 5 seconds
        const a_som_loi_new = 7
        const a_p_al_new = 12
        const b_gwl_class_new = "III"

        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date_old,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date_new,
            {
                a_som_loi: a_som_loi_new,
                a_p_al: a_p_al_new,
                b_gwl_class: b_gwl_class_new,
            },
        )

        const currentData: CurrentSoilData = await getCurrentSoilData(
            fdm,
            principal_id,
            b_id,
        )
        expect(currentData.length).toBeGreaterThanOrEqual(3)

        const somLoiData = currentData.find(
            (item) => item.parameter === "a_som_loi",
        )
        expect(somLoiData?.value).toEqual(a_som_loi_new)
        expect(somLoiData?.b_sampling_date).toEqual(b_sampling_date_new)

        const pAlData = currentData.find((item) => item.parameter === "a_p_al")
        expect(pAlData?.value).toEqual(a_p_al_new)
        expect(pAlData?.b_sampling_date).toEqual(b_sampling_date_new)

        const gwlClassData = currentData.find(
            (item) => item.parameter === "b_gwl_class",
        )
        expect(gwlClassData?.value).toEqual(b_gwl_class_new)
        expect(gwlClassData?.b_sampling_date).toEqual(b_sampling_date_new)
    })

    it("should get current soil data within a timeframe", async () => {
        const a_date_old = new Date("2024-01-02T00:00:00Z")
        const a_source = "other"
        const a_som_loi_old = 5
        const a_p_al_old = 10
        const a_depth_lower = 30
        const b_sampling_date_old = new Date("2024-01-01T00:00:00Z")

        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date_old,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date_old,
            { a_som_loi: a_som_loi_old, a_p_al: a_p_al_old },
        )

        const b_sampling_date_new = new Date(
            b_sampling_date_old.getTime() + 5000,
        ) // Add 5 seconds
        const a_som_loi_new = 7
        const a_p_al_new = 12
        const b_gwl_class_new = "III"

        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date_old,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date_new,
            {
                a_som_loi: a_som_loi_new,
                a_p_al: a_p_al_new,
                b_gwl_class: b_gwl_class_new,
            },
        )

        const timeframe = {
            start: null,
            end: new Date(b_sampling_date_new.getTime() - 1),
        } // Exclude latest

        const currentData: CurrentSoilData = await getCurrentSoilData(
            fdm,
            principal_id,
            b_id,
            timeframe,
        )
        expect(currentData.length).toBeGreaterThanOrEqual(2)

        const somLoiData = currentData.find(
            (item) => item.parameter === "a_som_loi",
        )
        expect(somLoiData?.value).toEqual(a_som_loi_old)
        expect(somLoiData?.b_sampling_date).toEqual(b_sampling_date_old)

        const pAlData = currentData.find((item) => item.parameter === "a_p_al")
        expect(pAlData?.value).toEqual(a_p_al_old)
        expect(pAlData?.b_sampling_date).toEqual(b_sampling_date_old)

        const gwlClassData = currentData.find(
            (item) => item.parameter === "b_gwl_class",
        )
        expect(gwlClassData).toBeUndefined()

        const timeframe2 = {
            start: null,
            end: new Date(b_sampling_date_new.getTime() + 1000),
        }

        const currentData2: CurrentSoilData = await getCurrentSoilData(
            fdm,
            principal_id,
            b_id,
            timeframe2,
        )
        expect(currentData2.length).toBeGreaterThanOrEqual(3)

        const somLoiData2 = currentData2.find(
            (item) => item.parameter === "a_som_loi",
        )
        expect(somLoiData2?.value).toEqual(a_som_loi_new)
        expect(somLoiData2?.b_sampling_date).toEqual(b_sampling_date_new)

        const pAlData2 = currentData2.find(
            (item) => item.parameter === "a_p_al",
        )
        expect(pAlData2?.value).toEqual(a_p_al_new)
        expect(pAlData2?.b_sampling_date).toEqual(b_sampling_date_new)

        const gwlClassData2 = currentData2.find(
            (item) => item.parameter === "b_gwl_class",
        )
        expect(gwlClassData2?.value).toEqual(b_gwl_class_new)
        expect(gwlClassData2?.b_sampling_date).toEqual(b_sampling_date_new)
    })

    it("should return empty array if no soil data is present within timeframe", async () => {
        const a_date_old = new Date("2024-01-02T00:00:00Z")
        const a_source = "other"
        const a_som_loi_old = 5
        const a_p_al_old = 10
        const a_depth_lower = 30
        const b_sampling_date_old = new Date("2024-01-01T00:00:00Z")

        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date_old,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date_old,
            { a_som_loi: a_som_loi_old, a_p_al: a_p_al_old },
        )
        const timeframe = { start: null, end: new Date("2023-01-01T00:00:00Z") }
        const currentData = await getCurrentSoilData(
            fdm,
            principal_id,
            b_id,
            timeframe,
        )
        expect(currentData.length).toEqual(0)
    })

    it("should return all data if timeframe has no end", async () => {
        const a_date_old = new Date("2024-01-02T00:00:00Z")
        const a_source = "other"
        const a_som_loi_old = 5
        const a_p_al_old = 10
        const a_depth_lower = 30
        const b_sampling_date_old = new Date("2024-01-01T00:00:00Z")

        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date_old,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date_old,
            { a_som_loi: a_som_loi_old, a_p_al: a_p_al_old },
        )
        const timeframe = { start: new Date("2023-01-01T00:00:00Z"), end: null }
        const currentData = await getCurrentSoilData(
            fdm,
            principal_id,
            b_id,
            timeframe,
        )
        expect(currentData.length).toBeGreaterThanOrEqual(2)
    })

    it("should return empty array if no soil data is present", async () => {
        const currentData = await getCurrentSoilData(fdm, principal_id, b_id)
        expect(currentData.length).toEqual(0)
    })

    it("should retrieve soil analyses including those with null b_sampling_date and order correctly", async () => {
        const a_date = new Date()
        const a_source = "other"
        const a_depth_lower = 30

        // Add analyses with valid b_sampling_date
        const b_sampling_date1 = new Date("2024-01-01T00:00:00Z")
        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date1,
        )

        const b_sampling_date2 = new Date("2024-01-05T00:00:00Z")
        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date2,
        )

        // Add an analysis with null b_sampling_date
        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date,
            a_source,
            b_id,
            a_depth_lower,
            null,
        )

        // Retrieve all analyses
        const allAnalyses = await getSoilAnalyses(fdm, principal_id, b_id)

        expect(allAnalyses).toHaveLength(3)

        // Check that the analysis with null date comes last
        expect(allAnalyses[0].b_sampling_date).toEqual(b_sampling_date2)
        expect(allAnalyses[1].b_sampling_date).toEqual(b_sampling_date1)
        expect(allAnalyses[2].b_sampling_date).toBeNull()
    })

    it("should retrieve soil analyses including those with null b_sampling_date and order correctly with timeframe", async () => {
        const a_date = new Date()
        const a_source = "other"
        const a_depth_lower = 30

        // Add analyses with valid b_sampling_date
        const b_sampling_date1 = new Date("2024-01-01T00:00:00Z")
        const properties1 = { a_som_loi: 5 }
        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date1,
            properties1,
        )

        const b_sampling_date2 = new Date("2024-01-05T00:00:00Z")
        const properties2 = { a_som_loi: 6 }
        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date,
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date2,
            properties2,
        )

        // Add an analysis with null b_sampling_date
        const properties3 = { a_som_loi: 7, a_p_al: 20 }
        await addSoilAnalysis(
            fdm,
            principal_id,
            a_date,
            a_source,
            b_id,
            a_depth_lower,
            null,
            properties3,
        )

        // Retrieve all analyses
        const allAnalyses = await getSoilAnalyses(fdm, principal_id, b_id, {
            start: new Date("2023-01-01"),
            end: new Date("2025-01-01"),
        })

        expect(allAnalyses).toHaveLength(3)

        // Check that the analysis with null date comes last
        expect(allAnalyses[0].b_sampling_date).toEqual(b_sampling_date2)
        expect(allAnalyses[1].b_sampling_date).toEqual(b_sampling_date1)
        expect(allAnalyses[2].b_sampling_date).toBeNull()

        const currentData = await getCurrentSoilData(fdm, principal_id, b_id, {
            start: new Date("2023-01-01"),
            end: new Date("2025-01-01"),
        })

        const somLoiData = currentData.find(
            (item) => item.parameter === "a_som_loi",
        )
        expect(somLoiData?.value).toEqual(properties2.a_som_loi)

        const palData = currentData.find((item) => item.parameter === "a_p_al")
        expect(palData?.value).toEqual(properties3.a_p_al)
    })
})

describe("getSoilParametersDescription", () => {
    it("should return the correct soil parameter descriptions for NL-nl locale", () => {
        const descriptions = getSoilParametersDescription("NL-nl")
        expect(descriptions).toHaveLength(42)
        for (const description of descriptions) {
            expect(description).toHaveProperty("parameter")
            expect(description).toHaveProperty("unit")
            expect(description).toHaveProperty("name")
            expect(description).toHaveProperty("type")
            expect(description).toHaveProperty("description")
            if (description.type === "enum") {
                expect(description).toHaveProperty("options")
            }
        }
    })

    it("should throw an error for unsupported locales", () => {
        expect(() => getSoilParametersDescription("en-US")).toThrowError(
            "Unsupported locale",
        )
        expect(() => getSoilParametersDescription("de-DE")).toThrowError(
            "Unsupported locale",
        )
    })

    it("should return the correct soil parameter descriptions for default locale", () => {
        const descriptions = getSoilParametersDescription()
        expect(descriptions).toHaveLength(42)
        for (const description of descriptions) {
            expect(description).toHaveProperty("parameter")
            expect(description).toHaveProperty("unit")
            expect(description).toHaveProperty("name")
            expect(description).toHaveProperty("type")
            expect(description).toHaveProperty("description")
            if (description.type === "enum") {
                expect(description).toHaveProperty("options")
            }
        }
    })
})

describe("getSoilAnalysesForFarm", () => {
    let fdm: FdmServerType
    let principal_id: string
    let b_id_farm: string
    let b_id: string
    let b_id_2: string

    const geometry: schema.fieldsTypeInsert["b_geometry"] = {
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
    }

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
            "Field 1",
            "src1",
            geometry,
            new Date("2023-01-01"),
            "nl_01",
            new Date("2023-12-31"),
        )

        b_id_2 = await addField(
            fdm,
            principal_id,
            b_id_farm,
            "Field 2",
            "src2",
            geometry,
            new Date("2023-01-01"),
            "nl_01",
            new Date("2023-12-31"),
        )
    })

    it("should return a Map with analyses grouped by field ID", async () => {
        await addSoilAnalysis(
            fdm,
            principal_id,
            new Date("2023-05-01"),
            "other",
            b_id,
            30,
            new Date("2023-05-01"),
            { a_p_al: 10 },
        )
        await addSoilAnalysis(
            fdm,
            principal_id,
            new Date("2023-06-01"),
            "other",
            b_id_2,
            30,
            new Date("2023-06-01"),
            { a_p_al: 20 },
        )

        const result = await getSoilAnalysesForFarm(
            fdm,
            principal_id,
            b_id_farm,
        )

        expect(result).toBeInstanceOf(Map)
        expect(result.has(b_id)).toBe(true)
        expect(result.has(b_id_2)).toBe(true)
        expect(result.get(b_id)).toHaveLength(1)
        expect(result.get(b_id_2)).toHaveLength(1)
        expect(result.get(b_id)![0].a_p_al).toBe(10)
        expect(result.get(b_id_2)![0].a_p_al).toBe(20)
    })

    it("should return an empty Map when the farm has no soil analyses", async () => {
        const result = await getSoilAnalysesForFarm(
            fdm,
            principal_id,
            b_id_farm,
        )
        expect(result).toBeInstanceOf(Map)
        expect(result.size).toBe(0)
    })

    it("should only return analyses within the given timeframe", async () => {
        await addSoilAnalysis(
            fdm,
            principal_id,
            new Date("2023-05-01"),
            "other",
            b_id,
            30,
            new Date("2023-05-01"),
            { a_p_al: 10 },
        )
        await addSoilAnalysis(
            fdm,
            principal_id,
            new Date("2025-05-01"),
            "other",
            b_id_2,
            30,
            new Date("2025-05-01"),
            { a_p_al: 20 },
        )

        const timeframe = {
            start: new Date("2023-01-01"),
            end: new Date("2023-12-31"),
        }
        const result = await getSoilAnalysesForFarm(
            fdm,
            principal_id,
            b_id_farm,
            timeframe,
        )

        expect(result.has(b_id)).toBe(true)
        expect(result.has(b_id_2)).toBe(false)
    })

    it("should not include analyses from other farms", async () => {
        const other_farm = await addFarm(
            fdm,
            principal_id,
            "Other Farm",
            "654321",
            "456 Other Lane",
            "67890",
        )
        const other_b_id = await addField(
            fdm,
            principal_id,
            other_farm,
            "other field",
            "src3",
            geometry,
            new Date("2023-01-01"),
            "nl_01",
            new Date("2023-12-31"),
        )

        await addSoilAnalysis(
            fdm,
            principal_id,
            new Date("2023-05-01"),
            "other",
            other_b_id,
            30,
            new Date("2023-05-01"),
            { a_p_al: 99 },
        )
        await addSoilAnalysis(
            fdm,
            principal_id,
            new Date("2023-06-01"),
            "other",
            b_id,
            30,
            new Date("2023-06-01"),
            { a_p_al: 10 },
        )

        const result = await getSoilAnalysesForFarm(
            fdm,
            principal_id,
            b_id_farm,
        )

        expect(result.has(b_id)).toBe(true)
        expect(result.has(other_b_id)).toBe(false)
    })
})
