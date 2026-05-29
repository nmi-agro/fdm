import { z } from "zod"

const bcsScore = z
    .number()
    .int()
    .min(0)
    .max(2)
    .nullable()
    .optional()

export const soilAnalysisBcsSchema = z.object({
    b_id: z.string().min(1, "Perceel is verplicht"),
    a_date: z.coerce.date().optional(),
    a_depth_lower: z.coerce.number().positive().optional(),
    b_sampling_date: z.coerce.date().optional(),
    // 9 BCS indicator scores
    a_ss_bcs: bcsScore,
    a_sc_bcs: bcsScore,
    a_rd_bcs: bcsScore,
    a_ew_bcs: bcsScore,
    a_cc_bcs: bcsScore,
    a_gs_bcs: bcsScore,
    a_p_bcs: bcsScore,
    a_c_bcs: bcsScore,
    a_rt_bcs: bcsScore,
})

export type SoilAnalysisBcsFormValues = z.infer<typeof soilAnalysisBcsSchema>

const pinAnnotationData = z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
})

const circleAnnotationData = z.object({
    cx: z.number().min(0).max(100),
    cy: z.number().min(0).max(100),
    radiusPercent: z.number().min(0).max(100),
})

const arrowAnnotationData = z.object({
    x1: z.number().min(0).max(100),
    y1: z.number().min(0).max(100),
    x2: z.number().min(0).max(100),
    y2: z.number().min(0).max(100),
})

const freehandAnnotationData = z.object({
    points: z.array(z.number()).min(2),
})

export const annotationDataSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("pin"), data: pinAnnotationData }),
    z.object({ type: z.literal("circle"), data: circleAnnotationData }),
    z.object({ type: z.literal("arrow"), data: arrowAnnotationData }),
    z.object({ type: z.literal("freehand"), data: freehandAnnotationData }),
])

export const addAnnotationSchema = z.object({
    a_id_image: z.string().min(1),
    a_image_annotation_type: z.enum(["pin", "circle", "arrow", "freehand"]),
    a_image_annotation_coordinates: z.string().min(1, "Annotatiedata is verplicht"),
    a_image_annotation: z.string().max(500).optional(),
    a_image_annotation_bcs: z
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
        .optional(),
    a_image_annotation_order: z.number().int().min(0).optional(),
})

export type AddAnnotationFormValues = z.infer<typeof addAnnotationSchema>
