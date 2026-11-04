import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
  addSoilImage,
  addSoilImageAnnotation,
  FdmType,
  getSoilAnalysis,
  getSoilImage,
  getSoilImageAnnotation,
  getSoilImages,
  removeSoilImage,
  removeSoilImageAnnotation,
  SoilImage,
  SoilImageAnnotation,
  updateSoilImageAnnotation,
} from "@nmi-agro/fdm-core"
import type { FileStorage } from "@nmi-agro/fdm-storage"
import { createRoute, z } from "@hono/zod-openapi"
import { isBcsAnalysis } from "@nmi-agro/fdm-calculator"
import { InvalidUploadError, readAndValidateFileUpload } from "@nmi-agro/fdm-storage"
import { randomUUID } from "node:crypto"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError } from "../error"
import { SoilAnalysisIdSchema } from "../fields"
import { rateLimitMiddleware } from "../rate-limit"
import {
  binaryResponse,
  commonErrorResponses,
  problemResponseDefinition,
  uploadErrorResponses,
  writeErrorResponses,
} from "../schemas"
import { requireStorage } from "../storage"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/** Image types accepted for soil photos, with the file extension they are stored with. */
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
}
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/** Defines the soil image functions required by the soil image routes. */
export interface SoilImageServices {
  getSoilAnalysis: typeof getSoilAnalysis
  getSoilImages: typeof getSoilImages
  getSoilImage: typeof getSoilImage
  addSoilImage: typeof addSoilImage
  removeSoilImage: typeof removeSoilImage
  addSoilImageAnnotation: typeof addSoilImageAnnotation
  getSoilImageAnnotation: typeof getSoilImageAnnotation
  updateSoilImageAnnotation: typeof updateSoilImageAnnotation
  removeSoilImageAnnotation: typeof removeSoilImageAnnotation
  getStorage: () => FileStorage | undefined
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SoilImageIdSchema = z
  .string()
  .min(1)
  .describe("Unique identifier of the soil image.")
  .openapi({ param: { name: "a_id_image", in: "path" } })

const AnnotationIdSchema = z
  .string()
  .min(1)
  .describe("Unique identifier of the annotation.")
  .openapi({ param: { name: "a_id_annotation", in: "path" } })

const PercentSchema = z.number().min(0).max(100)

const AnnotationCoordinatesSchema = z
  .union([
    z
      .object({
        x: PercentSchema.describe("Horizontal position, in percent of the image width (0–100)."),
        y: PercentSchema.describe("Vertical position, in percent of the image height (0–100)."),
      })
      .describe("A pin: one point."),
    z
      .object({
        cx: PercentSchema.describe("Horizontal centre, in percent of the image width (0–100)."),
        cy: PercentSchema.describe("Vertical centre, in percent of the image height (0–100)."),
        r: PercentSchema.describe("Radius, in percent of the image width (0–100)."),
      })
      .describe("A circle."),
    z
      .object({
        x1: PercentSchema.describe("Horizontal start, in percent of the image width (0–100)."),
        y1: PercentSchema.describe("Vertical start, in percent of the image height (0–100)."),
        x2: PercentSchema.describe("Horizontal end (arrow head), in percent of the image width."),
        y2: PercentSchema.describe("Vertical end (arrow head), in percent of the image height."),
      })
      .describe("An arrow."),
    z
      .object({
        points: z
          .array(
            z.object({
              x: PercentSchema.describe("Horizontal position, in percent of the image width."),
              y: PercentSchema.describe("Vertical position, in percent of the image height."),
            }),
          )
          .min(2)
          .max(2000)
          .describe("Points of the line, in drawing order."),
      })
      .describe("A freehand line."),
  ])
  .describe(
    "Shape of the annotation on the image. Use `{x, y}` for a pin, `{cx, cy, r}` for a circle, `{x1, y1, x2, y2}` for an arrow and `{points}` for a freehand line. All values are in percent of the image size.",
  )

const AnnotationTypeSchema = z
  .enum(["pin", "circle", "arrow", "freehand"])
  .describe("Kind of annotation. Must match the shape of `a_image_annotation_coordinates`.")

const BcsIndicatorSchema = z
  .enum([
    "a_ss_bcs",
    "a_sc_bcs",
    "a_rd_bcs",
    "a_ew_bcs",
    "a_cc_bcs",
    "a_gs_bcs",
    "a_p_bcs",
    "a_c_bcs",
    "a_rt_bcs",
  ])
  .nullable()
  .describe(
    "Soil condition score (BCS) indicator this annotation illustrates, for example `a_ew_bcs` for earthworms. `null` when it is not linked to an indicator.",
  )

const SoilImageAnnotationSchema = z
  .object({
    a_id_annotation: z.string().describe("Unique identifier of the annotation."),
    a_image_annotation_type: AnnotationTypeSchema,
    a_image_annotation_coordinates: AnnotationCoordinatesSchema,
    a_image_annotation: z
      .string()
      .nullable()
      .describe("Text of the annotation. `null` when it has no text."),
    a_image_annotation_bcs: BcsIndicatorSchema,
    a_image_annotation_order: z
      .number()
      .int()
      .describe("Position of the annotation on its image; lower numbers come first."),
  })
  .openapi("SoilImageAnnotation")

const ImageTypeSchema = z
  .enum(["profile", "surface", "roots", "earthworms", "structure", "other"])
  .describe(
    "What the photo shows: `profile` (soil profile), `surface`, `roots`, `earthworms`, `structure` (soil structure) or `other`.",
  )

const SoilImageSchema = z
  .object({
    a_id_image: z.string().describe("Unique identifier of the soil image."),
    a_image_type: ImageTypeSchema.nullable().describe(
      "What the photo shows. `null` when not specified.",
    ),
    a_image_caption: z.string().nullable().describe("Caption of the photo. `null` when not set."),
    a_image_order: z
      .number()
      .int()
      .describe("Position of the photo in the assessment; lower numbers come first."),
    annotations: z
      .array(SoilImageAnnotationSchema)
      .describe("Annotations drawn on the photo, in order."),
  })
  .openapi("SoilImage")

const UploadSoilImageBodySchema = z
  .object({
    file: z
      .custom<File>((value) => value instanceof File, { message: "file must be a file." })
      .openapi({ type: "string", format: "binary" })
      .describe(
        "The photo: JPEG, PNG, WebP or HEIC, at most 10 MB. The type is checked from the file contents.",
      ),
    a_image_type: ImageTypeSchema.optional(),
    a_image_caption: z.string().max(500).optional().describe("Caption of the photo."),
    a_image_order: z.coerce
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Position of the photo in the assessment. Defaults to 0."),
  })
  .openapi("UploadSoilImage")

const CreateAnnotationBodySchema = z
  .object({
    a_image_annotation_type: AnnotationTypeSchema,
    a_image_annotation_coordinates: AnnotationCoordinatesSchema,
    a_image_annotation: z
      .string()
      .max(1000)
      .nullable()
      .optional()
      .describe("Text of the annotation."),
    a_image_annotation_bcs: BcsIndicatorSchema.optional(),
    a_image_annotation_order: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Position of the annotation on its image. Defaults to 0."),
  })
  .openapi("CreateSoilImageAnnotation")

const UpdateAnnotationBodySchema = CreateAnnotationBodySchema.omit({
  a_image_annotation_type: true,
})
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one property to update.",
  })
  .openapi("UpdateSoilImageAnnotation")

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const listSoilImagesRoute = createRoute({
  method: "get",
  path: "/soil-analyses/{a_id}/images",
  tags: ["Soil Images"],
  summary: "List the photos of a soil analysis",
  description:
    "Returns the photos of a soil condition score (BCS) assessment with their annotations. Download a photo with `GET /soil-images/{a_id_image}`.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: { params: z.object({ a_id: SoilAnalysisIdSchema }) },
  responses: {
    200: {
      description: "The photos of the soil analysis.",
      content: { "application/json": { schema: z.array(SoilImageSchema) } },
    },
    ...commonErrorResponses,
  },
})

const uploadSoilImageRoute = createRoute({
  method: "post",
  path: "/soil-analyses/{a_id}/images",
  tags: ["Soil Images"],
  summary: "Upload a photo to a soil analysis",
  description:
    "Adds a photo to a soil condition score (BCS) assessment: a soil analysis with at least one visual score (`a_ss_bcs` to `a_rt_bcs`). Returns 422 for other soil analyses. Send it as `multipart/form-data` with the photo in the `file` field. Returns 503 when file storage is not configured on the server.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: z.object({ a_id: SoilAnalysisIdSchema }),
    body: {
      content: { "multipart/form-data": { schema: UploadSoilImageBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: "The uploaded photo.",
      content: { "application/json": { schema: SoilImageSchema } },
    },
    ...uploadErrorResponses,
    503: problemResponseDefinition(
      "Service unavailable — file storage is not configured on this server.",
    ),
  },
})

const downloadSoilImageRoute = createRoute({
  method: "get",
  path: "/soil-images/{a_id_image}",
  tags: ["Soil Images"],
  summary: "Download a photo",
  description:
    "Returns the photo file. The `Content-Type` header gives its image type. Returns 503 when file storage is not configured on the server.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: { params: z.object({ a_id_image: SoilImageIdSchema }) },
  responses: {
    200: binaryResponse("image/*", "The photo."),
    ...commonErrorResponses,
    503: problemResponseDefinition(
      "Service unavailable — file storage is not configured on this server.",
    ),
  },
})

const deleteSoilImageRoute = createRoute({
  method: "delete",
  path: "/soil-images/{a_id_image}",
  tags: ["Soil Images"],
  summary: "Delete a photo",
  description: "Permanently deletes a photo, its annotations and its file.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: { params: z.object({ a_id_image: SoilImageIdSchema }) },
  responses: {
    204: { description: "Photo deleted." },
    ...commonErrorResponses,
  },
})

const createAnnotationRoute = createRoute({
  method: "post",
  path: "/soil-images/{a_id_image}/annotations",
  tags: ["Soil Images"],
  summary: "Add an annotation to a photo",
  description: "Draws a pin, circle, arrow or freehand line on a photo, optionally with text.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: z.object({ a_id_image: SoilImageIdSchema }),
    body: {
      content: { "application/json": { schema: CreateAnnotationBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: "The new annotation.",
      content: { "application/json": { schema: SoilImageAnnotationSchema } },
    },
    ...writeErrorResponses,
  },
})

const updateAnnotationRoute = createRoute({
  method: "patch",
  path: "/soil-image-annotations/{a_id_annotation}",
  tags: ["Soil Images"],
  summary: "Update an annotation",
  description:
    "Changes the shape, text, indicator or order of an annotation. Only the properties in the body change; the kind of annotation cannot change.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: z.object({ a_id_annotation: AnnotationIdSchema }),
    body: {
      content: { "application/json": { schema: UpdateAnnotationBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "The updated annotation.",
      content: { "application/json": { schema: SoilImageAnnotationSchema } },
    },
    ...writeErrorResponses,
  },
})

const deleteAnnotationRoute = createRoute({
  method: "delete",
  path: "/soil-image-annotations/{a_id_annotation}",
  tags: ["Soil Images"],
  summary: "Delete an annotation",
  description: "Permanently deletes an annotation.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: { params: z.object({ a_id_annotation: AnnotationIdSchema }) },
  responses: {
    204: { description: "Annotation deleted." },
    ...commonErrorResponses,
  },
})

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

function parseCoordinates(value: unknown): unknown {
  // Older annotations are stored as a JSON string.
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

function serialiseAnnotation(annotation: SoilImageAnnotation) {
  return {
    a_id_annotation: annotation.a_id_annotation,
    a_image_annotation_type: annotation.a_image_annotation_type,
    a_image_annotation_coordinates: parseCoordinates(annotation.a_image_annotation_coordinates),
    a_image_annotation: annotation.a_image_annotation ?? null,
    a_image_annotation_bcs: annotation.a_image_annotation_bcs ?? null,
    a_image_annotation_order: annotation.a_image_annotation_order,
  }
}

function serialiseImage(image: SoilImage) {
  return {
    a_id_image: image.a_id_image,
    a_image_type: image.a_image_type ?? null,
    a_image_caption: image.a_image_caption ?? null,
    a_image_order: image.a_image_order,
    annotations: image.annotations.map(serialiseAnnotation),
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Registers the routes for photos and annotations of a soil condition score (BCS) assessment.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Soil image service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerSoilImageRoutes(app, fdm, services)
 * ```
 */
export function registerSoilImageRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: SoilImageServices,
): void {
  // /soil-analyses/* is covered by the middleware in soil-analyses.ts
  for (const path of ["/soil-images/*", "/soil-image-annotations/*"]) {
    app.use(path, (c, next) =>
      rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
    )
  }

  async function requireAnalysis(principal_id: string, a_id: string) {
    const analysis = await services.getSoilAnalysis(fdm, principal_id, a_id)
    if (!analysis?.b_id_sampling) {
      throw new ApiError(404, "not-found", `Soil analysis '${a_id}' not found.`)
    }
    return { ...analysis, b_id_sampling: analysis.b_id_sampling }
  }

  async function requireImage(principal_id: string, a_id_image: string): Promise<SoilImage> {
    const image = await services.getSoilImage(fdm, principal_id, a_id_image)
    if (!image) {
      throw new ApiError(404, "not-found", `Soil image '${a_id_image}' not found.`)
    }
    return image
  }

  async function requireAnnotation(
    principal_id: string,
    a_id_annotation: string,
  ): Promise<SoilImageAnnotation> {
    const annotation = await services.getSoilImageAnnotation(fdm, principal_id, a_id_annotation)
    if (!annotation) {
      throw new ApiError(404, "not-found", `Annotation '${a_id_annotation}' not found.`)
    }
    return annotation
  }

  const listSoilImagesHandler: RouteHandler<typeof listSoilImagesRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { a_id } = c.req.valid("param") as { a_id: string }
    const { b_id_sampling } = await requireAnalysis(principal.effectivePrincipalId, a_id)
    const images = await services.getSoilImages(fdm, principal.effectivePrincipalId, b_id_sampling)
    return c.json(images.map(serialiseImage), 200)
  }

  const uploadSoilImageHandler: RouteHandler<typeof uploadSoilImageRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { a_id } = c.req.valid("param") as { a_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const form = c.req.valid("form") as z.infer<typeof UploadSoilImageBodySchema>
    const storage = requireStorage(services.getStorage)
    const analysis = await requireAnalysis(principal.effectivePrincipalId, a_id)
    // The web app shows photos only for soil condition score assessments.
    if (!isBcsAnalysis(analysis)) {
      throw new ApiError(
        422,
        "unprocessable-entity",
        "Photos can only be added to a soil condition score (BCS) assessment: a soil analysis with at least one visual score (a_ss_bcs to a_rt_bcs).",
      )
    }
    const b_id_sampling = analysis.b_id_sampling

    let upload: { buffer: Buffer; mime: string }
    try {
      upload = await readAndValidateFileUpload(form.file, {
        allowedMimes: new Set(Object.keys(IMAGE_EXTENSIONS)),
        maxBytes: MAX_IMAGE_BYTES,
      })
    } catch (err) {
      if (err instanceof InvalidUploadError) {
        throw err.reason === "too-large"
          ? new ApiError(413, "payload-too-large", "The photo is larger than 10 MB.")
          : new ApiError(
              415,
              "unsupported-media-type",
              "The photo must be a JPEG, PNG, WebP or HEIC image.",
            )
      }
      throw err
    }

    const objectKey = `soil_image/${randomUUID()}.${IMAGE_EXTENSIONS[upload.mime]}`
    const a_id_image = await services.addSoilImage(
      fdm,
      principal.effectivePrincipalId,
      b_id_sampling,
      {
        a_image_path: objectKey,
        a_image_type: form.a_image_type,
        a_image_caption: form.a_image_caption,
        a_image_order: form.a_image_order,
      },
      (path) => storage.upload(path, upload.buffer, upload.mime),
    )
    const image = await requireImage(principal.effectivePrincipalId, a_id_image)
    return c.json(serialiseImage(image), 201)
  }

  const downloadSoilImageHandler: RouteHandler<typeof downloadSoilImageRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { a_id_image } = c.req.valid("param") as { a_id_image: string }
    const storage = requireStorage(services.getStorage)
    const image = await requireImage(principal.effectivePrincipalId, a_id_image)
    let file: Awaited<ReturnType<FileStorage["download"]>>
    try {
      file = await storage.download(image.a_image_path)
    } catch (err) {
      if (err instanceof Error && err.name === "FileNotFoundError") {
        throw new ApiError(404, "not-found", `The file of soil image '${a_id_image}' is missing.`)
      }
      throw err
    }
    return c.body(new Uint8Array(file.buffer), 200, {
      "content-type": file.contentType ?? "application/octet-stream",
      "cache-control": "private, max-age=3600",
    }) as never
  }

  const deleteSoilImageHandler: RouteHandler<typeof deleteSoilImageRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { a_id_image } = c.req.valid("param") as { a_id_image: string }
    const image = await requireImage(principal.effectivePrincipalId, a_id_image)
    await services.removeSoilImage(fdm, principal.effectivePrincipalId, a_id_image)
    // The photo is removed; a file that cannot be deleted is only logged.
    const storage = services.getStorage()
    if (storage) {
      await storage.delete(image.a_image_path).catch((err: unknown) => {
        console.warn(`[fdm-api] could not delete the file of soil image ${a_id_image}:`, err)
      })
    }
    return c.newResponse(null, 204)
  }

  const createAnnotationHandler: RouteHandler<typeof createAnnotationRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { a_id_image } = c.req.valid("param") as { a_id_image: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateAnnotationBodySchema>
    await requireImage(principal.effectivePrincipalId, a_id_image)
    const a_id_annotation = await services.addSoilImageAnnotation(
      fdm,
      principal.effectivePrincipalId,
      a_id_image,
      body as Parameters<typeof addSoilImageAnnotation>[3],
    )
    const annotation = await requireAnnotation(principal.effectivePrincipalId, a_id_annotation)
    return c.json(serialiseAnnotation(annotation), 201)
  }

  const updateAnnotationHandler: RouteHandler<typeof updateAnnotationRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { a_id_annotation } = c.req.valid("param") as { a_id_annotation: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateAnnotationBodySchema>
    await requireAnnotation(principal.effectivePrincipalId, a_id_annotation)
    await services.updateSoilImageAnnotation(
      fdm,
      principal.effectivePrincipalId,
      a_id_annotation,
      body as Parameters<typeof updateSoilImageAnnotation>[3],
    )
    const annotation = await requireAnnotation(principal.effectivePrincipalId, a_id_annotation)
    return c.json(serialiseAnnotation(annotation), 200)
  }

  const deleteAnnotationHandler: RouteHandler<typeof deleteAnnotationRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { a_id_annotation } = c.req.valid("param") as { a_id_annotation: string }
    await requireAnnotation(principal.effectivePrincipalId, a_id_annotation)
    await services.removeSoilImageAnnotation(fdm, principal.effectivePrincipalId, a_id_annotation)
    return c.newResponse(null, 204)
  }

  app.openapi(listSoilImagesRoute, listSoilImagesHandler)
  app.openapi(uploadSoilImageRoute, uploadSoilImageHandler)
  app.openapi(downloadSoilImageRoute, downloadSoilImageHandler)
  app.openapi(deleteSoilImageRoute, deleteSoilImageHandler)
  app.openapi(createAnnotationRoute, createAnnotationHandler)
  app.openapi(updateAnnotationRoute, updateAnnotationHandler)
  app.openapi(deleteAnnotationRoute, deleteAnnotationHandler)
}
