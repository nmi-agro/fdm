import { describe, expect, inject, it, beforeEach } from "vitest"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.types"
import { addField } from "./field"
import { createId } from "./id"
import {
    addSoilImage,
    addSoilImageAnnotation,
    getSoilImages,
    removeSoilImage,
    removeSoilImageAnnotation,
    updateSoilImageAnnotation,
} from "./soil-image"
import { addSoilAnalysis, getSoilAnalysis } from "./soil"
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

describe("Soil Image Functions", () => {
    let fdm: FdmServerType
    let b_id: string
    let b_id_sampling: string
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

        const a_id = await addSoilAnalysis(
            fdm,
            principal_id,
            new Date("2024-06-15"),
            "other",
            b_id,
            30,
            new Date("2024-06-15"),
            {
                a_ss_bcs: 1,
                a_sc_bcs: 2,
                a_rd_bcs: 1,
                a_ew_bcs: 0,
                a_cc_bcs: 2,
                a_gs_bcs: 0,
                a_p_bcs: 1,
                a_c_bcs: 0,
                a_rt_bcs: 0,
            },
        )

        const analysis = await getSoilAnalysis(fdm, principal_id, a_id)
        b_id_sampling = analysis.b_id_sampling!
    })

    describe("BCS scores in soil_analysis", () => {
        it("should store and retrieve BCS scores on soil_analysis", async () => {
            const a_id = await addSoilAnalysis(
                fdm,
                principal_id,
                new Date("2024-07-01"),
                "other",
                b_id,
                30,
                new Date("2024-07-01"),
                {
                    a_ss_bcs: 2,
                    a_sc_bcs: 1,
                    a_rd_bcs: 0,
                },
            )

            const result = await getSoilAnalysis(fdm, principal_id, a_id)
            expect(result.a_ss_bcs).toBe(2)
            expect(result.a_sc_bcs).toBe(1)
            expect(result.a_rd_bcs).toBe(0)
            expect(result.a_ew_bcs).toBeNull()
        })
    })

    describe("addSoilImage", () => {
        it("should add an image linked to a sampling event", async () => {
            const a_id_image = await addSoilImage(fdm, principal_id, b_id_sampling, {
                a_image_path: "farms/test/visual-soil/abc123.jpg",
                a_image_type: "profile",
                a_image_order: 0,
                a_image_caption: "Bodemprofiel",
            })

            expect(a_id_image).toBeDefined()
            expect(typeof a_id_image).toBe("string")
        })

        it("should throw when sampling not found", async () => {
            await expect(
                addSoilImage(fdm, principal_id, "non-existent-sampling", {
                    a_image_path: "farms/test/img.jpg",
                }),
            ).rejects.toThrow()
        })

        it("should throw when principal lacks field write permission", async () => {
            const other_principal = createId()
            await expect(
                addSoilImage(fdm, other_principal, b_id_sampling, {
                    a_image_path: "farms/test/img.jpg",
                }),
            ).rejects.toThrow()
        })

        it("should call onUpload callback with the image path", async () => {
            const uploadedPaths: string[] = []
            const a_id_image = await addSoilImage(
                fdm,
                principal_id,
                b_id_sampling,
                { a_image_path: "farms/test/upload-callback.jpg" },
                async (path) => {
                    uploadedPaths.push(path)
                },
            )

            expect(uploadedPaths).toEqual(["farms/test/upload-callback.jpg"])
            expect(a_id_image).toBeDefined()
        })

        it("should not insert DB record when onUpload throws", async () => {
            await expect(
                addSoilImage(
                    fdm,
                    principal_id,
                    b_id_sampling,
                    { a_image_path: "farms/test/failing-upload.jpg" },
                    async () => {
                        throw new Error("GCS upload failed")
                    },
                ),
            ).rejects.toThrow()

            const images = await getSoilImages(fdm, principal_id, b_id_sampling)
            expect(images).toHaveLength(0)
        })
    })

    describe("getSoilImages", () => {
        it("should return empty array when no images", async () => {
            const images = await getSoilImages(fdm, principal_id, b_id_sampling)
            expect(images).toEqual([])
        })

        it("should return images with annotations", async () => {
            const a_id_image = await addSoilImage(fdm, principal_id, b_id_sampling, {
                a_image_path: "farms/test/visual-soil/abc123.jpg",
                a_image_type: "profile",
                a_image_order: 0,
                a_image_caption: "Bodemprofiel",
            })

            await addSoilImageAnnotation(fdm, principal_id, a_id_image, {
                a_image_annotation_type: "pin",
                a_image_annotation_coordinates: JSON.stringify({ x: 50, y: 50 }),
                a_image_annotation: "Regenworm",
            })

            const images = await getSoilImages(fdm, principal_id, b_id_sampling)
            expect(images).toHaveLength(1)
            expect(images[0].a_image_path).toBe("farms/test/visual-soil/abc123.jpg")
            expect(images[0].a_image_type).toBe("profile")
            expect(images[0].annotations).toHaveLength(1)
            expect(images[0].annotations[0].a_image_annotation).toBe("Regenworm")
        })

        it("should return images sorted by a_image_order", async () => {
            await addSoilImage(fdm, principal_id, b_id_sampling, {
                a_image_path: "farms/test/second.jpg",
                a_image_order: 2,
            })
            await addSoilImage(fdm, principal_id, b_id_sampling, {
                a_image_path: "farms/test/first.jpg",
                a_image_order: 1,
            })

            const images = await getSoilImages(fdm, principal_id, b_id_sampling)
            expect(images[0].a_image_order).toBe(1)
            expect(images[1].a_image_order).toBe(2)
        })
    })

    describe("removeSoilImage", () => {
        it("should remove image and cascade delete annotations", async () => {
            const a_id_image = await addSoilImage(fdm, principal_id, b_id_sampling, {
                a_image_path: "farms/test/toremove.jpg",
            })

            await addSoilImageAnnotation(fdm, principal_id, a_id_image, {
                a_image_annotation_type: "pin",
                a_image_annotation_coordinates: JSON.stringify({ x: 50, y: 50 }),
            })

            await removeSoilImage(fdm, principal_id, a_id_image)

            const images = await getSoilImages(fdm, principal_id, b_id_sampling)
            expect(images).toHaveLength(0)
        })

        it("should call onDelete callback with the image path", async () => {
            const a_id_image = await addSoilImage(fdm, principal_id, b_id_sampling, {
                a_image_path: "farms/test/callback-test.jpg",
            })

            const deletedPaths: string[] = []
            await removeSoilImage(fdm, principal_id, a_id_image, async (path) => {
                deletedPaths.push(path)
            })

            expect(deletedPaths).toEqual(["farms/test/callback-test.jpg"])
            const images = await getSoilImages(fdm, principal_id, b_id_sampling)
            expect(images).toHaveLength(0)
        })

        it("should allow removeSoilImage by any principal in the array", async () => {
            const second_principal = createId()
            const array_principal: string[] = [principal_id, second_principal]

            const a_id_image = await addSoilImage(fdm, array_principal, b_id_sampling, {
                a_image_path: "farms/test/array-principal.jpg",
            })

            expect(a_id_image).toBeDefined()

            // The second principal should also have owner rights and be able to delete
            await expect(
                removeSoilImage(fdm, second_principal, a_id_image),
            ).resolves.not.toThrow()

            const images = await getSoilImages(fdm, principal_id, b_id_sampling)
            expect(images).toHaveLength(0)
        })
    })

    describe("Annotation management", () => {
        let a_id_image: string

        beforeEach(async () => {
            a_id_image = await addSoilImage(fdm, principal_id, b_id_sampling, {
                a_image_path: "farms/test/visual-soil/test.jpg",
            })
        })

        it("should add a pin annotation", async () => {
            const pinData = { x: 45.2, y: 62.8 }
            const a_id_annotation = await addSoilImageAnnotation(
                fdm,
                principal_id,
                a_id_image,
                {
                    a_image_annotation_type: "pin",
                    a_image_annotation_coordinates: pinData,
                    a_image_annotation: "Regenworm gevonden",
                    a_image_annotation_bcs: "a_ew_bcs",
                },
            )

            expect(a_id_annotation).toBeDefined()

            const images = await getSoilImages(fdm, principal_id, b_id_sampling)
            const annotation = images[0].annotations[0]
            expect(annotation.a_image_annotation_type).toBe("pin")
            expect(annotation.a_image_annotation_coordinates).toEqual(pinData)
            expect(annotation.a_image_annotation_bcs).toBe("a_ew_bcs")
        })

        it("should add a freehand annotation", async () => {
            const freehandData = {
                points: [10.2, 30.5, 12.1, 32.0, 14.5, 31.2],
            }
            await addSoilImageAnnotation(fdm, principal_id, a_id_image, {
                a_image_annotation_type: "freehand",
                a_image_annotation_coordinates: freehandData,
            })

            const images = await getSoilImages(fdm, principal_id, b_id_sampling)
            expect(images[0].annotations[0].a_image_annotation_type).toBe("freehand")
        })

        it("should update an annotation", async () => {
            const a_id_annotation = await addSoilImageAnnotation(
                fdm,
                principal_id,
                a_id_image,
                {
                    a_image_annotation_type: "pin",
                    a_image_annotation_coordinates: { x: 10, y: 20 },
                    a_image_annotation: "Oud",
                },
            )

            await updateSoilImageAnnotation(fdm, principal_id, a_id_annotation, {
                a_image_annotation: "Nieuw",
                a_image_annotation_coordinates: { x: 50, y: 60 },
            })

            const images = await getSoilImages(fdm, principal_id, b_id_sampling)
            expect(images[0].annotations[0].a_image_annotation).toBe("Nieuw")
        })

        it("should remove an annotation", async () => {
            const a_id_annotation = await addSoilImageAnnotation(
                fdm,
                principal_id,
                a_id_image,
                {
                    a_image_annotation_type: "circle",
                    a_image_annotation_coordinates: JSON.stringify({ cx: 50, cy: 50, radiusPercent: 10 }),
                },
            )

            await removeSoilImageAnnotation(fdm, principal_id, a_id_annotation)

            const images = await getSoilImages(fdm, principal_id, b_id_sampling)
            expect(images[0].annotations).toHaveLength(0)
        })
    })
})
