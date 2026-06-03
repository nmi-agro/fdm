import { findHoofdteelt } from "../shared/hoofdteelt"
import type { OmCropCategory } from "./index"

/** Minimal cultivation shape required to derive crop plan fractions. */
export interface CultivationForCropPlan {
    b_lu_catalogue: string
    /** b_lu_croprotation from the cultivations catalogue. */
    b_lu_croprotation?: string | null
    b_lu_start?: Date | string | null
    b_lu_end?: Date | string | null
}

/** Derived crop plan fractions and metadata used for pH and OM BCS scoring. */
export interface CropPlanFractions {
    d_cp_starch: number
    d_cp_potato: number
    d_cp_sugarbeet: number
    d_cp_grass: number
    d_cp_mais: number
    b_lu_is_clover: boolean
    om_crop_category: OmCropCategory
}

/** Maps b_lu_croprotation to the d_cp_* bucket it counts towards. */
const ROTATION_TO_BUCKET: Partial<
    Record<
        string,
        keyof Pick<
            CropPlanFractions,
            | "d_cp_starch"
            | "d_cp_potato"
            | "d_cp_sugarbeet"
            | "d_cp_grass"
            | "d_cp_mais"
        >
    >
> = {
    starch: "d_cp_starch",
    potato: "d_cp_potato",
    sugarbeet: "d_cp_sugarbeet",
    grass: "d_cp_grass",
    clover: "d_cp_grass",
    alfalfa: "d_cp_grass",
    nature: "d_cp_grass",
    maize: "d_cp_mais",
}

const GRASS_ROTATION_TYPES = new Set(["grass", "clover", "alfalfa"])

/**
 * Derives crop plan fractions (d_cp_*) and crop category from cultivation history.
 *
 * Uses `findHoofdteelt` per calendar year up to and including `bcsYear` to identify
 * the main crop (hoofdteelt) for each year. The fraction for each crop type is the
 * share of years where that crop was the hoofdteelt.
 *
 * `om_crop_category` is based on the hoofdteelt of `bcsYear` itself.
 * `b_lu_is_clover` is true when the bcsYear hoofdteelt has croprotation "clover".
 */
export function deriveCropPlanFractions(
    cultivations: CultivationForCropPlan[],
    bcsYear: number,
): CropPlanFractions {
    const empty: CropPlanFractions = {
        d_cp_starch: 0,
        d_cp_potato: 0,
        d_cp_sugarbeet: 0,
        d_cp_grass: 0,
        d_cp_mais: 0,
        b_lu_is_clover: false,
        om_crop_category: "akkerbouw",
    }

    if (cultivations.length === 0) return empty

    // Collect all years (up to and including bcsYear) that have at least one cultivation
    const years = new Set<number>()
    for (const c of cultivations) {
        if (!c.b_lu_start) continue
        const y = new Date(c.b_lu_start).getFullYear()
        if (y <= bcsYear) years.add(y)
    }
    if (years.size === 0) return empty

    // Build catalogue → croprotation lookup (first occurrence wins)
    const catalogueToRotation = new Map<string, string | null>()
    for (const c of cultivations) {
        if (!catalogueToRotation.has(c.b_lu_catalogue)) {
            catalogueToRotation.set(c.b_lu_catalogue, c.b_lu_croprotation ?? null)
        }
    }

    const cultivationsForHoofdteelt = cultivations.map((c) => ({
        b_lu_catalogue: c.b_lu_catalogue,
        b_lu_start: c.b_lu_start ? new Date(c.b_lu_start) : null,
        b_lu_end: c.b_lu_end ? new Date(c.b_lu_end) : null,
    }))

    const counts = {
        d_cp_starch: 0,
        d_cp_potato: 0,
        d_cp_sugarbeet: 0,
        d_cp_grass: 0,
        d_cp_mais: 0,
    }
    let bcsYearRotation: string | null = null

    for (const year of Array.from(years).sort((a, b) => a - b)) {
        const catalogue = findHoofdteelt(cultivationsForHoofdteelt, year)
        const rotation = catalogueToRotation.get(catalogue) ?? null
        const bucket = rotation ? ROTATION_TO_BUCKET[rotation] : undefined
        if (bucket) counts[bucket]++
        if (year === bcsYear) bcsYearRotation = rotation
    }

    const totalYears = years.size

    let om_crop_category: OmCropCategory = "akkerbouw"
    if (bcsYearRotation && GRASS_ROTATION_TYPES.has(bcsYearRotation)) {
        om_crop_category = "grasland"
    } else if (bcsYearRotation === "maize") {
        om_crop_category = "mais"
    } else if (bcsYearRotation === "nature") {
        om_crop_category = "natuur"
    }

    return {
        d_cp_starch: counts.d_cp_starch / totalYears,
        d_cp_potato: counts.d_cp_potato / totalYears,
        d_cp_sugarbeet: counts.d_cp_sugarbeet / totalYears,
        d_cp_grass: counts.d_cp_grass / totalYears,
        d_cp_mais: counts.d_cp_mais / totalYears,
        b_lu_is_clover: bcsYearRotation === "clover",
        om_crop_category,
    }
}
