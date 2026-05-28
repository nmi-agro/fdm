import { and, eq, isNull } from "drizzle-orm"
import { checkPermission, grantRole } from "./authorization"
import type { PrincipalId } from "./authorization.types"
import * as schema from "./db/schema"
import * as authZSchema from "./db/schema-authz"
import { handleError } from "./error"
import type { FdmType } from "./fdm.types"
import { createId } from "./id"
import type {
    AddImageAnnotationInput,
    AddVisualSoilAnalysisInput,
    AddVisualSoilImageInput,
    UpdateImageAnnotationInput,
    UpdateVisualSoilAnalysisInput,
    VisualSoilAssessment,
    VisualSoilImage,
} from "./soil-visual.types"

/**
 * Adds a new visual soil analysis assessment.
 *
 * Creates a new `soil_sampling_visual` record and a linked `soil_analysis_visual` record
 * in a single transaction. The caller must have write access to the specified field.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal performing the operation.
 * @param input - Data for the visual sampling and assessment.
 * @returns The ID of the newly created visual soil analysis record.
 */
export async function addVisualSoilAnalysis(
    fdm: FdmType,
    principal_id: PrincipalId,
    input: AddVisualSoilAnalysisInput,
): Promise<schema.soilAnalysisVisualTypeSelect["a_id_visual"]> {
    try {
        await checkPermission(
            fdm,
            "field",
            "write",
            input.b_id,
            principal_id,
            "addVisualSoilAnalysis",
        )

        return await fdm.transaction(async (tx) => {
            const b_id_sampling = createId()
            const a_id_visual = createId()

            await tx.insert(schema.soilSamplingVisual).values({
                b_id_sampling,
                b_id: input.b_id,
                a_id: input.a_id ?? null,
                a_depth_upper: input.a_depth_upper ?? 0,
                a_depth_lower: input.a_depth_lower ?? null,
                b_sampling_date: input.b_sampling_date ?? null,
            })

            await tx.insert(schema.soilAnalysisVisual).values({
                a_id_visual,
                b_id_sampling,
                date: input.date ?? null,
                assessor_name: input.assessor_name ?? null,
                assessment_type: input.assessment_type ?? null,
                a_ss_bcs: input.a_ss_bcs ?? null,
                a_sc_bcs: input.a_sc_bcs ?? null,
                a_rd_bcs: input.a_rd_bcs ?? null,
                a_ew_bcs: input.a_ew_bcs ?? null,
                a_cc_bcs: input.a_cc_bcs ?? null,
                a_gs_bcs: input.a_gs_bcs ?? null,
                a_p_bcs: input.a_p_bcs ?? null,
                a_c_bcs: input.a_c_bcs ?? null,
                a_rt_bcs: input.a_rt_bcs ?? null,
                notes: input.notes ?? null,
                weather_conditions: input.weather_conditions ?? null,
            })

            // Grant owner role to the creator so they have exclusive write access.
            // Farm members without an explicit VSA role only get read access via the chain.
            const creatorId = Array.isArray(principal_id)
                ? principal_id[0]
                : principal_id
            await grantRole(tx, "soil_analysis_visual", "owner", a_id_visual, creatorId)

            return a_id_visual
        })
    } catch (err) {
        throw handleError(err, "Exception for addVisualSoilAnalysis", {
            b_id: input.b_id,
        })
    }
}

/**
 * Retrieves a single visual soil analysis with its images and annotations.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal requesting the data.
 * @param a_id_visual - The ID of the visual soil analysis to retrieve.
 * @returns The visual soil analysis with nested images and annotations.
 */
export async function getVisualSoilAnalysis(
    fdm: FdmType,
    principal_id: PrincipalId,
    a_id_visual: schema.soilAnalysisVisualTypeSelect["a_id_visual"],
): Promise<VisualSoilAssessment | undefined> {
    try {
        await checkPermission(
            fdm,
            "soil_analysis_visual",
            "read",
            a_id_visual,
            principal_id,
            "getVisualSoilAnalysis",
        )

        const rows = await fdm
            .select({
                a_id_visual: schema.soilAnalysisVisual.a_id_visual,
                b_id_sampling: schema.soilAnalysisVisual.b_id_sampling,
                b_id: schema.soilSamplingVisual.b_id,
                date: schema.soilAnalysisVisual.date,
                assessor_name: schema.soilAnalysisVisual.assessor_name,
                assessment_type: schema.soilAnalysisVisual.assessment_type,
                a_ss_bcs: schema.soilAnalysisVisual.a_ss_bcs,
                a_sc_bcs: schema.soilAnalysisVisual.a_sc_bcs,
                a_rd_bcs: schema.soilAnalysisVisual.a_rd_bcs,
                a_ew_bcs: schema.soilAnalysisVisual.a_ew_bcs,
                a_cc_bcs: schema.soilAnalysisVisual.a_cc_bcs,
                a_gs_bcs: schema.soilAnalysisVisual.a_gs_bcs,
                a_p_bcs: schema.soilAnalysisVisual.a_p_bcs,
                a_c_bcs: schema.soilAnalysisVisual.a_c_bcs,
                a_rt_bcs: schema.soilAnalysisVisual.a_rt_bcs,
                d_bcs: schema.soilAnalysisVisual.d_bcs,
                i_bcs: schema.soilAnalysisVisual.i_bcs,
                notes: schema.soilAnalysisVisual.notes,
                weather_conditions: schema.soilAnalysisVisual.weather_conditions,
                created: schema.soilAnalysisVisual.created,
                updated: schema.soilAnalysisVisual.updated,
            })
            .from(schema.soilAnalysisVisual)
            .innerJoin(
                schema.soilSamplingVisual,
                eq(
                    schema.soilAnalysisVisual.b_id_sampling,
                    schema.soilSamplingVisual.b_id_sampling,
                ),
            )
            .where(
                eq(schema.soilAnalysisVisual.a_id_visual, a_id_visual),
            )

        if (rows.length === 0) return undefined

        const assessment = rows[0]

        const images = await fdm
            .select()
            .from(schema.soilAnalysisVisualImage)
            .where(
                eq(schema.soilAnalysisVisualImage.a_id_visual, a_id_visual),
            )
            .orderBy(schema.soilAnalysisVisualImage.sort_order)

        const imagesWithAnnotations: VisualSoilImage[] = await Promise.all(
            images.map(async (image) => {
                const annotations = await fdm
                    .select()
                    .from(schema.soilAnalysisVisualAnnotation)
                    .where(
                        eq(
                            schema.soilAnalysisVisualAnnotation.a_id_image,
                            image.a_id_image,
                        ),
                    )
                    .orderBy(schema.soilAnalysisVisualAnnotation.sort_order)

                return { ...image, annotations }
            }),
        )

        return { ...assessment, images: imagesWithAnnotations }
    } catch (err) {
        throw handleError(err, "Exception for getVisualSoilAnalysis", {
            a_id_visual,
        })
    }
}

/**
 * Retrieves all visual soil analyses for a given field.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal requesting the data.
 * @param b_id - The ID of the field.
 * @returns Array of visual soil assessments (without nested images for list performance).
 */
export async function getVisualSoilAnalyses(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id: schema.soilSamplingVisualTypeSelect["b_id"],
): Promise<Omit<VisualSoilAssessment, "images">[]> {
    try {
        await checkPermission(
            fdm,
            "field",
            "read",
            b_id,
            principal_id,
            "getVisualSoilAnalyses",
        )

        const rows = await fdm
            .select({
                a_id_visual: schema.soilAnalysisVisual.a_id_visual,
                b_id_sampling: schema.soilAnalysisVisual.b_id_sampling,
                b_id: schema.soilSamplingVisual.b_id,
                date: schema.soilAnalysisVisual.date,
                assessor_name: schema.soilAnalysisVisual.assessor_name,
                assessment_type: schema.soilAnalysisVisual.assessment_type,
                a_ss_bcs: schema.soilAnalysisVisual.a_ss_bcs,
                a_sc_bcs: schema.soilAnalysisVisual.a_sc_bcs,
                a_rd_bcs: schema.soilAnalysisVisual.a_rd_bcs,
                a_ew_bcs: schema.soilAnalysisVisual.a_ew_bcs,
                a_cc_bcs: schema.soilAnalysisVisual.a_cc_bcs,
                a_gs_bcs: schema.soilAnalysisVisual.a_gs_bcs,
                a_p_bcs: schema.soilAnalysisVisual.a_p_bcs,
                a_c_bcs: schema.soilAnalysisVisual.a_c_bcs,
                a_rt_bcs: schema.soilAnalysisVisual.a_rt_bcs,
                d_bcs: schema.soilAnalysisVisual.d_bcs,
                i_bcs: schema.soilAnalysisVisual.i_bcs,
                notes: schema.soilAnalysisVisual.notes,
                weather_conditions: schema.soilAnalysisVisual.weather_conditions,
                created: schema.soilAnalysisVisual.created,
                updated: schema.soilAnalysisVisual.updated,
            })
            .from(schema.soilAnalysisVisual)
            .innerJoin(
                schema.soilSamplingVisual,
                eq(
                    schema.soilAnalysisVisual.b_id_sampling,
                    schema.soilSamplingVisual.b_id_sampling,
                ),
            )
            .where(eq(schema.soilSamplingVisual.b_id, b_id))
            .orderBy(schema.soilAnalysisVisual.date)

        return rows
    } catch (err) {
        throw handleError(err, "Exception for getVisualSoilAnalyses", { b_id })
    }
}

/**
 * Updates a visual soil analysis record.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal performing the update.
 * @param a_id_visual - The ID of the visual soil analysis to update.
 * @param data - The data fields to update.
 */
export async function updateVisualSoilAnalysis(
    fdm: FdmType,
    principal_id: PrincipalId,
    a_id_visual: schema.soilAnalysisVisualTypeSelect["a_id_visual"],
    data: UpdateVisualSoilAnalysisInput,
): Promise<void> {
    try {
        await checkPermission(
            fdm,
            "soil_analysis_visual",
            "write",
            a_id_visual,
            principal_id,
            "updateVisualSoilAnalysis",
        )

        const updated = new Date()
        await fdm
            .update(schema.soilAnalysisVisual)
            .set({ updated, ...data })
            .where(eq(schema.soilAnalysisVisual.a_id_visual, a_id_visual))
    } catch (err) {
        throw handleError(err, "Exception for updateVisualSoilAnalysis", {
            a_id_visual,
        })
    }
}

/**
 * Removes a visual soil analysis and all its related sampling, images, and annotations.
 * Cascade deletes handle images and annotations via FK constraints.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal performing the removal.
 * @param a_id_visual - The ID of the visual soil analysis to remove.
 */
export async function removeVisualSoilAnalysis(
    fdm: FdmType,
    principal_id: PrincipalId,
    a_id_visual: schema.soilAnalysisVisualTypeSelect["a_id_visual"],
): Promise<void> {
    try {
        await checkPermission(
            fdm,
            "soil_analysis_visual",
            "write",
            a_id_visual,
            principal_id,
            "removeVisualSoilAnalysis",
        )

        return await fdm.transaction(async (tx) => {
            // Get the sampling ID before deleting the visual analysis
            const [visual] = await tx
                .select({ b_id_sampling: schema.soilAnalysisVisual.b_id_sampling })
                .from(schema.soilAnalysisVisual)
                .where(eq(schema.soilAnalysisVisual.a_id_visual, a_id_visual))

            if (!visual) return

            // Delete visual analysis (cascade deletes images + annotations)
            await tx
                .delete(schema.soilAnalysisVisual)
                .where(eq(schema.soilAnalysisVisual.a_id_visual, a_id_visual))

            // Delete the visual sampling record
            await tx
                .delete(schema.soilSamplingVisual)
                .where(
                    eq(
                        schema.soilSamplingVisual.b_id_sampling,
                        visual.b_id_sampling,
                    ),
                )

            // Soft-delete all role grants for this VSA
            await tx
                .update(authZSchema.role)
                .set({ deleted: new Date() })
                .where(
                    and(
                        eq(authZSchema.role.resource, "soil_analysis_visual"),
                        eq(authZSchema.role.resource_id, a_id_visual),
                        isNull(authZSchema.role.deleted),
                    ),
                )
        })
    } catch (err) {
        throw handleError(err, "Exception for removeVisualSoilAnalysis", {
            a_id_visual,
        })
    }
}

/**
 * Adds an image record to a visual soil analysis.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal performing the operation.
 * @param a_id_visual - The ID of the visual soil analysis to attach the image to.
 * @param input - Image metadata (GCS key, type, caption, sort order).
 * @returns The ID of the newly created image record.
 */
export async function addVisualSoilImage(
    fdm: FdmType,
    principal_id: PrincipalId,
    a_id_visual: schema.soilAnalysisVisualTypeSelect["a_id_visual"],
    input: AddVisualSoilImageInput,
): Promise<schema.soilAnalysisVisualImageTypeSelect["a_id_image"]> {
    try {
        await checkPermission(
            fdm,
            "soil_analysis_visual",
            "write",
            a_id_visual,
            principal_id,
            "addVisualSoilImage",
        )

        const a_id_image = createId()
        await fdm.insert(schema.soilAnalysisVisualImage).values({
            a_id_image,
            a_id_visual,
            gcs_object_key: input.gcs_object_key,
            image_type: input.image_type ?? null,
            sort_order: input.sort_order ?? 0,
            caption: input.caption ?? null,
        })

        return a_id_image
    } catch (err) {
        throw handleError(err, "Exception for addVisualSoilImage", {
            a_id_visual,
        })
    }
}

/**
 * Removes an image and all its annotations from a visual soil analysis.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal performing the removal.
 * @param a_id_image - The ID of the image to remove.
 */
export async function removeVisualSoilImage(
    fdm: FdmType,
    principal_id: PrincipalId,
    a_id_image: schema.soilAnalysisVisualImageTypeSelect["a_id_image"],
): Promise<void> {
    try {
        // Resolve the a_id_visual so we can check permission
        const [image] = await fdm
            .select({ a_id_visual: schema.soilAnalysisVisualImage.a_id_visual })
            .from(schema.soilAnalysisVisualImage)
            .where(eq(schema.soilAnalysisVisualImage.a_id_image, a_id_image))

        if (!image) return

        await checkPermission(
            fdm,
            "soil_analysis_visual",
            "write",
            image.a_id_visual,
            principal_id,
            "removeVisualSoilImage",
        )

        // Cascade delete handles annotations
        await fdm
            .delete(schema.soilAnalysisVisualImage)
            .where(eq(schema.soilAnalysisVisualImage.a_id_image, a_id_image))
    } catch (err) {
        throw handleError(err, "Exception for removeVisualSoilImage", {
            a_id_image,
        })
    }
}

/**
 * Adds an annotation to an image in a visual soil analysis.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal performing the operation.
 * @param a_id_image - The ID of the image to annotate.
 * @param input - Annotation data (type, coordinate JSON, text, indicator).
 * @returns The ID of the newly created annotation.
 */
export async function addImageAnnotation(
    fdm: FdmType,
    principal_id: PrincipalId,
    a_id_image: schema.soilAnalysisVisualImageTypeSelect["a_id_image"],
    input: AddImageAnnotationInput,
): Promise<schema.soilAnalysisVisualAnnotationTypeSelect["a_id_annotation"]> {
    try {
        // Resolve permission via the parent visual analysis
        const [image] = await fdm
            .select({ a_id_visual: schema.soilAnalysisVisualImage.a_id_visual })
            .from(schema.soilAnalysisVisualImage)
            .where(eq(schema.soilAnalysisVisualImage.a_id_image, a_id_image))

        if (!image) throw new Error(`Image not found: ${a_id_image}`)

        await checkPermission(
            fdm,
            "soil_analysis_visual",
            "write",
            image.a_id_visual,
            principal_id,
            "addImageAnnotation",
        )

        const a_id_annotation = createId()
        await fdm.insert(schema.soilAnalysisVisualAnnotation).values({
            a_id_annotation,
            a_id_image,
            type: input.type,
            data_json: input.data_json,
            text: input.text ?? null,
            indicator: input.indicator ?? null,
            sort_order: input.sort_order ?? 0,
        })

        return a_id_annotation
    } catch (err) {
        throw handleError(err, "Exception for addImageAnnotation", {
            a_id_image,
        })
    }
}

/**
 * Updates an existing image annotation.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal performing the update.
 * @param a_id_annotation - The ID of the annotation to update.
 * @param data - The fields to update.
 */
export async function updateImageAnnotation(
    fdm: FdmType,
    principal_id: PrincipalId,
    a_id_annotation: schema.soilAnalysisVisualAnnotationTypeSelect["a_id_annotation"],
    data: UpdateImageAnnotationInput,
): Promise<void> {
    try {
        // Resolve permission via the parent image → visual analysis
        const [annotation] = await fdm
            .select({ a_id_image: schema.soilAnalysisVisualAnnotation.a_id_image })
            .from(schema.soilAnalysisVisualAnnotation)
            .where(
                eq(
                    schema.soilAnalysisVisualAnnotation.a_id_annotation,
                    a_id_annotation,
                ),
            )

        if (!annotation) return

        const [image] = await fdm
            .select({ a_id_visual: schema.soilAnalysisVisualImage.a_id_visual })
            .from(schema.soilAnalysisVisualImage)
            .where(
                eq(
                    schema.soilAnalysisVisualImage.a_id_image,
                    annotation.a_id_image,
                ),
            )

        if (!image) return

        await checkPermission(
            fdm,
            "soil_analysis_visual",
            "write",
            image.a_id_visual,
            principal_id,
            "updateImageAnnotation",
        )

        const updated = new Date()
        await fdm
            .update(schema.soilAnalysisVisualAnnotation)
            .set({ updated, ...data })
            .where(
                eq(
                    schema.soilAnalysisVisualAnnotation.a_id_annotation,
                    a_id_annotation,
                ),
            )
    } catch (err) {
        throw handleError(err, "Exception for updateImageAnnotation", {
            a_id_annotation,
        })
    }
}

/**
 * Removes an annotation from an image.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal performing the removal.
 * @param a_id_annotation - The ID of the annotation to remove.
 */
export async function removeImageAnnotation(
    fdm: FdmType,
    principal_id: PrincipalId,
    a_id_annotation: schema.soilAnalysisVisualAnnotationTypeSelect["a_id_annotation"],
): Promise<void> {
    try {
        // Resolve permission via parent image → visual analysis
        const [annotation] = await fdm
            .select({ a_id_image: schema.soilAnalysisVisualAnnotation.a_id_image })
            .from(schema.soilAnalysisVisualAnnotation)
            .where(
                eq(
                    schema.soilAnalysisVisualAnnotation.a_id_annotation,
                    a_id_annotation,
                ),
            )

        if (!annotation) return

        const [image] = await fdm
            .select({ a_id_visual: schema.soilAnalysisVisualImage.a_id_visual })
            .from(schema.soilAnalysisVisualImage)
            .where(
                eq(
                    schema.soilAnalysisVisualImage.a_id_image,
                    annotation.a_id_image,
                ),
            )

        if (!image) return

        await checkPermission(
            fdm,
            "soil_analysis_visual",
            "write",
            image.a_id_visual,
            principal_id,
            "removeImageAnnotation",
        )

        await fdm
            .delete(schema.soilAnalysisVisualAnnotation)
            .where(
                eq(
                    schema.soilAnalysisVisualAnnotation.a_id_annotation,
                    a_id_annotation,
                ),
            )
    } catch (err) {
        throw handleError(err, "Exception for removeImageAnnotation", {
            a_id_annotation,
        })
    }
}
