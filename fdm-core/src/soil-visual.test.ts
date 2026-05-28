import { describe, expect, inject, it, beforeEach } from "vitest"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.types"
import { addField } from "./field"
import { createId } from "./id"
import {
    addImageAnnotation,
    addVisualSoilAnalysis,
    addVisualSoilImage,
    getVisualSoilAnalysis,
    getVisualSoilAnalyses,
    removeImageAnnotation,
    removeVisualSoilAnalysis,
    removeVisualSoilImage,
    updateImageAnnotation,
    updateVisualSoilAnalysis,
} from "./soil-visual"
import type * as schema from "./db/schema"

type Polygon = schema.fieldsTypeInsert["b_geometry"]

const testGeometry: Polygon = {
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

describe("Visual Soil Analysis Functions", () => {
    let fdm: FdmServerType
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
        const b_id_farm = await addFarm(
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
            "Test Field",
            "test-field-id",
            testGeometry,
            new Date("2023-01-01"),
            "nl_01",
            new Date("2023-12-31"),
        )
    })

    describe("addVisualSoilAnalysis", () => {
        it("should create a visual soil analysis with sampling record", async () => {
            const a_id_visual = await addVisualSoilAnalysis(fdm, principal_id, {
                b_id,
                date: new Date("2024-06-15"),
                assessor_name: "Jan de Vries",
                assessment_type: "kuilmeting",
                a_ss_bcs: 1,
                a_sc_bcs: 2,
                a_rd_bcs: 1,
                a_ew_bcs: 0,
                a_cc_bcs: 2,
                a_gs_bcs: 0,
                a_p_bcs: 1,
                a_c_bcs: 0,
                a_rt_bcs: 0,
                notes: "Goede bodemstructuur",
                weather_conditions: "Droog",
            })

            expect(a_id_visual).toBeDefined()
            expect(typeof a_id_visual).toBe("string")
        })

        it("should throw when principal lacks field write permission", async () => {
            const other_principal = createId()
            await expect(
                addVisualSoilAnalysis(fdm, other_principal, { b_id }),
            ).rejects.toThrow()
        })
    })

    describe("getVisualSoilAnalysis", () => {
        it("should retrieve a visual soil analysis with empty images array", async () => {
            const a_id_visual = await addVisualSoilAnalysis(fdm, principal_id, {
                b_id,
                date: new Date("2024-06-15"),
                assessor_name: "Jan de Vries",
                a_ss_bcs: 1,
                a_sc_bcs: 2,
            })

            const result = await getVisualSoilAnalysis(
                fdm,
                principal_id,
                a_id_visual,
            )

            expect(result).toBeDefined()
            expect(result!.a_id_visual).toBe(a_id_visual)
            expect(result!.b_id).toBe(b_id)
            expect(result!.assessor_name).toBe("Jan de Vries")
            expect(result!.a_ss_bcs).toBe(1)
            expect(result!.a_sc_bcs).toBe(2)
            expect(result!.images).toEqual([])
        })

        it("should return undefined for non-existent id", async () => {
            const result = await getVisualSoilAnalysis(
                fdm,
                principal_id,
                "non-existent-id",
            ).catch(() => undefined)
            expect(result).toBeUndefined()
        })
    })

    describe("getVisualSoilAnalyses", () => {
        it("should list all visual assessments for a field", async () => {
            await addVisualSoilAnalysis(fdm, principal_id, {
                b_id,
                date: new Date("2024-01-01"),
                assessor_name: "Jan",
            })
            await addVisualSoilAnalysis(fdm, principal_id, {
                b_id,
                date: new Date("2024-06-01"),
                assessor_name: "Piet",
            })

            const results = await getVisualSoilAnalyses(fdm, principal_id, b_id)
            expect(results.length).toBeGreaterThanOrEqual(2)
        })

        it("should return empty array for field with no visual assessments", async () => {
            const results = await getVisualSoilAnalyses(fdm, principal_id, b_id)
            expect(results).toEqual([])
        })
    })

    describe("updateVisualSoilAnalysis", () => {
        it("should update scores and metadata", async () => {
            const a_id_visual = await addVisualSoilAnalysis(fdm, principal_id, {
                b_id,
                a_ss_bcs: 0,
                assessor_name: "Oud",
            })

            await updateVisualSoilAnalysis(fdm, principal_id, a_id_visual, {
                a_ss_bcs: 2,
                assessor_name: "Nieuw",
                d_bcs: 10,
                i_bcs: 0.5,
            })

            const result = await getVisualSoilAnalysis(
                fdm,
                principal_id,
                a_id_visual,
            )
            expect(result!.a_ss_bcs).toBe(2)
            expect(result!.assessor_name).toBe("Nieuw")
            expect(result!.d_bcs).toBe(10)
            expect(result!.i_bcs).toBe(0.5)
        })
    })

    describe("removeVisualSoilAnalysis", () => {
        it("should remove the visual analysis and its sampling record", async () => {
            const a_id_visual = await addVisualSoilAnalysis(fdm, principal_id, {
                b_id,
            })

            await removeVisualSoilAnalysis(fdm, principal_id, a_id_visual)

            const result = await getVisualSoilAnalysis(
                fdm,
                principal_id,
                a_id_visual,
            ).catch(() => undefined)
            expect(result).toBeUndefined()
        })
    })

    describe("Image management", () => {
        let a_id_visual: string

        beforeEach(async () => {
            a_id_visual = await addVisualSoilAnalysis(fdm, principal_id, {
                b_id,
            })
        })

        it("should add an image to a visual analysis", async () => {
            const a_id_image = await addVisualSoilImage(
                fdm,
                principal_id,
                a_id_visual,
                {
                    gcs_object_key: "farms/test/visual-soil/abc123.jpg",
                    image_type: "profile",
                    sort_order: 0,
                    caption: "Bodemprofiel",
                },
            )

            expect(a_id_image).toBeDefined()

            const result = await getVisualSoilAnalysis(
                fdm,
                principal_id,
                a_id_visual,
            )
            expect(result!.images).toHaveLength(1)
            expect(result!.images[0].gcs_object_key).toBe(
                "farms/test/visual-soil/abc123.jpg",
            )
            expect(result!.images[0].image_type).toBe("profile")
        })

        it("should remove an image and its annotations cascade", async () => {
            const a_id_image = await addVisualSoilImage(
                fdm,
                principal_id,
                a_id_visual,
                { gcs_object_key: "farms/test/visual-soil/toremove.jpg" },
            )

            await addImageAnnotation(fdm, principal_id, a_id_image, {
                type: "pin",
                data_json: JSON.stringify({ x: 50, y: 50 }),
                text: "Regenworm",
            })

            await removeVisualSoilImage(fdm, principal_id, a_id_image)

            const result = await getVisualSoilAnalysis(
                fdm,
                principal_id,
                a_id_visual,
            )
            expect(result!.images).toHaveLength(0)
        })
    })

    describe("Annotation management", () => {
        let a_id_visual: string
        let a_id_image: string

        beforeEach(async () => {
            a_id_visual = await addVisualSoilAnalysis(fdm, principal_id, {
                b_id,
            })
            a_id_image = await addVisualSoilImage(
                fdm,
                principal_id,
                a_id_visual,
                { gcs_object_key: "farms/test/visual-soil/test.jpg" },
            )
        })

        it("should add a pin annotation", async () => {
            const pinData = JSON.stringify({ x: 45.2, y: 62.8 })
            const a_id_annotation = await addImageAnnotation(
                fdm,
                principal_id,
                a_id_image,
                {
                    type: "pin",
                    data_json: pinData,
                    text: "Regenworm gevonden",
                    indicator: "A_EW_BCS",
                },
            )

            expect(a_id_annotation).toBeDefined()

            const result = await getVisualSoilAnalysis(
                fdm,
                principal_id,
                a_id_visual,
            )
            const annotation = result!.images[0].annotations[0]
            expect(annotation.type).toBe("pin")
            expect(annotation.data_json).toBe(pinData)
            expect(annotation.indicator).toBe("A_EW_BCS")
        })

        it("should add a freehand annotation", async () => {
            const freehandData = JSON.stringify({
                points: [10.2, 30.5, 12.1, 32.0, 14.5, 31.2],
            })
            await addImageAnnotation(fdm, principal_id, a_id_image, {
                type: "freehand",
                data_json: freehandData,
            })

            const result = await getVisualSoilAnalysis(
                fdm,
                principal_id,
                a_id_visual,
            )
            expect(result!.images[0].annotations[0].type).toBe("freehand")
        })

        it("should update an annotation", async () => {
            const a_id_annotation = await addImageAnnotation(
                fdm,
                principal_id,
                a_id_image,
                {
                    type: "pin",
                    data_json: JSON.stringify({ x: 10, y: 20 }),
                    text: "Oud",
                },
            )

            await updateImageAnnotation(fdm, principal_id, a_id_annotation, {
                text: "Nieuw",
                data_json: JSON.stringify({ x: 50, y: 60 }),
            })

            const result = await getVisualSoilAnalysis(
                fdm,
                principal_id,
                a_id_visual,
            )
            expect(result!.images[0].annotations[0].text).toBe("Nieuw")
        })

        it("should remove an annotation", async () => {
            const a_id_annotation = await addImageAnnotation(
                fdm,
                principal_id,
                a_id_image,
                {
                    type: "circle",
                    data_json: JSON.stringify({ cx: 50, cy: 50, radiusPercent: 10 }),
                },
            )

            await removeImageAnnotation(fdm, principal_id, a_id_annotation)

            const result = await getVisualSoilAnalysis(
                fdm,
                principal_id,
                a_id_visual,
            )
            expect(result!.images[0].annotations).toHaveLength(0)
        })
    })
})
