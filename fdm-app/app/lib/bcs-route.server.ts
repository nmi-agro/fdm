/**
 * Server-only helpers shared by the BCS create and edit routes.
 */
import { data } from "react-router"
import { z } from "zod"
import { BCS_VISUAL_KEYS, type AnnotationCoords, type BcsVisualKey } from "~/lib/bcs"

export const BCS_IMAGE_OBJECT_KEY_PREFIX = "soil_image/"

const AnnotationSchema = z.object({
  tempId: z.string(),
  tempImageId: z.string(),
  type: z.enum(["pin", "circle", "arrow", "freehand"]),
  coordinates: z.any(),
  text: z.string().optional(),
  bcsIndicator: z.string().optional(),
})

export const BcsSavePayloadSchema = z.object({
  a_date: z.string(),
  b_sampling_date: z.string(),
  a_depth_lower: z.union([z.number(), z.string(), z.null(), z.undefined()]).optional(),
  scores: z.record(z.string(), z.any()).optional().default({}),
  images: z
    .array(
      z.object({
        tempId: z.string(),
        objectKey: z.string(),
        url: z.string(),
        caption: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  annotations: z.array(AnnotationSchema).optional().default([]),
})

/**
 * Payload of the edit route. It describes the desired final state: images and annotations that
 * carry an `existingId` are already stored, all others are new.
 */
export const BcsEditPayloadSchema = z.object({
  a_date: z.string(),
  b_sampling_date: z.string(),
  scores: z.record(z.string(), z.any()).optional().default({}),
  images: z
    .array(
      z.object({
        tempId: z.string(),
        existingId: z.string().optional(),
        objectKey: z.string().optional(),
        caption: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  annotations: z
    .array(AnnotationSchema.extend({ existingId: z.string().optional() }))
    .optional()
    .default([]),
})

export function getBcsRouteParams(params: Record<string, string | undefined>) {
  const { a_id, b_id, b_id_farm, calendar } = params
  if (!b_id_farm) {
    throw data("Farm ID is required", { status: 400, statusText: "Farm ID is required" })
  }
  if (!calendar) {
    throw data("Calendar is required", { status: 400, statusText: "Calendar is required" })
  }
  if (!b_id) {
    throw data("Field ID is required", { status: 400, statusText: "Field ID is required" })
  }
  return { a_id, b_id, b_id_farm, calendar }
}

export function getBcsPath(params: Record<string, string | undefined>) {
  const { b_id, b_id_farm, calendar } = getBcsRouteParams(params)
  return `/farm/${b_id_farm}/${calendar}/field/${b_id}/bcs`
}

export function sanitizeScores(scores: Record<string, unknown>) {
  return Object.fromEntries(
    BCS_VISUAL_KEYS.flatMap((key) => {
      const score = scores[key]
      return score === 0 || score === 1 || score === 2 ? [[key, score]] : []
    }),
  ) as Partial<Record<BcsVisualKey, 0 | 1 | 2>>
}

export function ensureValidDate(value: string, label: string) {
  const dateValue = new Date(value)
  if (Number.isNaN(dateValue.getTime())) {
    throw data(`${label} is ongeldig`, {
      status: 400,
      statusText: `${label} is ongeldig`,
    })
  }
  return dateValue
}

/** Parses stored annotation coordinates, keeping valid pin, circle, arrow and freehand shapes.
 *  Falls back to a centered pin for invalid or unknown values. */
export function parseAnnotationCoordinates(value: unknown): AnnotationCoords {
  if (typeof value === "string") {
    try {
      return parseAnnotationCoordinates(JSON.parse(value))
    } catch {
      return { x: 50, y: 50 }
    }
  }

  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>
    const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n)

    if (Array.isArray(v.points)) {
      const points = v.points
      if (
        points.every(
          (p): p is { x: number; y: number } =>
            typeof p === "object" && p !== null && isNum((p as any).x) && isNum((p as any).y),
        )
      ) {
        return { points }
      }
    } else if (isNum(v.cx) && isNum(v.cy) && isNum(v.r)) {
      return { cx: v.cx, cy: v.cy, r: v.r }
    } else if (isNum(v.x1) && isNum(v.y1) && isNum(v.x2) && isNum(v.y2)) {
      return { x1: v.x1, y1: v.y1, x2: v.x2, y2: v.y2 }
    } else if (isNum(v.x) && isNum(v.y)) {
      return { x: v.x, y: v.y }
    }
  }

  return { x: 50, y: 50 }
}
