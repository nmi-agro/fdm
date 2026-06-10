import type { BcsColor } from "~/components/blocks/soil-visual/bcs-color-utils"

const BCS_VISUAL_KEYS = [
    "a_ss_bcs",
    "a_sc_bcs",
    "a_rd_bcs",
    "a_ew_bcs",
    "a_cc_bcs",
    "a_gs_bcs",
    "a_p_bcs",
    "a_c_bcs",
    "a_rt_bcs",
] as const

export { BCS_VISUAL_KEYS }

export type BcsVisualKey = (typeof BCS_VISUAL_KEYS)[number]
export type BcsLabKey = "a_ph_bcs" | "a_som_bcs"
export type BcsIndicatorKey = BcsVisualKey | BcsLabKey

export interface BcsAnalysisLike {
    a_ss_bcs?: number | null
    a_sc_bcs?: number | null
    a_rd_bcs?: number | null
    a_ew_bcs?: number | null
    a_cc_bcs?: number | null
    a_gs_bcs?: number | null
    a_p_bcs?: number | null
    a_c_bcs?: number | null
    a_rt_bcs?: number | null
}

export function isBcsAnalysis(analysis: BcsAnalysisLike): boolean {
    return BCS_VISUAL_KEYS.some((key) => analysis[key] != null)
}

export interface WizardImage {
    tempId: string
    objectKey: string
    url: string
    caption?: string
}

export type AnnotationType = "pin" | "circle" | "arrow" | "freehand"

export interface PinCoords {
    x: number
    y: number
}

export interface CircleCoords {
    cx: number
    cy: number
    r: number
}

export interface ArrowCoords {
    x1: number
    y1: number
    x2: number
    y2: number
}

export interface FreehandCoords {
    points: Array<{ x: number; y: number }>
}

export type AnnotationCoords = PinCoords | CircleCoords | ArrowCoords | FreehandCoords

export interface WizardAnnotation {
    tempId: string
    tempImageId: string
    type: AnnotationType
    coordinates: AnnotationCoords
    text?: string
    bcsIndicator?: BcsVisualKey
}

export interface BcsSavePayload {
    a_date: string
    b_sampling_date: string
    a_depth_lower: number
    scores: Partial<Record<BcsVisualKey, 0 | 1 | 2>>
    images: WizardImage[]
    annotations: WizardAnnotation[]
}

export interface BcsIndicatorMeta {
    key: BcsIndicatorKey
    name: string
    description: string
    weight: 1 | 2 | 3
    direction: "positive" | "negative"
    source: "field" | "lab"
}

export const BCS_FIELD_INDICATORS = [
    {
        key: "a_cc_bcs",
        name: "Gewasbedekking",
        description: "% bodemoppervlak bedekt door vegetatie",
        weight: 2,
        direction: "positive",
        source: "field",
    },
    {
        key: "a_rd_bcs",
        name: "Beworteling",
        description: "Bewortelingsdiepte, dichtheid en vertakking",
        weight: 3,
        direction: "positive",
        source: "field",
    },
    {
        key: "a_sc_bcs",
        name: "Verdichting ondergrond",
        description: "Weerstand, plaatstructuren en kruimeligheid",
        weight: 3,
        direction: "positive",
        source: "field",
    },
    {
        key: "a_ew_bcs",
        name: "Regenwormen",
        description: "Aantal regenwormen in de profielkuil",
        weight: 3,
        direction: "positive",
        source: "field",
    },
    {
        key: "a_ss_bcs",
        name: "Bodemstructuur",
        description: "Kluitgrootte en aggregaatstabiliteit",
        weight: 3,
        direction: "positive",
        source: "field",
    },
    {
        key: "a_gs_bcs",
        name: "Gekleurde vlekken",
        description: "Roest-, blauwe of grijze vlekken",
        weight: 1,
        direction: "positive",
        source: "field",
    },
    {
        key: "a_p_bcs",
        name: "Plasvorming",
        description: "Water dat op het oppervlak blijft staan",
        weight: 2,
        direction: "negative",
        source: "field",
    },
    {
        key: "a_c_bcs",
        name: "Scheuren",
        description: "Zichtbare scheuren in de toplaag",
        weight: 1,
        direction: "negative",
        source: "field",
    },
    {
        key: "a_rt_bcs",
        name: "Spoorvorming",
        description: "Wielsporen of vertrapping",
        weight: 1,
        direction: "negative",
        source: "field",
    },
] as const satisfies readonly BcsIndicatorMeta[]

export const BCS_LAB_INDICATORS = [
    {
        key: "a_ph_bcs",
        name: "Zuurgraad (pH)",
        description: "Afgeleid uit de meest recente laboratoriumanalyse",
        weight: 3,
        direction: "positive",
        source: "lab",
    },
    {
        key: "a_som_bcs",
        name: "Organische stof",
        description: "Afgeleid uit de meest recente laboratoriumanalyse",
        weight: 3,
        direction: "positive",
        source: "lab",
    },
] as const satisfies readonly BcsIndicatorMeta[]

export const BCS_INDICATORS = [
    ...BCS_FIELD_INDICATORS,
    ...BCS_LAB_INDICATORS,
] as const satisfies readonly BcsIndicatorMeta[]

export const BCS_VISUAL_INDICATOR_MAP = Object.fromEntries(
    BCS_FIELD_INDICATORS.map((indicator) => [indicator.key, indicator]),
) as Record<BcsVisualKey, (typeof BCS_FIELD_INDICATORS)[number]>

export function getBcsScoreColor(d_bcs: number): BcsColor {
    if (d_bcs < 10) return "red"
    if (d_bcs < 20) return "orange"
    if (d_bcs < 30) return "yellow"
    if (d_bcs < 40) return "green"
    return "emerald"
}

export function getBcsScoreLabel(d_bcs: number): string {
    if (d_bcs < 10) return "Slecht"
    if (d_bcs < 20) return "Onvoldoende"
    if (d_bcs < 30) return "Matig"
    if (d_bcs < 40) return "Goed"
    return "Zeer goed"
}

export interface BcsPreviewResult {
    d_bcs: number
    i_bcs: number
    scoreColor: BcsColor
    scoreLabel: string
    a_ph_bcs: number | null
    a_som_bcs: number | null
}
