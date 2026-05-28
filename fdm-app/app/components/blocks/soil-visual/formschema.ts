import { z } from "zod"

const bcsScore = z
    .number()
    .int()
    .min(0)
    .max(2)
    .nullable()
    .optional()

export const visualSoilAssessmentSchema = z.object({
    b_id: z.string().min(1, "Perceel is verplicht"),
    date: z.coerce.date().optional(),
    assessor_name: z.string().max(255).optional(),
    assessment_type: z.enum(["kuilmeting", "bedrijfsmeting"]).optional(),
    weather_conditions: z.string().max(500).optional(),
    notes: z.string().max(2000).optional(),
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

export type VisualSoilAssessmentFormValues = z.infer<
    typeof visualSoilAssessmentSchema
>

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
    type: z.enum(["pin", "circle", "arrow", "freehand"]),
    data_json: z.string().min(1, "Annotatiedata is verplicht"),
    text: z.string().max(500).optional(),
    indicator: z
        .enum([
            "A_SS_BCS",
            "A_SC_BCS",
            "A_RD_BCS",
            "A_EW_BCS",
            "A_CC_BCS",
            "A_GS_BCS",
            "A_P_BCS",
            "A_C_BCS",
            "A_RT_BCS",
        ])
        .optional(),
    sort_order: z.number().int().min(0).optional(),
})

export type AddAnnotationFormValues = z.infer<typeof addAnnotationSchema>
