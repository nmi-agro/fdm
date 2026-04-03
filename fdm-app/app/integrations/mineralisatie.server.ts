import {
    getCultivations,
    getCurrentSoilData,
    getField,
    getFields,
    type Timeframe,
} from "@nmi-agro/fdm-core"
import { z } from "zod"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { fdm } from "~/lib/fdm.server"

// ─── Types ────────────────────────────────────────────────────────────────────

export type NSupplyMethod = "minip" | "pmn" | "century"

export interface NSupplyDataPoint {
    doy: number
    d_n_supply_actual: number
}

export interface DataCompleteness {
    available: {
        param: string
        value: number | string
        source?: string
        date?: Date
    }[]
    missing: string[]
    estimated: string[]
    score: number // 0–100
}

export interface NSupplyResult {
    b_id: string
    b_name: string
    method: NSupplyMethod
    data: NSupplyDataPoint[]
    totalAnnualN: number // last doy value (kg N/ha/yr)
    completeness: DataCompleteness
    error?: string
}

export interface DynaDailyPoint {
    b_date_calculation: string
    b_nw_fr: number
    b_nw_fr_recommended: number
    b_nw_fr_min: number
    b_nw_fr_max: number
    b_nw: number
    b_nw_recommended: number
    b_nw_min: number
    b_nw_max: number
    b_n_uptake: number
    b_n_uptake_recommended: number
    b_no3_leach: number
    b_no3_leach_recommended: number
}

export interface DynaNitrogenBalance {
    b_n_supply_artificial: number
    b_n_supply_organic: number
    b_n_supply_green_manure: number
    b_n_supply_preceding_crop: number
    b_n_supply_total: number
}

export interface DynaFertilizerAdvice {
    b_n_recommended: number
    b_date_recommended: string
    b_n_remaining: number
}

export interface DynaResult {
    b_id: string
    calculationDyna: DynaDailyPoint[]
    nitrogenBalance: DynaNitrogenBalance
    fertilizingRecommendations: DynaFertilizerAdvice
    harvestingRecommendation: { b_date_harvest: string }
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const nsupplyDataPointSchema = z.object({
    doy: z.number().int().min(1).max(366),
    d_n_supply_actual: z.number(),
})

const nsupplyResponseSchema = z.object({
    data: z.array(nsupplyDataPointSchema),
})

const dynaDailyPointSchema = z.object({
    b_date_calculation: z.string(),
    b_nw_fr: z.number(),
    b_nw_fr_recommended: z.number(),
    b_nw_fr_min: z.number(),
    b_nw_fr_max: z.number(),
    b_nw: z.number(),
    b_nw_recommended: z.number(),
    b_nw_min: z.number(),
    b_nw_max: z.number(),
    b_n_uptake: z.number(),
    b_n_uptake_recommended: z.number(),
    b_no3_leach: z.number(),
    b_no3_leach_recommended: z.number(),
})

const dynaResponseSchema = z.object({
    calculationDyna: z.array(dynaDailyPointSchema),
    nitrogenBalance: z.object({
        b_n_supply_artificial: z.number(),
        b_n_supply_organic: z.number(),
        b_n_supply_green_manure: z.number(),
        b_n_supply_preceding_crop: z.number(),
        b_n_supply_total: z.number(),
    }),
    fertilizingRecommendations: z.object({
        b_n_recommended: z.number(),
        b_date_recommended: z.string(),
        b_n_remaining: z.number(),
    }),
    harvestingRecommendation: z.object({
        b_date_harvest: z.string(),
    }),
})

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
    data: T
    expiresAt: number
}

const nsupplyCache = new Map<string, CacheEntry<NSupplyResult>>()
const dynaCache = new Map<string, CacheEntry<DynaResult>>()

const NSUPPLY_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const DYNA_TTL_MS = 60 * 60 * 1000 // 1 hour

function getNsupplyCacheKey(
    b_id: string,
    method: NSupplyMethod,
    year: number,
): string {
    return `nsupply:${b_id}:${method}:${year}`
}

function getDynaCacheKey(b_id: string, year: number): string {
    return `dyna:${b_id}:${year}`
}

// ─── Method-specific parameter requirements ───────────────────────────────────

const methodRequirements: Record<
    NSupplyMethod,
    { required: string[]; optional: string[] }
> = {
    minip: {
        required: ["a_som_loi", "a_clay_mi", "a_silt_mi"],
        optional: ["a_sand_mi", "b_soiltype_agr"],
    },
    pmn: {
        required: ["a_n_pmn", "a_clay_mi"],
        optional: ["a_sand_mi", "b_soiltype_agr"],
    },
    century: {
        required: ["a_c_of", "a_cn_fr", "a_clay_mi", "a_silt_mi"],
        optional: ["a_sand_mi", "b_soiltype_agr"],
    },
}

// ─── Data Completeness ────────────────────────────────────────────────────────

/**
 * Evaluates which soil parameters are available, missing, or estimated
 * for the chosen mineralization method and returns a completeness score.
 * Pass `soilMeta` to include per-parameter source and sampling date.
 */
export function assessDataCompleteness(
    soilData: Record<string, number | string | null | undefined>,
    method: NSupplyMethod,
    soilMeta?: Record<string, { source?: string; date?: Date }>,
): DataCompleteness {
    const { required, optional } = methodRequirements[method]

    const available: DataCompleteness["available"] = []
    const missing: string[] = []
    const estimated: string[] = []

    for (const param of required) {
        const value = soilData[param]
        if (value !== null && value !== undefined) {
            available.push({
                param,
                value: value as number | string,
                source: soilMeta?.[param]?.source,
                date: soilMeta?.[param]?.date,
            })
        } else {
            missing.push(param)
        }
    }

    for (const param of optional) {
        const value = soilData[param]
        if (value !== null && value !== undefined) {
            available.push({
                param,
                value: value as number | string,
                source: soilMeta?.[param]?.source,
                date: soilMeta?.[param]?.date,
            })
        } else {
            estimated.push(param)
        }
    }

    const NMI_SOURCE = "nl-other-nmi"

    const availableRequired = required.filter(
        (p) =>
            soilData[p] !== null &&
            soilData[p] !== undefined &&
            soilMeta?.[p]?.source !== NMI_SOURCE,
    ).length
    const availableOptional = optional.filter(
        (p) =>
            soilData[p] !== null &&
            soilData[p] !== undefined &&
            soilMeta?.[p]?.source !== NMI_SOURCE,
    ).length

    const score =
        required.length > 0
            ? (availableRequired / required.length) * 80 +
              (optional.length > 0
                  ? (availableOptional / optional.length) * 20
                  : 20)
            : 100

    return { available, missing, estimated, score: Math.round(score) }
}

// ─── Insights Generation ──────────────────────────────────────────────────────

/**
 * Generates Dutch-language insights comparing a field's N supply to the farm average
 * and reporting season progress.
 */
export function generateInsights(
    nsupply: NSupplyResult,
    farmAvgN: number | undefined,
    currentDoy: number,
): string[] {
    const insights: string[] = []
    const totalN = nsupply.totalAnnualN

    if (farmAvgN !== undefined && farmAvgN > 0) {
        const ratio = totalN / farmAvgN
        if (ratio > 1.2) {
            const pct = Math.round((ratio - 1) * 100)
            insights.push(
                `Het N-leverend vermogen is ${pct}% hoger dan het bedrijfsgemiddelde. Overweeg de kunstmestgift te verlagen.`,
            )
        } else if (ratio < 0.8) {
            insights.push(
                "Relatief laag N-leverend vermogen. Verhogen van het organische stofgehalte kan de mineralisatie verbeteren.",
            )
        }
    }

    if (nsupply.completeness.score < 70) {
        insights.push(
            `Betrouwbaarheid beperkt (${nsupply.completeness.score}%). Een uitgebreidere bodemanalyse wordt aanbevolen.`,
        )
    }

    const currentPoint = nsupply.data.find((d) => d.doy >= currentDoy)
    if (currentPoint) {
        const remaining = totalN - currentPoint.d_n_supply_actual
        const date = doyToDateString(currentDoy, new Date().getFullYear())
        insights.push(
            `Op ${date} is circa ${Math.round(currentPoint.d_n_supply_actual)} kg N/ha gemineraliseerd. Tot einde groeiseizoen wordt nog ~${Math.round(remaining)} kg N/ha verwacht.`,
        )
    }

    return insights
}

function doyToDateString(doy: number, year: number): string {
    const date = new Date(year, 0)
    date.setDate(doy)
    return date.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })
}

// ─── Request Builders ─────────────────────────────────────────────────────────

/**
 * Maps FDM field, soil, and cultivation data to a NMI nsupply API request body.
 */
export function buildNSupplyRequest(
    field: {
        b_centroid: [number, number] | null | undefined
        b_area?: number | null
    },
    soilData: Record<string, number | string | null | undefined>,
    cultivations: { b_lu_catalogue: string | null | undefined }[],
    method: NSupplyMethod,
    timeframe: Timeframe,
): Record<string, unknown> {
    const centroid = field.b_centroid
    const a_lon = centroid ? centroid[0] : undefined
    const a_lat = centroid ? centroid[1] : undefined

    const b_lu_brp = cultivations
        .filter((c) => c.b_lu_catalogue)
        .map((c) => {
            const code = (c.b_lu_catalogue ?? "").replace(/^nl_/, "")
            const parsed = Number.parseInt(code, 10)
            return Number.isNaN(parsed) ? undefined : parsed
        })
        .find((v) => v !== undefined)

    const body: Record<string, unknown> = {
        d_n_supply_method: method,
    }

    if (timeframe.start) {
        body.d_start = timeframe.start.toISOString().split("T")[0]
    }
    if (timeframe.end) {
        body.d_end = timeframe.end.toISOString().split("T")[0]
    }

    if (a_lat !== undefined) body.a_lat = a_lat
    if (a_lon !== undefined) body.a_lon = a_lon
    if (b_lu_brp !== undefined) body.b_lu_brp = b_lu_brp

    const soilParams = [
        "a_som_loi",
        "a_clay_mi",
        "a_silt_mi",
        "a_sand_mi",
        "a_c_of",
        "a_cn_fr",
        "a_n_rt",
        "a_n_pmn",
        "b_soiltype_agr",
    ] as const

    for (const param of soilParams) {
        const value = soilData[param]
        if (value !== null && value !== undefined) {
            body[param] = value
        }
    }

    const aDepthLower = soilData.a_depth_lower
    body.a_depth =
        aDepthLower !== null && aDepthLower !== undefined
            ? Number(aDepthLower)
            : 0.3

    return body
}

/**
 * Maps FDM data to a NMI dyna API request body.
 */
export function buildDynaRequest(
    field: {
        b_centroid: [number, number] | null | undefined
        b_area?: number | null
    },
    soilData: Record<string, number | string | null | undefined>,
    cultivations: {
        b_lu_catalogue: string | null | undefined
        b_sowing_date?: Date | null
        b_harvesting_date?: Date | null
    }[],
    fertilizers: {
        p_id: string
        p_n_rt?: number | null
        p_date?: Date | null
        p_dose?: number | null
    }[],
    farmSector: string,
    timeframe: Timeframe,
): Record<string, unknown> {
    const base = buildNSupplyRequest(
        field,
        soilData,
        cultivations,
        "minip",
        timeframe,
    )

    return {
        ...base,
        b_farm_sector: farmSector,
        fertilizations: fertilizers.map((f) => ({
            p_id: f.p_id,
            p_n_rt: f.p_n_rt ?? 0,
            p_date: f.p_date?.toISOString().split("T")[0],
            p_dose: f.p_dose ?? 0,
        })),
        cultivations: cultivations.map((c) => ({
            b_lu_brp: c.b_lu_catalogue
                ? Number.parseInt(c.b_lu_catalogue.replace(/^nl_/, ""), 10)
                : undefined,
            b_sowing_date: c.b_sowing_date?.toISOString().split("T")[0],
            b_harvesting_date: c.b_harvesting_date?.toISOString().split("T")[0],
        })),
    }
}

// ─── Core API Calls ───────────────────────────────────────────────────────────

/**
 * Fetches the N supply mineralization curve for a single field from the NMI API.
 * Results are cached for 24 hours.
 */
export async function getNSupplyForField({
    principal_id,
    b_id,
    method,
    timeframe,
}: {
    principal_id: string
    b_id: string
    method: NSupplyMethod
    timeframe: Timeframe
}): Promise<NSupplyResult> {
    const year = timeframe.start?.getFullYear() ?? new Date().getFullYear()
    const cacheKey = getNsupplyCacheKey(b_id, method, year)

    const cached = nsupplyCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data
    }

    const nmiApiKey = getNmiApiKey()
    if (!nmiApiKey) {
        throw new Error("NMI API-sleutel niet geconfigureerd")
    }

    const field = await getField(fdm, principal_id, b_id)
    if (!field) {
        throw new Error(`Perceel niet gevonden: ${b_id}`)
    }

    const soilDataArray = await getCurrentSoilData(fdm, principal_id, b_id)
    const soilData: Record<string, number | string | null | undefined> = {}
    if (soilDataArray && soilDataArray.length > 0) {
        for (const entry of soilDataArray) {
            if (entry.parameter && entry.value !== undefined) {
                soilData[entry.parameter] = entry.value as
                    | number
                    | string
                    | null
                    | undefined
            }
        }
        // Capture sampling depth from first entry
        const first = soilDataArray[0]
        if (first?.a_depth_lower !== undefined) {
            soilData.a_depth_lower = first.a_depth_lower
        }
    }

    const cultivations = await getCultivations(fdm, principal_id, b_id)

    const completeness = assessDataCompleteness(soilData, method)
    const requestBody = buildNSupplyRequest(
        field,
        soilData,
        cultivations,
        method,
        timeframe,
    )

    const response = await fetch(
        "https://api.nmi-agro.nl/bemestingsplan/nsupply",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${nmiApiKey}`,
            },
            body: JSON.stringify(requestBody),
        },
    )

    if (!response.ok) {
        const errorText = await response.text()
        if (response.status === 422) {
            throw new NmiApiError(
                422,
                `Onvoldoende bodemgegevens voor mineralisatieberekening. ${errorText}`,
            )
        }
        if (response.status === 503) {
            throw new NmiApiError(503, "NMI API is tijdelijk niet beschikbaar.")
        }
        if (response.status === 401 || response.status === 403) {
            throw new NmiApiError(
                response.status,
                "NMI API-sleutel niet geconfigureerd of verlopen.",
            )
        }
        throw new NmiApiError(
            response.status,
            `Er is een fout opgetreden bij het berekenen van de mineralisatie. ${errorText}`,
        )
    }

    const parsed = nsupplyResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
        throw new Error(
            `Ongeldig antwoord van NMI API: ${JSON.stringify(z.treeifyError(parsed.error))}`,
        )
    }

    const result: NSupplyResult = {
        b_id,
        b_name: field.b_name ?? b_id,
        method,
        data: parsed.data.data,
        totalAnnualN:
            parsed.data.data.length > 0
                ? parsed.data.data[parsed.data.data.length - 1]
                      .d_n_supply_actual
                : 0,
        completeness,
    }

    nsupplyCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + NSUPPLY_TTL_MS,
    })

    return result
}

/**
 * Fetches N supply curves for all non-buffer fields in a farm.
 * Per-field errors are caught and returned as NSupplyResult with an error property.
 */
export async function getNSupplyForFarm({
    principal_id,
    b_id_farm,
    method,
    timeframe,
}: {
    principal_id: string
    b_id_farm: string
    method: NSupplyMethod
    timeframe: Timeframe
}): Promise<NSupplyResult[]> {
    const fields = await getFields(fdm, principal_id, b_id_farm, timeframe)
    const nonBufferFields = fields.filter((f) => !f.b_bufferstrip)

    const results = await Promise.all(
        nonBufferFields.map(async (field): Promise<NSupplyResult> => {
            try {
                return await getNSupplyForField({
                    principal_id,
                    b_id: field.b_id,
                    method,
                    timeframe,
                })
            } catch (err) {
                const errorMessage =
                    err instanceof Error
                        ? err.message
                        : "Onbekende fout bij ophalen mineralisatiegegevens"
                return {
                    b_id: field.b_id,
                    b_name: field.b_name ?? field.b_id,
                    method,
                    data: [],
                    totalAnnualN: 0,
                    completeness: {
                        available: [],
                        missing: [],
                        estimated: [],
                        score: 0,
                    },
                    error: errorMessage,
                }
            }
        }),
    )

    return results
}

/**
 * Fetches the DYNA nitrogen advice simulation for a single field.
 * Results are cached for 1 hour.
 */
export async function getDynaForField({
    principal_id,
    b_id,
    timeframe,
    farmSector,
    fertilizers,
}: {
    principal_id: string
    b_id: string
    timeframe: Timeframe
    farmSector: string
    fertilizers?: {
        p_id: string
        p_n_rt?: number | null
        p_date?: Date | null
        p_dose?: number | null
    }[]
}): Promise<DynaResult> {
    const year = timeframe.start?.getFullYear() ?? new Date().getFullYear()
    const cacheKey = getDynaCacheKey(b_id, year)

    const cached = dynaCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data
    }

    const nmiApiKey = getNmiApiKey()
    if (!nmiApiKey) {
        throw new Error("NMI API-sleutel niet geconfigureerd")
    }

    const field = await getField(fdm, principal_id, b_id)
    if (!field) {
        throw new Error(`Perceel niet gevonden: ${b_id}`)
    }

    const soilDataArray = await getCurrentSoilData(fdm, principal_id, b_id)
    const soilData: Record<string, number | string | null | undefined> = {}
    if (soilDataArray && soilDataArray.length > 0) {
        for (const entry of soilDataArray) {
            if (entry.parameter && entry.value !== undefined) {
                soilData[entry.parameter] = entry.value as
                    | number
                    | string
                    | null
                    | undefined
            }
        }
        const first = soilDataArray[0]
        if (first?.a_depth_lower !== undefined) {
            soilData.a_depth_lower = first.a_depth_lower
        }
    }

    const cultivations = await getCultivations(fdm, principal_id, b_id)
    const requestBody = buildDynaRequest(
        field,
        soilData,
        cultivations,
        fertilizers ?? [],
        farmSector,
        timeframe,
    )

    const response = await fetch(
        "https://api.nmi-agro.nl/bemestingsplan/dyna",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${nmiApiKey}`,
            },
            body: JSON.stringify(requestBody),
        },
    )

    if (!response.ok) {
        const errorText = await response.text()
        if (response.status === 422) {
            throw new NmiApiError(
                422,
                `Onvoldoende gegevens voor DYNA-berekening. ${errorText}`,
            )
        }
        if (response.status === 503) {
            throw new NmiApiError(503, "NMI API is tijdelijk niet beschikbaar.")
        }
        throw new NmiApiError(
            response.status,
            `Er is een fout opgetreden bij de DYNA-berekening. ${errorText}`,
        )
    }

    const parsed = dynaResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
        throw new Error(
            `Ongeldig DYNA-antwoord van NMI API: ${JSON.stringify(z.treeifyError(parsed.error))}`,
        )
    }

    const result: DynaResult = {
        b_id,
        ...parsed.data,
    }

    dynaCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + DYNA_TTL_MS,
    })

    return result
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class NmiApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
    ) {
        super(message)
        this.name = "NmiApiError"
    }
}
