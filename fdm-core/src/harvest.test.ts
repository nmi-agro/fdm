import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest"
import { enableCultivationCatalogue } from "./catalogues"
import { addCultivation, addCultivationToCatalogue } from "./cultivation"
import type { cultivationsCatalogueTypeSelect } from "./db/schema"
import * as schema from "./db/schema"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.types"
import { addField } from "./field"
import {
    addHarvest,
    getDefaultsForHarvestParameters,
    getHarvest,
    getHarvests,
    getHarvestsForFarm,
    getParametersForHarvestCat,
    updateHarvest,
} from "./harvest"
import { convertHarvestParameters } from "./harvest-conversion"
import { createId } from "./id"

describe("Harvest Data Model", () => {
    let fdm: FdmServerType
    let b_lu_catalogue: string
    let b_id_farm: string
    let b_id: string
    let b_lu: string
    let b_lu_start: Date
    let principal_id: string
    let b_lu_source: string
    let b_id_harvesting: string

    beforeEach(async () => {
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        fdm = createFdmServer(host, port, user, password, database)

        b_lu_catalogue = createId()
        const farmName = "Test Farm"
        const farmBusinessId = "123456"
        const farmAddress = "123 Farm Lane"
        const farmPostalCode = "12345"
        principal_id = createId()
        b_id_farm = await addFarm(
            fdm,
            principal_id,
            farmName,
            farmBusinessId,
            farmAddress,
            farmPostalCode,
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

        b_lu_source = "custom"
        await enableCultivationCatalogue(
            fdm,
            principal_id,
            b_id_farm,
            b_lu_source,
        )

        await addCultivationToCatalogue(fdm, {
            b_lu_catalogue,
            b_lu_source: b_lu_source,
            b_lu_name: "test-name",
            b_lu_name_en: "test-name-en",
            b_lu_harvestable: "once",
            b_lu_hcat3: "test-hcat3",
            b_lu_hcat3_name: "test-hcat3-name",
            b_lu_croprotation: "cereal",
            b_lu_harvestcat: "HC050",
            b_lu_dm: 500,
            b_lu_yield: 6000,
            b_lu_hi: 0.4,
            b_lu_n_harvestable: 4,
            b_lu_n_residue: 2,
            b_n_fixation: 0,
            b_lu_rest_oravib: false,
            b_lu_variety_options: null,
            b_lu_start_default: "03-15",
            b_lu_eom: null,
            b_lu_eom_residue: null,
            b_date_harvest_default: "09-15",
        })

        await addCultivationToCatalogue(fdm, {
            b_lu_catalogue: `${b_lu_catalogue}-multiple`,
            b_lu_source: b_lu_source,
            b_lu_name: "test-name-multiple",
            b_lu_name_en: "test-name-en-multiple",
            b_lu_harvestable: "multiple",
            b_lu_hcat3: "test-hcat3-multiple",
            b_lu_hcat3_name: "test-hcat3-name-multiple",
            b_lu_croprotation: "grass",
            b_lu_harvestcat: "HC042",
            b_lu_dm: 500,
            b_lu_yield: 2000,
            b_lu_hi: 0.4,
            b_lu_n_harvestable: 12,
            b_lu_n_residue: 2,
            b_n_fixation: 0,
            b_lu_rest_oravib: false,
            b_lu_variety_options: ["Agria"],
            b_lu_start_default: "03-15",
            b_lu_eom: null,
            b_lu_eom_residue: null,
            b_date_harvest_default: "09-15",
        })

        b_lu_start = new Date("2024-01-01")
        b_lu = await addCultivation(
            fdm,
            principal_id,
            b_lu_catalogue,
            b_id,
            b_lu_start,
        )
    })

    afterAll(async () => {
        // Clean up the database after all tests have run
        // You can add any necessary cleanup logic here
    })

    it("should add a new harvest to a cultivation", async () => {
        const harvestDate = new Date("2024-08-01")
        const yieldValue = 6000

        const newHarvestId = await addHarvest(
            fdm,
            principal_id,
            b_lu,
            harvestDate,
            {
                b_lu_yield_fresh: yieldValue,
                b_lu_moist: 15,
                b_lu_cp: 110,
            },
        )

        expect(newHarvestId).toBeDefined()

        const harvests = await getHarvests(fdm, principal_id, b_lu)
        const newHarvest = harvests.find(
            (h) => h.b_id_harvesting === newHarvestId,
        )

        expect(newHarvest).toBeDefined()
        expect(newHarvest?.b_lu_harvest_date).toEqual(harvestDate)
        expect(
            newHarvest?.harvestable.harvestable_analyses[0].b_lu_yield_fresh,
        ).toEqual(yieldValue)
    })

    it("should retrieve a harvest by its ID", async () => {
        b_id_harvesting = await addHarvest(
            fdm,
            principal_id,
            b_lu,
            new Date("2024-07-01"),
            {
                b_lu_yield_fresh: 10000,
                b_lu_moist: 15,
                b_lu_cp: 110,
            },
        )
        const harvest = await getHarvest(fdm, principal_id, b_id_harvesting)
        expect(harvest).toBeDefined()
        expect(harvest.b_id_harvesting).toEqual(b_id_harvesting)
    })

    it("should update an existing harvest", async () => {
        b_id_harvesting = await addHarvest(
            fdm,
            principal_id,
            b_lu,
            new Date("2024-07-01"),
            {
                b_lu_yield_fresh: 10000,
                b_lu_moist: 15,
                b_lu_cp: 110,
            },
        )
        const newHarvestDate = new Date("2024-07-15")
        const newYield = 5500
        const newMoist = 16
        const newCP = 111

        await updateHarvest(
            fdm,
            principal_id,
            b_id_harvesting,
            newHarvestDate,
            {
                b_lu_yield_fresh: newYield,
                b_lu_moist: newMoist,
                b_lu_cp: newCP,
            },
        )

        const updatedHarvest = await getHarvest(
            fdm,
            principal_id,
            b_id_harvesting,
        )

        expect(updatedHarvest.b_lu_harvest_date).toEqual(newHarvestDate)
        const analysis = updatedHarvest.harvestable.harvestable_analyses[0]
        expect(analysis.b_lu_yield_fresh).toEqual(newYield)
        expect(analysis.b_lu_moist).toEqual(newMoist)
        expect(analysis.b_lu_cp).toEqual(newCP)
    })

    it("should throw an error when updating a non-existent harvest", async () => {
        const nonExistentHarvestId = createId()
        await expect(
            updateHarvest(fdm, principal_id, nonExistentHarvestId, new Date(), {
                b_lu_yield: 5000,
                b_lu_n_harvestable: 1.1,
            }),
        ).rejects.toThrowError(
            "Principal does not have permission to perform this action",
        )
    })

    it("should throw an error when updating a harvest without permission", async () => {
        b_id_harvesting = await addHarvest(
            fdm,
            principal_id,
            b_lu,
            new Date("2024-07-01"),
            {
                b_lu_yield_fresh: 10000,
                b_lu_moist: 15,
                b_lu_cp: 110,
            },
        )
        const other_principal_id = createId()
        await expect(
            updateHarvest(
                fdm,
                other_principal_id,
                b_id_harvesting,
                new Date(),
                {
                    b_lu_yield: 5000,
                    b_lu_n_harvestable: 1.1,
                },
            ),
        ).rejects.toThrowError(
            "Principal does not have permission to perform this action",
        )
    })

    it("should throw an error when updating with an invalid harvest date", async () => {
        b_id_harvesting = await addHarvest(
            fdm,
            principal_id,
            b_lu,
            new Date("2024-07-01"),
            {
                b_lu_yield_fresh: 10000,
                b_lu_moist: 15,
                b_lu_cp: 110,
            },
        )
        const invalidHarvestDate = new Date("2023-12-31") // Before sowing date
        await expect(
            updateHarvest(
                fdm,
                principal_id,
                b_id_harvesting,
                invalidHarvestDate,
                {
                    b_lu_yield: 5000,
                    b_lu_n_harvestable: 1.1,
                },
            ),
        ).rejects.toThrowError("Exception for updateHarvest")
    })

    it("should update cultivation end date for 'once' harvestable cultivations", async () => {
        b_id_harvesting = await addHarvest(
            fdm,
            principal_id,
            b_lu,
            new Date("2024-07-01"),
            {
                b_lu_yield_fresh: 10000,
                b_lu_moist: 15,
                b_lu_cp: 110,
            },
        )
        const newHarvestDate = new Date("2024-08-01")
        await updateHarvest(
            fdm,
            principal_id,
            b_id_harvesting,
            newHarvestDate,
            {
                b_lu_yield_fresh: 10000,
                b_lu_moist: 15,
                b_lu_cp: 110,
            },
        )

        const cultivation = await fdm
            .select()
            .from(schema.cultivationEnding)
            .where(eq(schema.cultivationEnding.b_lu, b_lu))
            .limit(1)

        expect(cultivation[0].b_lu_end).toEqual(newHarvestDate)
    })

    it("should not update cultivation end date for 'multiple' harvestable cultivations", async () => {
        const newHarvestDate = new Date("2024-08-01")
        const b_lu_multiple = await addCultivation(
            fdm,
            principal_id,
            `${b_lu_catalogue}-multiple`,
            b_id,
            b_lu_start,
        )

        const b_id_harvesting_multiple = await addHarvest(
            fdm,
            principal_id,
            b_lu_multiple,
            new Date("2024-07-01"),
            {
                b_lu_yield_bruto: 10000,
                b_lu_tarra: 5,
                b_lu_uww: 400,
                b_lu_n_harvestable: 20,
            },
        )

        await updateHarvest(
            fdm,
            principal_id,
            b_id_harvesting_multiple,
            newHarvestDate,
            {
                b_lu_yield_bruto: 10000,
                b_lu_tarra: 5,
                b_lu_uww: 400,
                b_lu_n_harvestable: 20,
            },
        )

        const cultivation = await fdm
            .select()
            .from(schema.cultivationEnding)
            .where(eq(schema.cultivationEnding.b_lu, b_lu_multiple))
            .limit(1)

        expect(cultivation[0].b_lu_end).not.toEqual(newHarvestDate)
    })

    it("should throw an error when updating harvest date after terminating date for 'multiple' harvestable cultivations", async () => {
        const b_lu_multiple = await addCultivation(
            fdm,
            principal_id,
            `${b_lu_catalogue}-multiple`,
            b_id,
            b_lu_start,
        )

        const b_id_harvesting_multiple = await addHarvest(
            fdm,
            principal_id,
            b_lu_multiple,
            new Date("2024-07-01"),
            {
                b_lu_yield_bruto: 10000,
                b_lu_tarra: 5,
                b_lu_uww: 400,
                b_lu_n_harvestable: 20,
            },
        )

        // Set a terminating date for the cultivation
        await fdm
            .update(schema.cultivationEnding)
            .set({ b_lu_end: new Date("2024-07-30") })
            .where(eq(schema.cultivationEnding.b_lu, b_lu_multiple))

        const newHarvestDate = new Date("2024-08-01") // After terminating date

        await expect(
            updateHarvest(
                fdm,
                principal_id,
                b_id_harvesting_multiple,
                newHarvestDate,
                {},
            ),
        ).rejects.toThrowError("Exception for updateHarvest")
    })
})

describe("getParametersForHarvestCat", () => {
    it('should return correct parameters for "HC010"', () => {
        const params = getParametersForHarvestCat("HC010")
        expect(params).toEqual([
            "b_lu_yield_fresh",
            "b_lu_dm",
            "b_lu_n_harvestable",
        ])
    })

    it('should return correct parameters for "HC020"', () => {
        const params = getParametersForHarvestCat("HC020")
        expect(params).toEqual(["b_lu_yield", "b_lu_cp"])
    })

    it('should return correct parameters for "HC031"', () => {
        const params = getParametersForHarvestCat("HC031")
        expect(params).toEqual(["b_lu_yield", "b_lu_cp"])
    })

    it('should return correct parameters for "HC040"', () => {
        const params = getParametersForHarvestCat("HC040")
        expect(params).toEqual([
            "b_lu_yield_bruto",
            "b_lu_tarra",
            "b_lu_dm",
            "b_lu_n_harvestable",
        ])
    })

    it('should return correct parameters for "HC041"', () => {
        const params = getParametersForHarvestCat("HC041")
        expect(params).toEqual([
            "b_lu_yield_bruto",
            "b_lu_tarra",
            "b_lu_dm",
            "b_lu_n_harvestable",
        ])
    })

    it('should return correct parameters for "HC042"', () => {
        const params = getParametersForHarvestCat("HC042")
        expect(params).toEqual([
            "b_lu_yield_bruto",
            "b_lu_tarra",
            "b_lu_uww",
            "b_lu_n_harvestable",
        ])
    })

    it('should return correct parameters for "HC050"', () => {
        const params = getParametersForHarvestCat("HC050")
        expect(params).toEqual(["b_lu_yield_fresh", "b_lu_moist", "b_lu_cp"])
    })

    it("should return an empty array for an unrecognized harvest category", () => {
        const params = getParametersForHarvestCat("UNKNOWN_CAT" as any)
        expect(params).toEqual([])
    })

    it("should return an empty array for null input", () => {
        const params = getParametersForHarvestCat(null as any)
        expect(params).toEqual([])
    })

    it("should return an empty array for undefined input", () => {
        const params = getParametersForHarvestCat(undefined as any)
        expect(params).toEqual([])
    })
})

describe("getDefaultsForHarvestParameters", () => {
    const mockCultivationsCatalogue: cultivationsCatalogueTypeSelect[] = [
        {
            b_lu_catalogue: "HC010-catalogue",
            b_lu_source: "test",
            b_lu_name: "Test Crop HC010",
            b_lu_name_en: "Test Crop HC010",
            b_lu_harvestable: "once",
            b_lu_hcat3: "maize",
            b_lu_hcat3_name: "test",
            b_lu_croprotation: "cereal",
            b_lu_harvestcat: "HC010",
            b_lu_dm: 200,
            b_lu_yield: 2000,
            b_lu_hi: 0.5,
            b_lu_n_harvestable: 15,
            b_lu_n_residue: 5,
            b_n_fixation: 0,
            b_lu_eom: null,
            b_lu_eom_residue: null,
            b_lu_rest_oravib: false,
            b_lu_variety_options: null,
            b_lu_start_default: "01-01",
            b_date_harvest_default: "12-31",
            created: new Date(),
            updated: new Date(),
            hash: "test-hash-HC010",
        },
        {
            b_lu_catalogue: "HC020-catalogue",
            b_lu_source: "test",
            b_lu_name: "Test Crop HC020",
            b_lu_name_en: "Test Crop HC020",
            b_lu_harvestable: "once",
            b_lu_hcat3: "grass",
            b_lu_hcat3_name: "test",
            b_lu_croprotation: "grass",
            b_lu_harvestcat: "HC020",
            b_lu_dm: 150,
            b_lu_yield: 2000,
            b_lu_hi: 0.5,
            b_lu_n_harvestable: 20,
            b_lu_n_residue: 5,
            b_n_fixation: 0,
            b_lu_eom: null,
            b_lu_eom_residue: null,
            b_lu_rest_oravib: false,
            b_lu_variety_options: null,
            b_lu_start_default: "01-01",
            b_date_harvest_default: "12-31",
            created: new Date(),
            updated: new Date(),
            hash: "test-hash-HC020",
        },
        {
            b_lu_catalogue: "HC031-catalogue",
            b_lu_source: "test",
            b_lu_name: "Test Crop HC031",
            b_lu_name_en: "Test Crop HC031",
            b_lu_harvestable: "once",
            b_lu_hcat3: "maize",
            b_lu_hcat3_name: "test",
            b_lu_croprotation: "maize",
            b_lu_harvestcat: "HC031",
            b_lu_dm: 350,
            b_lu_yield: 4900,
            b_lu_hi: 0.5,
            b_lu_n_harvestable: 14,
            b_lu_n_residue: 5,
            b_n_fixation: 0,
            b_lu_eom: null,
            b_lu_eom_residue: null,
            b_lu_rest_oravib: false,
            b_lu_variety_options: null,
            b_lu_start_default: "01-01",
            b_date_harvest_default: "12-31",
            created: new Date(),
            updated: new Date(),
            hash: "test-hash-HC031",
        },
        {
            b_lu_catalogue: "HC040-catalogue",
            b_lu_source: "test",
            b_lu_name: "Test Crop HC040",
            b_lu_name_en: "Test Crop HC040",
            b_lu_harvestable: "once",
            b_lu_hcat3: "maize",
            b_lu_hcat3_name: "test",
            b_lu_croprotation: "potato",
            b_lu_harvestcat: "HC040",
            b_lu_dm: 250,
            b_lu_yield: 13500,
            b_lu_hi: 0.5,
            b_lu_n_harvestable: 20,
            b_lu_n_residue: 5,
            b_n_fixation: 0,
            b_lu_eom: null,
            b_lu_eom_residue: null,
            b_lu_rest_oravib: false,
            b_lu_variety_options: null,
            b_lu_start_default: "01-01",
            b_date_harvest_default: "12-31",
            created: new Date(),
            updated: new Date(),
            hash: "test-hash-HC040",
        },
        {
            b_lu_catalogue: "HC041-catalogue",
            b_lu_source: "test",
            b_lu_name: "Test Crop HC041",
            b_lu_name_en: "Test Crop HC041",
            b_lu_harvestable: "once",
            b_lu_hcat3: "sugarbeet",
            b_lu_hcat3_name: "test",
            b_lu_croprotation: "sugarbeet",
            b_lu_harvestcat: "HC041",
            b_lu_dm: 220,
            b_lu_yield: 14960,
            b_lu_hi: 0.5,
            b_lu_n_harvestable: 18,
            b_lu_n_residue: 5,
            b_n_fixation: 0,
            b_lu_eom: null,
            b_lu_eom_residue: null,
            b_lu_rest_oravib: false,
            b_lu_variety_options: null,
            b_lu_start_default: "01-01",
            b_date_harvest_default: "12-31",
            created: new Date(),
            updated: new Date(),
            hash: "test-hash-HC041",
        },
        {
            b_lu_catalogue: "HC042-catalogue",
            b_lu_source: "test",
            b_lu_name: "Test Crop HC042",
            b_lu_name_en: "Test Crop HC042",
            b_lu_harvestable: "once",
            b_lu_hcat3: "potato",
            b_lu_hcat3_name: "test",
            b_lu_croprotation: "potato",
            b_lu_harvestcat: "HC042",
            b_lu_dm: 191.5, // This will be calculated from uww
            b_lu_yield: 7000,
            b_lu_hi: 0.5,
            b_lu_n_harvestable: 25,
            b_lu_n_residue: 5,
            b_n_fixation: 0,
            b_lu_eom: null,
            b_lu_eom_residue: null,
            b_lu_rest_oravib: false,
            b_lu_variety_options: null,
            b_lu_start_default: "01-01",
            b_date_harvest_default: "12-31",
            created: new Date(),
            updated: new Date(),
            hash: "test-hash-HC042",
        },
        {
            b_lu_catalogue: "HC050-catalogue",
            b_lu_source: "test",
            b_lu_name: "Test Crop HC050",
            b_lu_name_en: "Test Crop HC050",
            b_lu_harvestable: "once",
            b_lu_hcat3: "cereal",
            b_lu_hcat3_name: "test",
            b_lu_croprotation: "cereal",
            b_lu_harvestcat: "HC050",
            b_lu_dm: 850, // 15% moisture
            b_lu_yield: 6800,
            b_lu_hi: 0.5,
            b_lu_n_harvestable: 20, // Corresponds to 114 g/kg CP
            b_lu_n_residue: 5,
            b_n_fixation: 0,
            b_lu_eom: null,
            b_lu_eom_residue: null,
            b_lu_rest_oravib: false,
            b_lu_variety_options: null,
            b_lu_start_default: "01-01",
            b_date_harvest_default: "12-31",
            created: new Date(),
            updated: new Date(),
            hash: "test-hash-HC050",
        },
        {
            b_lu_catalogue: "UNKNOWN-catalogue",
            b_lu_source: "test",
            b_lu_name: "Test Crop UNKNOWN",
            b_lu_name_en: "Test Crop UNKNOWN",
            b_lu_harvestable: "once",
            b_lu_hcat3: "maize",
            b_lu_hcat3_name: "test",
            b_lu_croprotation: "cereal",
            b_lu_harvestcat: null, // Changed to null to match schema type
            b_lu_dm: 800,
            b_lu_yield: 5000,
            b_lu_hi: 0.5,
            b_lu_n_harvestable: 10,
            b_lu_n_residue: 5,
            b_n_fixation: 0,
            b_lu_eom: null,
            b_lu_eom_residue: null,
            b_lu_rest_oravib: false,
            b_lu_variety_options: null,
            b_lu_start_default: "01-01",
            b_date_harvest_default: "12-31",
            created: new Date(),
            updated: new Date(),
            hash: "test-hash-UNKNOWN",
        },
    ]

    it("should throw an error if cultivation catalogue item is not found", () => {
        expect(() =>
            getDefaultsForHarvestParameters(
                "non-existent",
                mockCultivationsCatalogue,
            ),
        ).toThrowError("Cultivations catalogue item not found")
    })

    describe("HC010 - Standard", () => {
        it("should return correct default parameters for HC010", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC010-catalogue",
                mockCultivationsCatalogue,
            )
            expect(defaults).toEqual({
                b_lu_yield_fresh: 10000,
                b_lu_dm: 200,
                b_lu_n_harvestable: 15,
            })
        })

        it("should convert HC010 defaults back to original standardized values", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC010-catalogue",
                mockCultivationsCatalogue,
            )
            const originalCatalogueItem = mockCultivationsCatalogue.find(
                (item) => item.b_lu_catalogue === "HC010-catalogue",
            )!
            const converted = convertHarvestParameters(
                originalCatalogueItem.b_lu_harvestcat,
                undefined,
                undefined,
                defaults.b_lu_yield_fresh,
                undefined,
                undefined,
                undefined,
                defaults.b_lu_dm,
                undefined,
                defaults.b_lu_n_harvestable,
            )
            expect(converted.b_lu_yield).toBe(originalCatalogueItem.b_lu_yield)
            expect(converted.b_lu_n_harvestable).toBe(
                originalCatalogueItem.b_lu_n_harvestable,
            )
        })
    })

    describe("HC020 - Grassland", () => {
        it("should return correct default parameters for HC020", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC020-catalogue",
                mockCultivationsCatalogue,
            )
            expect(defaults).toEqual({
                b_lu_yield: 2000,
                b_lu_cp: 125, // 20 * 6.25
            })
        })

        it("should convert HC020 defaults back to original standardized values", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC020-catalogue",
                mockCultivationsCatalogue,
            )
            const originalCatalogueItem = mockCultivationsCatalogue.find(
                (item) => item.b_lu_catalogue === "HC020-catalogue",
            )!
            const converted = convertHarvestParameters(
                originalCatalogueItem.b_lu_harvestcat,
                defaults.b_lu_yield,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                defaults.b_lu_cp,
                undefined,
            )
            expect(converted.b_lu_yield).toBe(originalCatalogueItem.b_lu_yield)
            expect(converted.b_lu_n_harvestable).toBe(
                originalCatalogueItem.b_lu_n_harvestable,
            )
        })
    })

    describe("HC031 - Maize", () => {
        it("should return correct default parameters for HC031", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC031-catalogue",
                mockCultivationsCatalogue,
            )
            expect(defaults).toEqual({
                b_lu_yield: 4900,
                b_lu_cp: 88, // Rounded from 87.5
            })
        })

        it("should convert HC031 defaults back to original standardized values", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC031-catalogue",
                mockCultivationsCatalogue,
            )
            const originalCatalogueItem = mockCultivationsCatalogue.find(
                (item) => item.b_lu_catalogue === "HC031-catalogue",
            )!
            const converted = convertHarvestParameters(
                originalCatalogueItem.b_lu_harvestcat,
                defaults.b_lu_yield,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                defaults.b_lu_cp,
                undefined,
            )
            expect(converted.b_lu_yield).toBe(originalCatalogueItem.b_lu_yield)
            expect(converted.b_lu_n_harvestable).toBe(
                originalCatalogueItem.b_lu_n_harvestable,
            )
        })
    })

    describe("HC040 - Root crops", () => {
        it("should return correct default parameters for HC040", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC040-catalogue",
                mockCultivationsCatalogue,
            )
            expect(defaults).toEqual({
                b_lu_yield_bruto: 56842,
                b_lu_tarra: 5,
                b_lu_dm: 250,
                b_lu_n_harvestable: 20,
            })
        })

        it("should convert HC040 defaults back to original standardized values", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC040-catalogue",
                mockCultivationsCatalogue,
            )
            const originalCatalogueItem = mockCultivationsCatalogue.find(
                (item) => item.b_lu_catalogue === "HC040-catalogue",
            )!
            const converted = convertHarvestParameters(
                originalCatalogueItem.b_lu_harvestcat,
                undefined,
                defaults.b_lu_yield_bruto,
                undefined,
                defaults.b_lu_tarra,
                undefined,
                undefined,
                defaults.b_lu_dm,
                undefined,
                defaults.b_lu_n_harvestable,
            )
            expect(converted.b_lu_yield).toBe(originalCatalogueItem.b_lu_yield)
            expect(converted.b_lu_n_harvestable).toBe(
                originalCatalogueItem.b_lu_n_harvestable,
            )
        })
    })

    describe("HC041 - Sugar beet", () => {
        it("should return correct default parameters for HC041", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC041-catalogue",
                mockCultivationsCatalogue,
            )
            expect(defaults).toEqual({
                b_lu_yield_bruto: 71579,
                b_lu_tarra: 5,
                b_lu_dm: 220,
                b_lu_n_harvestable: 18,
            })
        })

        it("should convert HC041 defaults back to original standardized values", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC041-catalogue",
                mockCultivationsCatalogue,
            )
            const originalCatalogueItem = mockCultivationsCatalogue.find(
                (item) => item.b_lu_catalogue === "HC041-catalogue",
            )!
            const converted = convertHarvestParameters(
                originalCatalogueItem.b_lu_harvestcat,
                undefined,
                defaults.b_lu_yield_bruto,
                undefined,
                defaults.b_lu_tarra,
                undefined,
                undefined,
                defaults.b_lu_dm,
                undefined,
                defaults.b_lu_n_harvestable,
            )
            expect(converted.b_lu_yield).toBe(originalCatalogueItem.b_lu_yield)
            expect(converted.b_lu_n_harvestable).toBe(
                originalCatalogueItem.b_lu_n_harvestable,
            )
        })
    })

    describe("HC042 - Potatoes", () => {
        it("should return correct default parameters for HC042", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC042-catalogue",
                mockCultivationsCatalogue,
            )
            expect(defaults).toEqual({
                b_lu_yield_bruto: 38477,
                b_lu_tarra: 5,
                b_lu_uww: 350,
                b_lu_n_harvestable: 25,
            })
        })

        it("should convert HC042 defaults back to original standardized values", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC042-catalogue",
                mockCultivationsCatalogue,
            )
            const originalCatalogueItem = mockCultivationsCatalogue.find(
                (item) => item.b_lu_catalogue === "HC042-catalogue",
            )!
            const converted = convertHarvestParameters(
                originalCatalogueItem.b_lu_harvestcat,
                undefined,
                defaults.b_lu_yield_bruto,
                undefined,
                defaults.b_lu_tarra,
                undefined,
                defaults.b_lu_uww,
                undefined,
                undefined,
                defaults.b_lu_n_harvestable,
            )
            expect(converted.b_lu_yield).toBe(originalCatalogueItem.b_lu_yield)
            expect(converted.b_lu_n_harvestable).toBe(
                originalCatalogueItem.b_lu_n_harvestable,
            )
        })
    })

    describe("HC050 - Cereals", () => {
        it("should return correct default parameters for HC050", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC050-catalogue",
                mockCultivationsCatalogue,
            )
            expect(defaults).toEqual({
                b_lu_yield_fresh: 8000, // 6800 / (850/1000) rounded
                b_lu_moist: 15, // (1000 - 850) / 10
                b_lu_cp: 114, // 20 * 5.7
            })
        })

        it("should convert HC050 defaults back to original standardized values", () => {
            const defaults = getDefaultsForHarvestParameters(
                "HC050-catalogue",
                mockCultivationsCatalogue,
            )
            const originalCatalogueItem = mockCultivationsCatalogue.find(
                (item) => item.b_lu_catalogue === "HC050-catalogue",
            )!
            const converted = convertHarvestParameters(
                originalCatalogueItem.b_lu_harvestcat,
                undefined,
                undefined,
                defaults.b_lu_yield_fresh,
                undefined,
                defaults.b_lu_moist,
                undefined,
                undefined,
                defaults.b_lu_cp,
                undefined,
            )
            expect(converted.b_lu_yield).toBe(originalCatalogueItem.b_lu_yield)
            expect(converted.b_lu_n_harvestable).toBe(
                originalCatalogueItem.b_lu_n_harvestable,
            )
        })
    })

    it("should return empty object for an unrecognized harvest category (null)", () => {
        const defaults = getDefaultsForHarvestParameters(
            "UNKNOWN-catalogue",
            mockCultivationsCatalogue,
        )
        expect(defaults).toEqual({})
    })
})

describe("getHarvestsForFarm", () => {
    let fdm: FdmServerType
    let principal_id: string
    let b_id_farm: string
    let b_id: string
    let b_id_2: string
    let b_lu: string
    let b_lu_2: string
    let b_lu_catalogue: string
    let b_lu_source: string

    const geometry = {
        type: "Polygon" as const,
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
        b_lu_source = "custom"
        b_lu_catalogue = createId()

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
            new Date("2025-12-31"),
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
            new Date("2025-12-31"),
        )

        await enableCultivationCatalogue(
            fdm,
            principal_id,
            b_id_farm,
            b_lu_source,
        )

        await addCultivationToCatalogue(fdm, {
            b_lu_catalogue,
            b_lu_source,
            b_lu_name: "Wheat",
            b_lu_name_en: "Wheat",
            b_lu_harvestable: "once",
            b_lu_hcat3: "1",
            b_lu_hcat3_name: "test",
            b_lu_croprotation: "cereal",
            b_lu_harvestcat: "HC050",
            b_lu_yield: 6000,
            b_lu_dm: 500,
            b_lu_hi: 0.4,
            b_lu_n_harvestable: 4,
            b_lu_n_residue: 2,
            b_n_fixation: 0,
            b_lu_rest_oravib: false,
            b_lu_variety_options: null,
            b_lu_start_default: "03-01",
            b_lu_eom: null,
            b_lu_eom_residue: null,
            b_date_harvest_default: "09-15",
        })

        b_lu = await addCultivation(
            fdm,
            principal_id,
            b_lu_catalogue,
            b_id,
            new Date("2024-03-01"),
        )

        b_lu_2 = await addCultivation(
            fdm,
            principal_id,
            b_lu_catalogue,
            b_id_2,
            new Date("2024-04-01"),
        )
    })

    it("should return a Map with harvests grouped by cultivation ID", async () => {
        const harvestDate1 = new Date("2024-08-01")
        const harvestDate2 = new Date("2024-09-01")

        await addHarvest(fdm, principal_id, b_lu, harvestDate1, {
            b_lu_yield_fresh: 5000,
            b_lu_moist: 15,
            b_lu_cp: 110,
        })
        await addHarvest(fdm, principal_id, b_lu_2, harvestDate2, {
            b_lu_yield_fresh: 6000,
            b_lu_moist: 15,
            b_lu_cp: 110,
        })

        const result = await getHarvestsForFarm(fdm, principal_id, b_id_farm)

        expect(result).toBeInstanceOf(Map)
        expect(result.has(b_lu)).toBe(true)
        expect(result.has(b_lu_2)).toBe(true)
        expect(result.get(b_lu)).toHaveLength(1)
        expect(result.get(b_lu_2)).toHaveLength(1)
        expect(result.get(b_lu)?.[0].b_lu).toBe(b_lu)
        expect(result.get(b_lu_2)?.[0].b_lu).toBe(b_lu_2)
    })

    it("should include nested harvestable and harvestable_analyses", async () => {
        await addHarvest(fdm, principal_id, b_lu, new Date("2024-08-01"), {
            b_lu_yield_fresh: 5000,
            b_lu_moist: 15,
            b_lu_cp: 110,
        })

        const result = await getHarvestsForFarm(fdm, principal_id, b_id_farm)

        const harvests = result.get(b_lu)!
        expect(harvests).toHaveLength(1)
        expect(harvests[0].harvestable).toBeDefined()
        expect(harvests[0].harvestable.b_id_harvestable).toBeDefined()
        expect(harvests[0].harvestable.harvestable_analyses).toHaveLength(1)
        expect(
            harvests[0].harvestable.harvestable_analyses[0].b_lu_yield_fresh,
        ).toBe(5000)
    })

    it("should return an empty Map when the farm has no harvests", async () => {
        const result = await getHarvestsForFarm(fdm, principal_id, b_id_farm)
        expect(result).toBeInstanceOf(Map)
        expect(result.size).toBe(0)
    })

    it("should only return harvests within the given timeframe", async () => {
        await addHarvest(fdm, principal_id, b_lu, new Date("2024-08-01"), {
            b_lu_yield_fresh: 5000,
            b_lu_moist: 15,
            b_lu_cp: 110,
        })
        await addHarvest(fdm, principal_id, b_lu_2, new Date("2025-08-01"), {
            b_lu_yield_fresh: 6000,
            b_lu_moist: 15,
            b_lu_cp: 110,
        })

        const timeframe = {
            start: new Date("2024-01-01"),
            end: new Date("2024-12-31"),
        }
        const result = await getHarvestsForFarm(
            fdm,
            principal_id,
            b_id_farm,
            timeframe,
        )

        expect(result.has(b_lu)).toBe(true)
        expect(result.has(b_lu_2)).toBe(false)
    })

    it("should not include harvests from other farms", async () => {
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
            new Date("2025-12-31"),
        )
        await enableCultivationCatalogue(
            fdm,
            principal_id,
            other_farm,
            b_lu_source,
        )
        const other_b_lu = await addCultivation(
            fdm,
            principal_id,
            b_lu_catalogue,
            other_b_id,
            new Date("2024-03-01"),
        )

        await addHarvest(
            fdm,
            principal_id,
            other_b_lu,
            new Date("2024-08-01"),
            {
                b_lu_yield_fresh: 9999,
                b_lu_moist: 15,
                b_lu_cp: 110,
            },
        )
        await addHarvest(fdm, principal_id, b_lu, new Date("2024-08-01"), {
            b_lu_yield_fresh: 5000,
            b_lu_moist: 15,
            b_lu_cp: 110,
        })

        const result = await getHarvestsForFarm(fdm, principal_id, b_id_farm)

        expect(result.has(b_lu)).toBe(true)
        expect(result.has(other_b_lu)).toBe(false)
    })

    it("should throw when principal does not have permission", async () => {
        const unauthorized_principal = createId()
        await expect(
            getHarvestsForFarm(fdm, unauthorized_principal, b_id_farm),
        ).rejects.toThrowError(
            "Principal does not have permission to perform this action",
        )
    })
})
