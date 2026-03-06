import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, inject, it } from "vitest"
import { enableCultivationCatalogue } from "./catalogues"
import { addCultivation, addCultivationToCatalogue } from "./cultivation"
import * as schema from "./db/schema"
import { addFarm } from "./farm"
import type { FdmType } from "./fdm"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.d"
import {
    addField,
    determineIfFieldIsBuffer,
    getField,
    getFields,
    listAvailableAcquiringMethods,
    removeField,
    updateField,
} from "./field"
import { addHarvest } from "./harvest"
import { createId } from "./id"
import { addSoilAnalysis } from "./soil"

type Polygon = schema.fieldsTypeInsert["b_geometry"]

describe("Farm Data Model", () => {
    let fdm: FdmServerType
    let principal_id: string

    beforeEach(async () => {
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        fdm = createFdmServer(host, port, user, password, database)
        principal_id = createId()
    })

    describe("Field CRUD", () => {
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
            const farmName = "Test Farm"
            const farmBusinessId = "123456"
            const farmAddress = "123 Farm Lane"
            const farmPostalCode = "12345"
            b_id_farm = await addFarm(
                fdm,
                principal_id,
                farmName,
                farmBusinessId,
                farmAddress,
                farmPostalCode,
            )
        })

        it("should add a new field", async () => {
            const fieldName = "Test Field"
            const fieldIDSource = "test-field-id"
            const fieldGeometry: Polygon = {
                type: "Polygon" as const,
                coordinates: [
                    [
                        [0, 0],
                        [0, 1],
                        [1, 1],
                        [1, 0],
                        [0, 0],
                    ],
                ],
            }
            const AcquireDate = new Date("2023-01-01")
            const discardingDate = new Date("2023-12-31")
            const AcquiringMethod = "nl_01"
            const b_id = await addField(
                fdm,
                principal_id,
                b_id_farm,
                fieldName,
                fieldIDSource,
                fieldGeometry,
                AcquireDate,
                AcquiringMethod,
                discardingDate,
            )
            expect(b_id).toBeDefined()

            const field = await getField(fdm, principal_id, b_id)
            expect(field.b_name).toBe(fieldName)
            expect(field.b_id_farm).toBe(b_id_farm)
            expect(field.b_id_source).toBe(fieldIDSource)
            expect(field.b_geometry).toStrictEqual(fieldGeometry)
            expect(field.b_centroid).toHaveLength(2)
            expect(field.b_centroid[0]).toBeTypeOf("number")
            expect(field.b_centroid[1]).toBeTypeOf("number")
            expect(field.b_area).toBeGreaterThan(0)
            expect(field.b_perimeter).toBeGreaterThan(0)
            expect(field.b_bufferstrip).toBe(false)
            expect(field.b_start).toEqual(AcquireDate)
            expect(field.b_end).toEqual(discardingDate)
            expect(field.b_acquiring_method).toBe(AcquiringMethod)
        })

        it("should add a new field with a later added option for b_acquiring_method", async () => {
            const fieldName = "Test Field"
            const fieldIDSource = "test-field-id"
            const fieldGeometry: Polygon = {
                type: "Polygon" as const,
                coordinates: [
                    [
                        [0, 0],
                        [0, 1],
                        [1, 1],
                        [1, 0],
                        [0, 0],
                    ],
                ],
            }
            const AcquireDate = new Date("2023-01-01")
            const discardingDate = new Date("2023-12-31")
            const AcquiringMethod = "nl_11"
            const b_id = await addField(
                fdm,
                principal_id,
                b_id_farm,
                fieldName,
                fieldIDSource,
                fieldGeometry,
                AcquireDate,
                AcquiringMethod,
                discardingDate,
            )
            expect(b_id).toBeDefined()

            const field = await getField(fdm, principal_id, b_id)
            expect(field.b_acquiring_method).toBe(AcquiringMethod)
        })

        describe("getFields", () => {
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
                const farmName = "Test Farm"
                const farmBusinessId = "123456"
                const farmAddress = "123 Farm Lane"
                const farmPostalCode = "12345"
                b_id_farm = await addFarm(
                    fdm,
                    principal_id,
                    farmName,
                    farmBusinessId,
                    farmAddress,
                    farmPostalCode,
                )
            })
            it("should get fields by farm ID", async () => {
                // Add two fields to the farm
                const field1Name = "Field 1"
                const field1Source = "source1"
                const field1Geometry = {
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
                const field1Start = new Date("2023-01-01")
                const field1AcquiringMethod = "nl_01"
                await addField(
                    fdm,
                    principal_id,
                    b_id_farm,
                    field1Name,
                    field1Source,
                    field1Geometry,
                    field1Start,
                    field1AcquiringMethod,
                )

                const field2Name = "Field 2"
                const field2Source = "source2"
                const field2Geometry = {
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
                const field2Start = new Date("2023-02-01")
                const field2AcquiringMethod = "nl_02"
                await addField(
                    fdm,
                    principal_id,
                    b_id_farm,
                    field2Name,
                    field2Source,
                    field2Geometry,
                    field2Start,
                    field2AcquiringMethod,
                )

                const fields = await getFields(fdm, principal_id, b_id_farm)
                expect(fields.length).toBe(2)
                expect(fields.map((f) => f.b_name)).toEqual(
                    expect.arrayContaining([field1Name, field2Name]),
                )
                for (const field of fields) {
                    expect(field.b_perimeter).toBeGreaterThan(0)
                    expect(field.b_bufferstrip).toBe(false)
                }
            })

            it("should throw an error when permission check fails", async () => {
                const invalidPrincipalId = "invalid_principal"
                await expect(
                    getFields(fdm, invalidPrincipalId, b_id_farm),
                ).rejects.toThrowError(
                    "Principal does not have permission to perform this action",
                )
            })

            it("should get fields within a timeframe", async () => {
                // Add two fields to the farm with different start dates
                const field1Name = "Field 1"
                const field1Source = "source1"
                const field1Geometry = {
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
                const field1Start = new Date("2022-01-01")
                const field1End = new Date("2022-05-01")
                const field1AcquiringMethod = "nl_01"
                await addField(
                    fdm,
                    principal_id,
                    b_id_farm,
                    field1Name,
                    field1Source,
                    field1Geometry,
                    field1Start,
                    field1AcquiringMethod,
                    field1End,
                )

                const field2Name = "Field 2"
                const field2Source = "source2"
                const field2Geometry = {
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
                const field2Start = new Date("2023-02-01")
                const field2AcquiringMethod = "nl_02"
                await addField(
                    fdm,
                    principal_id,
                    b_id_farm,
                    field2Name,
                    field2Source,
                    field2Geometry,
                    field2Start,
                    field2AcquiringMethod,
                )
                const field3Name = "Field 3"
                const field3Source = "source3"
                const field3Geometry = {
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
                const field3Start = new Date("2023-06-01")
                const field3End = new Date("2023-08-01")
                const field3AcquiringMethod = "nl_02"
                await addField(
                    fdm,
                    principal_id,
                    b_id_farm,
                    field3Name,
                    field3Source,
                    field3Geometry,
                    field3Start,
                    field3AcquiringMethod,
                    field3End,
                )
                const field4Name = "Field 4"
                const field4Source = "source4"
                const field4Geometry = {
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
                const field4Start = new Date("2024-07-01")
                const field4End = new Date("2024-09-01")
                const field4AcquiringMethod = "nl_02"
                await addField(
                    fdm,
                    principal_id,
                    b_id_farm,
                    field4Name,
                    field4Source,
                    field4Geometry,
                    field4Start,
                    field4AcquiringMethod,
                    field4End,
                )

                // Test with a timeframe that includes Field 2
                const timeframe1 = {
                    start: new Date("2023-03-01"),
                    end: new Date("2023-05-01"),
                }
                const fields1 = await getFields(
                    fdm,
                    principal_id,
                    b_id_farm,
                    timeframe1,
                )
                expect(fields1.length).toBe(1)
                expect(fields1[0].b_name).toBe(field2Name)
                expect(fields1[0].b_perimeter).toBeGreaterThan(0)
                expect(fields1[0].b_bufferstrip).toBe(false)

                // Test with a timeframe that includes both Field 1 and Field 2
                const timeframe2 = {
                    start: new Date("2022-01-01"),
                    end: new Date("2023-05-01"),
                }
                const fields2 = await getFields(
                    fdm,
                    principal_id,
                    b_id_farm,
                    timeframe2,
                )
                expect(fields2.length).toBe(2)
                expect(fields2.map((f) => f.b_name)).toEqual(
                    expect.arrayContaining([field1Name, field2Name]),
                )
                for (const field of fields2) {
                    expect(field.b_perimeter).toBeGreaterThan(0)
                    expect(field.b_bufferstrip).toBe(false)
                }

                // Test with a timeframe that includes field 2 and field 3
                const timeframe3 = {
                    start: new Date("2023-05-01"),
                    end: new Date("2023-09-01"),
                }

                const fields3 = await getFields(
                    fdm,
                    principal_id,
                    b_id_farm,
                    timeframe3,
                )
                expect(fields3.length).toBe(2)
                expect(fields3.map((f) => f.b_name)).toEqual(
                    expect.arrayContaining([field2Name, field3Name]),
                )
                for (const field of fields3) {
                    expect(field.b_perimeter).toBeGreaterThan(0)
                    expect(field.b_bufferstrip).toBe(false)
                }
                //Test with only start date
                const fields4 = await getFields(fdm, principal_id, b_id_farm, {
                    start: new Date("2023-03-01"),
                    end: undefined,
                })

                expect(fields4.length).toBe(3)
                expect(fields4.map((f) => f.b_name)).toEqual(
                    expect.arrayContaining([
                        field2Name,
                        field3Name,
                        field4Name,
                    ]),
                )
                for (const field of fields4) {
                    expect(field.b_perimeter).toBeGreaterThan(0)
                    expect(field.b_bufferstrip).toBe(false)
                }
                //Test with only end date
                const fields5 = await getFields(fdm, principal_id, b_id_farm, {
                    start: undefined,
                    end: new Date("2023-05-01"),
                })
                expect(fields5.length).toBe(2)
                expect(fields5.map((f) => f.b_name)).toEqual(
                    expect.arrayContaining([field1Name, field2Name]),
                )
                for (const field of fields5) {
                    expect(field.b_perimeter).toBeGreaterThan(0)
                    expect(field.b_bufferstrip).toBe(false)
                }
            })
        })
        it("should update a field", async () => {
            const farmName = "Test Farm"
            const farmBusinessId = "123456"
            const farmAddress = "123 Farm Lane"
            const farmPostalCode = "12345"
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
                type: "Polygon" as const,
                coordinates: [
                    [
                        [0, 0],
                        [0, 1],
                        [1, 1],
                        [1, 0],
                        [0, 0],
                    ],
                ],
            }
            const AcquireDate = new Date("2023-01-01")
            const discardingDate = new Date("2023-12-31")
            const AcquiringMethod = "nl_01"
            const b_id = await addField(
                fdm,
                principal_id,
                b_id_farm,
                fieldName,
                fieldIDSource,
                fieldGeometry,
                AcquireDate,
                AcquiringMethod,
                discardingDate,
            )

            const updatedFieldName = "Updated Test Field"
            const updatedFieldIDSource = "updated-test-field-id"
            const updatedFieldGeometry: Polygon = {
                type: "Polygon" as const,
                coordinates: [
                    [
                        [30, 10],
                        [40, 40],
                        [20, 40],
                        [10, 20],
                        [35, 10],
                    ],
                ],
            }
            const updatedAcquireDate = new Date("2024-01-01")
            const updatedDiscardingDate = new Date("2024-12-31")
            const updatedAcquiringMethod = "nl_02"
            const updatedField = await updateField(
                fdm,
                principal_id,
                b_id,
                updatedFieldName,
                updatedFieldIDSource,
                updatedFieldGeometry,
                updatedAcquireDate,
                updatedAcquiringMethod,
                updatedDiscardingDate,
            )
            expect(updatedField.b_name).toBe(updatedFieldName)
            expect(updatedField.b_id_source).toBe(updatedFieldIDSource)
            expect(updatedField.b_geometry).toStrictEqual(updatedFieldGeometry)
            expect(updatedField.b_start).toEqual(updatedAcquireDate)
            expect(updatedField.b_end).toEqual(updatedDiscardingDate)
            expect(updatedField.b_acquiring_method).toBe(updatedAcquiringMethod)
        })

        it("should update a field partially", async () => {
            const farmName = "Test Farm"
            const farmBusinessId = "123456"
            const farmAddress = "123 Farm Lane"
            const farmPostalCode = "12345"
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
                type: "Polygon" as const,
                coordinates: [
                    [
                        [0, 0],
                        [0, 1],
                        [1, 1],
                        [1, 0],
                        [0, 0],
                    ],
                ],
            }
            const AcquireDate = new Date("2023-01-01")
            const discardingDate = new Date("2023-12-31")
            const AcquiringMethod = "nl_01"
            const b_id = await addField(
                fdm,
                principal_id,
                b_id_farm,
                fieldName,
                fieldIDSource,
                fieldGeometry,
                AcquireDate,
                AcquiringMethod,
                discardingDate,
            )

            // Update only the name
            const updatedFieldName = "Updated Test Field"
            const updatedField = await updateField(
                fdm,
                principal_id,
                b_id,
                updatedFieldName,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
            )

            expect(updatedField.b_name).toBe(updatedFieldName)
            expect(updatedField.b_id_source).toBe(fieldIDSource) // Should remain the same
            expect(updatedField.b_geometry).toStrictEqual(fieldGeometry) // Should remain the same
            expect(updatedField.b_start).toEqual(AcquireDate) // Should remain the same
            expect(updatedField.b_end).toEqual(discardingDate) // Should remain the same
            expect(updatedField.b_acquiring_method).toBe(AcquiringMethod) // Should remain the same

            // Update only the manage type
            const updatedAcquiringMethod = "nl_02"
            const updatedField2 = await updateField(
                fdm,
                principal_id,
                b_id,
                undefined,
                undefined,
                undefined,
                undefined,
                updatedAcquiringMethod,
                undefined,
            )
            expect(updatedField2.b_name).toBe(updatedFieldName) // Should remain the same
            expect(updatedField2.b_id_source).toBe(fieldIDSource) // Should remain the same
            expect(updatedField2.b_geometry).toStrictEqual(fieldGeometry) // Should remain the same
            expect(updatedField2.b_start).toEqual(AcquireDate) // Should remain the same
            expect(updatedField2.b_end).toEqual(discardingDate) // Should remain the same
            expect(updatedField2.b_acquiring_method).toBe(
                updatedAcquiringMethod,
            ) // Should be updated

            //Partial updates for `fields` table
            const updatedFieldIDSource = "updated-test-field-id"
            const updatedField3 = await updateField(
                fdm,
                principal_id,
                b_id,
                undefined,
                updatedFieldIDSource,
                undefined,
                undefined,
                undefined,
                undefined,
            )
            expect(updatedField3.b_name).toBe(updatedFieldName) // Should remain the same
            expect(updatedField3.b_id_source).toBe(updatedFieldIDSource) // Should be updated
            expect(updatedField3.b_geometry).toStrictEqual(fieldGeometry) // Should remain the same
            expect(updatedField3.b_start).toEqual(AcquireDate) // Should remain the same
            expect(updatedField3.b_end).toEqual(discardingDate) // Should remain the same
            expect(updatedField3.b_acquiring_method).toBe(
                updatedAcquiringMethod,
            ) // Should remain the same

            // Partial updates for `farmManaging` table
            const updatedAcquireDate = new Date("2023-02-01")
            const updatedField4 = await updateField(
                fdm,
                principal_id,
                b_id,
                undefined,
                undefined,
                undefined,
                updatedAcquireDate,
                undefined,
                undefined,
            )
            expect(updatedField4.b_name).toBe(updatedFieldName) // Should remain the same
            expect(updatedField4.b_id_source).toBe(updatedFieldIDSource) // Should remain the same
            expect(updatedField4.b_geometry).toStrictEqual(fieldGeometry) // Should remain the same
            expect(updatedField4.b_start).toEqual(updatedAcquireDate) // Should be updated
            expect(updatedField4.b_end).toEqual(discardingDate) // Should remain the same
            expect(updatedField4.b_acquiring_method).toBe(
                updatedAcquiringMethod,
            ) // Should remain the same
        })

        it("should calculate perimeter correctly for a polygon with a hole", async () => {
            const farmName = "Test Farm with Hole"
            const farmBusinessId = "789012"
            const farmAddress = "456 Hole Lane"
            const farmPostalCode = "67890"
            const b_id_farm = await addFarm(
                fdm,
                principal_id,
                farmName,
                farmBusinessId,
                farmAddress,
                farmPostalCode,
            )

            const fieldName = "Field with Hole"
            const fieldIDSource = "test-field-id-hole"
            const fieldGeometry: Polygon = {
                type: "Polygon" as const,
                coordinates: [
                    // Outer ring
                    [
                        [0, 0],
                        [0, 10],
                        [10, 10],
                        [10, 0],
                        [0, 0],
                    ],
                    // Inner ring (hole)
                    [
                        [2, 2],
                        [2, 8],
                        [8, 8],
                        [8, 2],
                        [2, 2],
                    ],
                ],
            }
            const AcquireDate = new Date("2023-01-01")
            const discardingDate = new Date("2023-12-31")
            const AcquiringMethod = "nl_01"
            const b_id = await addField(
                fdm,
                principal_id,
                b_id_farm,
                fieldName,
                fieldIDSource,
                fieldGeometry,
                AcquireDate,
                AcquiringMethod,
                discardingDate,
            )
            expect(b_id).toBeDefined()

            const field = await getField(fdm, principal_id, b_id)
            expect(field.b_name).toBe(fieldName)
            expect(field.b_perimeter).toBeGreaterThan(0)
            expect(field.b_perimeter).toBeGreaterThan(4000000)
            expect(field.b_bufferstrip).toBe(false)
        })
    })

    describe("removeField", () => {
        const b_lu_source = "custom"
        let b_lu_catalogue: string
        let farmId: string

        beforeEach(async () => {
            // 1. Setup: Create a farm, enable catalogue and add cultivation to catalogue
            farmId = await addFarm(
                fdm,
                principal_id,
                "Test Farm",
                "123",
                "Address",
                "12345",
            )

            await enableCultivationCatalogue(
                fdm,
                principal_id,
                farmId,
                b_lu_source,
            )
            // Ensure catalogue entry exists before each test
            b_lu_catalogue = createId()
            await addCultivationToCatalogue(fdm, {
                b_lu_catalogue,
                b_lu_source: b_lu_source,
                b_lu_name: "test-name",
                b_lu_name_en: "test-name-en",
                b_lu_harvestable: "once",
                b_lu_hcat3: "test-hcat3",
                b_lu_hcat3_name: "test-hcat3-name",
                b_lu_croprotation: "cereal",
                b_lu_harvestcat: "HC010",
                b_lu_dm: 500,
                b_lu_eom: null,
                b_lu_eom_residues: null,
                b_lu_yield: 6000,
                b_lu_hi: 0.4,
                b_lu_n_harvestable: 4,
                b_lu_n_residue: 2,
                b_n_fixation: 0,
                b_lu_rest_oravib: false, // Changed to boolean
                b_lu_variety_options: [], // Added missing property
                b_lu_start_default: "03-15",
                b_date_harvest_default: "10-15",
            })
        })

        it("should remove a field and all its associated data", async () => {
            const fieldId = await addField(
                fdm,
                principal_id,
                farmId,
                "Test Field",
                "source1",
                {
                    type: "Polygon" as const,
                    coordinates: [
                        [
                            [-1, -1],
                            [-1, 1],
                            [1, 1],
                            [1, -1],
                            [-1, -1],
                        ],
                    ],
                },
                new Date(),
                "nl_01",
            )

            const cultivationId = await addCultivation(
                fdm,
                principal_id,
                b_lu_catalogue,
                fieldId,
                new Date("2025-03-01"),
            )
            const soilAnalysisId = await addSoilAnalysis(
                fdm,
                principal_id,
                null,
                "other",
                fieldId,
                30,
                new Date("2025-01-20"),
                { a_som_loi: 4 },
                0,
            )

            // 2. Action: Remove the field
            await removeField(fdm, principal_id, fieldId)

            // 3. Assertion: Verify that the field and all associated data are deleted
            await expect(getField(fdm, principal_id, fieldId)).rejects.toThrow()

            const remainingCultivations = await fdm
                .select()
                .from(schema.cultivations)
                .where(eq(schema.cultivations.b_lu, cultivationId))
            expect(remainingCultivations.length).toBe(0)

            const remainingSoilAnalyses = await fdm
                .select()
                .from(schema.soilAnalysis)
                .where(eq(schema.soilAnalysis.a_id, soilAnalysisId))
            expect(remainingSoilAnalyses.length).toBe(0)
        })

        it("should not remove a field if the principal does not have write permission", async () => {
            // 1. Setup: Create a field
            const fieldId = await addField(
                fdm,
                principal_id,
                farmId,
                "Test Field",
                "source1",
                {
                    type: "Polygon" as const,
                    coordinates: [
                        [
                            [-1, -1],
                            [-1, 1],
                            [1, 1],
                            [1, -1],
                            [-1, -1],
                        ],
                    ],
                },
                new Date(),
                "nl_01",
            )

            // 2. Action and Assertion: Attempt to remove the field with an unauthorized principal
            const unauthorized_principal_id = createId()
            await expect(
                removeField(fdm, unauthorized_principal_id, fieldId),
            ).rejects.toThrow(
                "Principal does not have permission to perform this action",
            )

            // Verify that the field still exists
            const field = await getField(fdm, principal_id, fieldId)
            expect(field).toBeDefined()
        })

        it("should throw an error when trying to remove a non-existent field", async () => {
            const nonExistentFieldId = createId()
            await expect(
                removeField(fdm, principal_id, nonExistentFieldId),
            ).rejects.toThrow()
        })

        it("should successfully remove a field with no associated data", async () => {
            const fieldId = await addField(
                fdm,
                principal_id,
                farmId,
                "Test Field",
                "source1",
                {
                    type: "Polygon" as const,
                    coordinates: [
                        [
                            [-1, -1],
                            [-1, 1],
                            [1, 1],
                            [1, -1],
                            [-1, -1],
                        ],
                    ],
                },
                new Date(),
                "nl_01",
            )

            await removeField(fdm, principal_id, fieldId)

            await expect(getField(fdm, principal_id, fieldId)).rejects.toThrow()
        })

        it("should test deeper cascading relationships", async () => {
            const fieldId = await addField(
                fdm,
                principal_id,
                farmId,
                "Test Field",
                "source1",
                {
                    type: "Polygon" as const,
                    coordinates: [
                        [
                            [-1, -1],
                            [-1, 1],
                            [1, 1],
                            [1, -1],
                            [-1, -1],
                        ],
                    ],
                },
                new Date(),
                "nl_01",
            )

            const cultivationId = await addCultivation(
                fdm,
                principal_id,
                b_lu_catalogue,
                fieldId,
                new Date("2025-03-01"),
            )
            const harvestId = await addHarvest(
                fdm,
                principal_id,
                cultivationId,
                new Date("2025-08-10"),
                {
                    b_lu_yield_fresh: 5000,
                    b_lu_dm: 500,
                    b_lu_n_harvestable: 20,
                },
            )

            await removeField(fdm, principal_id, fieldId)

            await expect(getField(fdm, principal_id, fieldId)).rejects.toThrow()
            const remainingHarvests = await fdm
                .select()
                .from(schema.harvestables)
                .where(eq(schema.harvestables.b_id_harvestable, harvestId))
            expect(remainingHarvests.length).toBe(0)
        })
    })

    describe("determineIfFieldIsBuffer", () => {
        it("should determine if a field is buffer by checking name", async () => {
            const isBuffer = determineIfFieldIsBuffer(1.0, 100.0, "Bufferstrip")
            expect(isBuffer).toBe(true)
        })
        it("should determine if a field is buffer by checking shape", async () => {
            const isBuffer = determineIfFieldIsBuffer(1.0, 10000.0, "Field")
            expect(isBuffer).toBe(true)
        })

        it("should determine if a field is productive (not buffer) by checking shape (area is large enough)", async () => {
            const isBuffer = determineIfFieldIsBuffer(2.5, 10000.0, "Field")
            expect(isBuffer).toBe(false)
        })
        it("should determine if a field is buffer by checking shape and name", async () => {
            const isBuffer = determineIfFieldIsBuffer(
                1.0,
                1000.0,
                "Bufferstrip",
            )
            expect(isBuffer).toBe(true)
        })
        it("should determine if a field is buffer by checking shape and name (productive)", async () => {
            const isBuffer = determineIfFieldIsBuffer(10.0, 100.0, "Field")
            expect(isBuffer).toBe(false)
        })
    })

    describe("listAvailableAcquiringMethods", () => {
        it("should list available acquiring methods", () => {
            const methods = listAvailableAcquiringMethods()
            expect(methods).toBeInstanceOf(Array)
            expect(methods.length).toBeGreaterThan(0)
            expect(methods[0]).toHaveProperty("value")
            expect(methods[0]).toHaveProperty("label")
            expect(methods.some((m) => m.value === "nl_01")).toBe(true)
            expect(methods.some((m) => m.value === "nl_02")).toBe(true)
        })
    })
})
