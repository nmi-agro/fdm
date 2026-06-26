import { and, eq, inArray, isNull } from "drizzle-orm"
import { checkPermission, grantRole } from "./authorization"
import type { PrincipalId } from "./authorization.types"
import * as schema from "./db/schema"
import * as authZSchema from "./db/schema-authz"
import { handleError } from "./error"
import type { FdmType } from "./fdm.types"
import { createId } from "./id"
import type {
  AddSoilImageAnnotationInput,
  AddSoilImageInput,
  SoilImage,
  UpdateSoilImageAnnotationInput,
} from "./soil-image.types"

/**
 * Adds a soil image record linked to a soil sampling event.
 *
 * The caller must have write access to the field associated with the sampling.
 * An owner role is granted on the new soil_image resource.
 *
 * When `onUpload` is provided it is called with the image path after the
 * permission check but before the DB insert. If `onUpload` throws the DB
 * record is never created. Note: if `onUpload` succeeds but the subsequent
 * DB insert fails, the uploaded object may become orphaned and should be
 * cleaned up externally.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal performing the operation.
 * @param b_id_sampling - The ID of the soil sampling event.
 * @param input - Image metadata (path, type, caption, sort order).
 * @param onUpload - Optional callback invoked with the image path to trigger
 *   the actual storage upload (e.g. GCS). Called after auth, before DB write.
 * @returns The ID of the newly created image record.
 */
export async function addSoilImage(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_sampling: schema.soilSamplingTypeSelect["b_id_sampling"],
  input: AddSoilImageInput,
  onUpload?: (path: string) => Promise<void>,
): Promise<schema.soilImageTypeSelect["a_id_image"]> {
  try {
    // Resolve the field from the sampling record for permission check
    const [sampling] = await fdm
      .select({ b_id: schema.soilSampling.b_id })
      .from(schema.soilSampling)
      .where(eq(schema.soilSampling.b_id_sampling, b_id_sampling))

    if (!sampling) throw new Error(`Soil sampling not found: ${b_id_sampling}`)

    await checkPermission(fdm, "field", "write", sampling.b_id, principal_id, "addSoilImage")

    // Upload to storage before creating the DB record so that a failed
    // upload does not leave behind a dangling DB row.
    if (onUpload) {
      await onUpload(input.a_image_path)
    }

    return await fdm.transaction(async (tx) => {
      const a_id_image = createId()

      await tx.insert(schema.soilImage).values({
        a_id_image,
        b_id_sampling,
        a_image_path: input.a_image_path,
        a_image_type: input.a_image_type ?? null,
        a_image_order: input.a_image_order ?? 0,
        a_image_caption: input.a_image_caption ?? null,
      })

      // Grant owner role to every creator principal
      const creatorIds = Array.isArray(principal_id) ? principal_id : [principal_id]
      for (const creatorId of creatorIds) {
        await grantRole(tx, "soil_image", "owner", a_id_image, creatorId)
      }

      return a_id_image
    })
  } catch (err) {
    throw handleError(err, "Exception for addSoilImage", { b_id_sampling })
  }
}

/**
 * Retrieves all soil images for a given soil sampling event, with their annotations.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal requesting the data.
 * @param b_id_sampling - The ID of the soil sampling event.
 * @returns Array of soil images with nested annotations.
 */
export async function getSoilImages(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_sampling: schema.soilSamplingTypeSelect["b_id_sampling"],
): Promise<SoilImage[]> {
  try {
    // Resolve the field from sampling for permission check
    const [sampling] = await fdm
      .select({ b_id: schema.soilSampling.b_id })
      .from(schema.soilSampling)
      .where(eq(schema.soilSampling.b_id_sampling, b_id_sampling))

    if (!sampling) return []

    await checkPermission(fdm, "field", "read", sampling.b_id, principal_id, "getSoilImages")

    const images = await fdm
      .select()
      .from(schema.soilImage)
      .where(eq(schema.soilImage.b_id_sampling, b_id_sampling))
      .orderBy(schema.soilImage.a_image_order)

    if (images.length === 0) return []

    const imageIds = images.map((img) => img.a_id_image)
    const allAnnotations = await fdm
      .select()
      .from(schema.soilImageAnnotating)
      .where(inArray(schema.soilImageAnnotating.a_id_image, imageIds))
      .orderBy(schema.soilImageAnnotating.a_image_annotation_order)

    const annotationsByImageId = new Map<string, typeof allAnnotations>()
    for (const annotation of allAnnotations) {
      const list = annotationsByImageId.get(annotation.a_id_image) ?? []
      list.push(annotation)
      annotationsByImageId.set(annotation.a_id_image, list)
    }

    return images.map((image) => ({
      ...image,
      annotations: annotationsByImageId.get(image.a_id_image) ?? [],
    }))
  } catch (err) {
    throw handleError(err, "Exception for getSoilImages", { b_id_sampling })
  }
}

/**
 * Removes a soil image and all its annotations (cascade via FK).
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal performing the removal.
 * @param a_id_image - The ID of the image to remove.
 */
export async function removeSoilImage(
  fdm: FdmType,
  principal_id: PrincipalId,
  a_id_image: schema.soilImageTypeSelect["a_id_image"],
  onDelete?: (path: string) => Promise<void>,
): Promise<void> {
  try {
    await checkPermission(fdm, "soil_image", "write", a_id_image, principal_id, "removeSoilImage")

    // Fetch the image path before deletion so we can clean up storage after commit
    const [image] = await fdm
      .select({ a_image_path: schema.soilImage.a_image_path })
      .from(schema.soilImage)
      .where(eq(schema.soilImage.a_id_image, a_id_image))
      .limit(1)

    await fdm.transaction(async (tx) => {
      // Cascade deletes annotations via FK constraint
      await tx.delete(schema.soilImage).where(eq(schema.soilImage.a_id_image, a_id_image))

      // Soft-delete all role grants for this soil image
      await tx
        .update(authZSchema.role)
        .set({ deleted: new Date() })
        .where(
          and(
            eq(authZSchema.role.resource, "soil_image"),
            eq(authZSchema.role.resource_id, a_id_image),
            isNull(authZSchema.role.deleted),
          ),
        )
    })

    // Delete from storage only after the DB commit succeeds; a failure here
    // leaves an orphaned GCS object but preserves DB consistency.
    if (image?.a_image_path && onDelete) {
      await onDelete(image.a_image_path)
    }
  } catch (err) {
    throw handleError(err, "Exception for removeSoilImage", { a_id_image })
  }
}

/**
 * Adds an annotation to a soil image.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal performing the operation.
 * @param a_id_image - The ID of the image to annotate.
 * @param input - Annotation data (type, coordinate JSON, text, indicator).
 * @returns The ID of the newly created annotation.
 */
export async function addSoilImageAnnotation(
  fdm: FdmType,
  principal_id: PrincipalId,
  a_id_image: schema.soilImageTypeSelect["a_id_image"],
  input: AddSoilImageAnnotationInput,
): Promise<schema.soilImageAnnotatingTypeSelect["a_id_annotation"]> {
  try {
    await checkPermission(
      fdm,
      "soil_image",
      "write",
      a_id_image,
      principal_id,
      "addSoilImageAnnotation",
    )

    const a_id_annotation = createId()
    await fdm.insert(schema.soilImageAnnotating).values({
      a_id_annotation,
      a_id_image,
      a_image_annotation_type: input.a_image_annotation_type,
      a_image_annotation_coordinates: input.a_image_annotation_coordinates,
      a_image_annotation: input.a_image_annotation ?? null,
      a_image_annotation_bcs: input.a_image_annotation_bcs ?? null,
      a_image_annotation_order: input.a_image_annotation_order ?? 0,
    })

    return a_id_annotation
  } catch (err) {
    throw handleError(err, "Exception for addSoilImageAnnotation", {
      a_id_image,
    })
  }
}

/**
 * Updates an existing soil image annotation.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal performing the update.
 * @param a_id_annotation - The ID of the annotation to update.
 * @param data - The fields to update.
 */
export async function updateSoilImageAnnotation(
  fdm: FdmType,
  principal_id: PrincipalId,
  a_id_annotation: schema.soilImageAnnotatingTypeSelect["a_id_annotation"],
  data: UpdateSoilImageAnnotationInput,
): Promise<void> {
  try {
    // Resolve the parent image to check permission via soil_image resource
    const [annotation] = await fdm
      .select({ a_id_image: schema.soilImageAnnotating.a_id_image })
      .from(schema.soilImageAnnotating)
      .where(eq(schema.soilImageAnnotating.a_id_annotation, a_id_annotation))

    if (!annotation) return

    await checkPermission(
      fdm,
      "soil_image",
      "write",
      annotation.a_id_image,
      principal_id,
      "updateSoilImageAnnotation",
    )

    const updated = new Date()
    await fdm
      .update(schema.soilImageAnnotating)
      .set({ updated, ...data })
      .where(eq(schema.soilImageAnnotating.a_id_annotation, a_id_annotation))
  } catch (err) {
    throw handleError(err, "Exception for updateSoilImageAnnotation", {
      a_id_annotation,
    })
  }
}

/**
 * Removes an annotation from a soil image.
 *
 * @param fdm - The FDM database instance.
 * @param principal_id - The ID of the principal performing the removal.
 * @param a_id_annotation - The ID of the annotation to remove.
 */
export async function removeSoilImageAnnotation(
  fdm: FdmType,
  principal_id: PrincipalId,
  a_id_annotation: schema.soilImageAnnotatingTypeSelect["a_id_annotation"],
): Promise<void> {
  try {
    // Resolve the parent image to check permission via soil_image resource
    const [annotation] = await fdm
      .select({ a_id_image: schema.soilImageAnnotating.a_id_image })
      .from(schema.soilImageAnnotating)
      .where(eq(schema.soilImageAnnotating.a_id_annotation, a_id_annotation))

    if (!annotation) return

    await checkPermission(
      fdm,
      "soil_image",
      "write",
      annotation.a_id_image,
      principal_id,
      "removeSoilImageAnnotation",
    )

    await fdm
      .delete(schema.soilImageAnnotating)
      .where(eq(schema.soilImageAnnotating.a_id_annotation, a_id_annotation))
  } catch (err) {
    throw handleError(err, "Exception for removeSoilImageAnnotation", {
      a_id_annotation,
    })
  }
}
