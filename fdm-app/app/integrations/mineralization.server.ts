/**
 * @file mineralization.server.ts
 *
 * Server-side orchestration layer for the Mineralisatie (Nitrogen Mineralization) feature.
 *
 * This module acts as a thin bridge between the FDM database and the calculation
 * functions in `@nmi-agro/fdm-calculator`. It is responsible for:
 * 1. Fetching the required FDM domain objects (field, soil data, cultivations, fertilizers).
 * 2. Building the NMI API request bodies via the calculator builders.
 * 3. Calling the cached calculator functions (`getNSupply`, `getDyna`).
 * 4. Farm-level aggregation (running per-field calculations in parallel).
 * 5. Generating Dutch-language user-facing insights from the results.
 *
 * **All core calculation logic, types, schemas, and error classes live in
 * `@nmi-agro/fdm-calculator/mineralisatie`.** This file re-exports the types
 * that are needed by the app's route files and components.
 */

import {
    type NSupplyComputeInput,
    assessDataCompleteness,
    buildDynaRequest,
    buildNSupplyRequest,
    getDyna,
    getNSupply,
} from "@nmi-agro/fdm-calculator"
import {
    getCultivations,
    getCultivationsForFarm,
    getCultivationsFromCatalogue,
    getCurrentSoilData,
    getCurrentSoilDataForFarm,
    getFertilizerApplicationsForFarm,
    getFertilizers,
    getField,
    getFields,
    getGrazingIntention,
    getHarvestsForFarm,
    type Timeframe,
} from "@nmi-agro/fdm-core"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { fdm } from "~/lib/fdm.server"

// Re-export types consumed by route files and UI components
export type {
    DataCompleteness,
    DynaFertilizerAdvice,
    DynaNitrogenBalance,
    DynaResult,
    DynaDailyPoint,
    NSupplyDataPoint,
    NSupplyMethod,
    NSupplyResult,
} from "@nmi-agro/fdm-calculator"
export {
    NmiApiError,
    assessDataCompleteness,
    buildNSupplyRequest,
} from "@nmi-agro/fdm-calculator"

/**
 * Result wrapper for DYNA at farm level.
 */
export type FarmDynaResult = {
    b_id: string
    b_name: string | null
    result?: import("@nmi-agro/fdm-calculator").DynaResult
    error?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a day-of-year (DOY) integer to a Dutch-locale date string.
 *
 * @param doy - Day of year (1–366).
 * @param year - Calendar year.
 * @returns Formatted date string, e.g. `"15 april"`.
 *
 * @internal
 */
function doyToDateString(doy: number, year: number): string {
    const date = new Date(year, 0)
    date.setDate(doy)
    return date.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })
}

/**
 * Builds a flat `soilData` map from the array returned by `getCurrentSoilData`,
 * and captures the sampling depth from the first entry.
 *
 * @internal
 */
function buildSoilDataMap(
    soilDataArray: Awaited<ReturnType<typeof getCurrentSoilData>>,
): {
    soilData: Record<string, number | string | null | undefined>
    soilMeta: Record<string, { source?: string; date?: Date }>
} {
    const soilData: Record<string, number | string | null | undefined> = {}
    const soilMeta: Record<string, { source?: string; date?: Date }> = {}

    if (!soilDataArray || soilDataArray.length === 0) {
        return { soilData, soilMeta }
    }

    for (const entry of soilDataArray) {
        if (entry.parameter && entry.value !== undefined) {
            soilData[entry.parameter] = entry.value as
                | number
                | string
                | null
                | undefined
            soilMeta[entry.parameter] = {
                source: entry.a_source ?? undefined,
                date: entry.b_sampling_date ?? undefined,
            }
        }
    }

    // Use depth from a_som_loi specifically
    const somEntry = soilDataArray.find((e) => e.parameter === "a_som_loi")
    if (somEntry?.a_depth_lower !== undefined) {
        soilData.a_depth_lower = somEntry.a_depth_lower
    } else if (soilDataArray[0]?.a_depth_lower !== undefined) {
        // Fallback to first if som not found
        soilData.a_depth_lower = soilDataArray[0].a_depth_lower
    }

    return { soilData, soilMeta }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches the N supply mineralization curve for a single field.
 *
 * Orchestrates the full pipeline:
 * 1. Retrieves field geometry, soil data, and cultivations from FDM.
 * 2. Assesses data completeness for the chosen method.
 * 3. Builds the nsupply API request body.
 * 4. Delegates to {@link getNSupply} (DB-cached) from `@nmi-agro/fdm-calculator`.
 *
 * Results are automatically cached in the FDM database. The cache is
 * invalidated whenever the underlying soil data, cultivations, or method changes.
 *
 * @param params.principal_id - Authenticated user / principal identifier.
 * @param params.b_id - FDM field identifier.
 * @param params.method - Mineralization model (`"minip"`, `"pmn"`, or `"century"`).
 * @param params.timeframe - Calendar year window; used to set `d_start`/`d_end` in the request.
 * @returns A fully populated {@link NSupplyResult} with 365/366 daily data points.
 * @throws `Error` if the field is not found or the NMI API key is not configured.
 * @throws {@link NmiApiError} on NMI API errors (422, 503, etc.).
 */
export async function getNSupplyForField({
    principal_id,
    b_id,
    method,
    timeframe,
    field: preFetchedField,
    soilDataArray: preFetchedSoilData,
    cultivations: preFetchedCultivations,
}: {
    principal_id: string
    b_id: string
    method: import("@nmi-agro/fdm-calculator").NSupplyMethod
    timeframe: Timeframe
    field?: Awaited<ReturnType<typeof getField>>
    soilDataArray?: Awaited<ReturnType<typeof getCurrentSoilData>>
    cultivations?: Awaited<ReturnType<typeof getCultivations>>
}): Promise<import("@nmi-agro/fdm-calculator").NSupplyResult> {
    const nmiApiKey = getNmiApiKey()
    if (!nmiApiKey) {
        throw new Error("NMI API-sleutel niet geconfigureerd")
    }

    const field = preFetchedField ?? (await getField(fdm, principal_id, b_id))
    if (!field) {
        throw new Error(`Perceel niet gevonden: ${b_id}`)
    }

    const [soilDataArray, cultivations] = await Promise.all([
        preFetchedSoilData ?? getCurrentSoilData(fdm, principal_id, b_id),
        preFetchedCultivations ?? getCultivations(fdm, principal_id, b_id),
    ])

    const { soilData, soilMeta } = buildSoilDataMap(soilDataArray)
    const completeness = assessDataCompleteness(soilData, method, soilMeta)
    const requestBody = buildNSupplyRequest(
        field,
        soilData,
        cultivations,
        method,
        timeframe,
    )

    const input: NSupplyComputeInput = {
        b_id,
        b_name: field.b_name ?? b_id,
        area: field.b_area ?? 0,
        nmiApiKey,
        requestBody,
        method,
        completeness,
        cacheDate: new Date().toLocaleDateString("en-CA"),
    }

    return getNSupply(fdm, input)
}

/**
 * Fetches N supply curves for all non-buffer fields in a farm, in parallel.
 *
 * Per-field errors are caught and returned as an {@link NSupplyResult} with an
 * `error` property set to a Dutch-language message. This ensures that a single
 * field with missing data does not prevent other fields from rendering.
 *
 * @param params.principal_id - Authenticated user / principal identifier.
 * @param params.b_id_farm - FDM farm identifier.
 * @param params.method - Mineralization model to use for all fields.
 * @param params.timeframe - Calendar year window.
 * @returns Array of {@link NSupplyResult} — one per non-buffer field.
 *   Entries with `error` set should be displayed with a warning indicator.
 */
export async function getNSupplyForFarm({
    principal_id,
    b_id_farm,
    method,
    timeframe,
}: {
    principal_id: string
    b_id_farm: string
    method: import("@nmi-agro/fdm-calculator").NSupplyMethod
    timeframe: Timeframe
}): Promise<import("@nmi-agro/fdm-calculator").NSupplyResult[]> {
    const [fields, cultivationsMap, soilDataMap] = await Promise.all([
        getFields(fdm, principal_id, b_id_farm, timeframe),
        getCultivationsForFarm(fdm, principal_id, b_id_farm),
        getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm),
    ])

    const nonBufferFields = fields.filter((f) => !f.b_bufferstrip)

    // Simple concurrency limiting: process in chunks of 10
    const CONCURRENCY = 10
    const results: import("@nmi-agro/fdm-calculator").NSupplyResult[] = []

    for (let i = 0; i < nonBufferFields.length; i += CONCURRENCY) {
        const chunk = nonBufferFields.slice(i, i + CONCURRENCY)
        const chunkResults = await Promise.all(
            chunk.map(
                async (
                    field,
                ): Promise<import("@nmi-agro/fdm-calculator").NSupplyResult> => {
                    try {
                        return await getNSupplyForField({
                            principal_id,
                            b_id: field.b_id,
                            method,
                            timeframe,
                            field,
                            soilDataArray: soilDataMap.get(field.b_id) ?? [],
                            cultivations: cultivationsMap.get(field.b_id) ?? [],
                        })
                    } catch (err) {
                        const errorMessage =
                            err instanceof Error
                                ? err.message
                                : "Onbekende fout bij ophalen mineralisatiegegevens"
                        return {
                            b_id: field.b_id,
                            b_name: field.b_name ?? field.b_id,
                            area: field.b_area ?? 0,
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
                },
            ),
        )
        results.push(...chunkResults)
    }

    return results
}

/**
 * Fetches the DYNA nitrogen advice simulation for a single field.
 *
 * Orchestrates the full pipeline:
 * 1. Retrieves field geometry, soil data, all cultivations (across all years),
 *    and crop catalogue data from FDM.
 * 2. Builds the DYNA API request body via {@link buildDynaRequest}.
 * 3. Delegates to {@link getDyna} (DB-cached) from `@nmi-agro/fdm-calculator`.
 *
 * **Important:** All cultivations are fetched without a timeframe filter so that
 * preceding-year entries appear in the rotation array. The DYNA model requires
 * historical rotation data to compute carry-over N from previous seasons.
 *
 * Results are automatically cached in the FDM database. The cache is
 * invalidated whenever cultivations, soil data, or fertilizer applications change.
 *
 * @param params.principal_id - Authenticated user / principal identifier.
 * @param params.b_id - FDM field identifier.
 * @param params.b_id_farm - FDM farm identifier (used to look up crop catalogue).
 * @param params.timeframe - Calendar year window; determines the requested calculation year.
 * @param params.farmSector - Farm sector string (e.g. `"arable"`, `"dairy"`).
 * @param params.fertilizers - Fertilizer applications for the current year,
 *   enriched with nutrient content from the fertilizer catalogue.
 * @returns A {@link DynaResult} with daily simulation data, nitrogen balance,
 *   and optional fertilizer / harvest recommendations.
 * @throws `Error` if the field is not found or the NMI API key is not configured.
 * @throws {@link NmiApiError} on NMI API errors.
 */
/**
 * Internal helper that executes a DYNA calculation for a field where all
 * inputs have already been fetched.
 *
 * @internal
 */
async function runDynaForPrefetchedField({
    field,
    soilDataArray,
    cultivations,
    applications,
    fertilizerMap,
    catalogueEntries,
    harvestsMap,
    farmSector,
    timeframe,
    nmiApiKey,
}: {
    field: Awaited<ReturnType<typeof getField>>
    soilDataArray: Awaited<ReturnType<typeof getCurrentSoilData>>
    cultivations: Awaited<ReturnType<typeof getCultivations>>
    applications: Awaited<ReturnType<typeof getFertilizerApplicationsForFarm>> extends Map<string, infer T> ? T : any
    fertilizerMap: Map<string, Awaited<ReturnType<typeof getFertilizers>>[number]>
    catalogueEntries: Awaited<ReturnType<typeof getCultivationsFromCatalogue>>
    harvestsMap: Awaited<ReturnType<typeof getHarvestsForFarm>>
    farmSector: string
    timeframe: Timeframe
    nmiApiKey: string
}): Promise<import("@nmi-agro/fdm-calculator").DynaResult> {
    if (!field) throw new Error("Veldgegevens ontbreken")

    const { soilData } = buildSoilDataMap(soilDataArray)

    // Pre-flight check: any main crop without a harvest date will cause
    // the DYNA API to return 400 "b_date_harvest is missing".
    const ongoingMainCrops = cultivations.filter(
        (c) => c.b_lu_end == null && c.b_lu_croprotation !== "catchcrop",
    )
    for (const crop of ongoingMainCrops) {
        if (!crop.b_lu) continue
        const harvests = harvestsMap.get(crop.b_lu) ?? []
        const hasDatedHarvest = harvests.some((h) => h.b_lu_harvest_date != null)
        if (!hasDatedHarvest) {
            throw new Error("Oogstdatum ontbreekt voor lopend gewas")
        }
    }

    const dynaFertilizers = applications.map((app) => {
        const props = fertilizerMap.get(app.p_id)
        return {
            p_id: app.p_id,
            p_n_rt: props?.p_n_rt ?? null,
            p_n_if: props?.p_n_if ?? null,
            p_n_of: props?.p_n_of ?? null,
            p_n_wc: props?.p_n_wc ?? null,
            p_p_rt: props?.p_p_rt ?? null,
            p_k_rt: props?.p_k_rt ?? null,
            p_dm: props?.p_dm ?? null,
            p_om: props?.p_om ?? null,
            p_date: app.p_app_date,
            p_dose: app.p_app_amount,
            p_app_method: app.p_app_method ?? null,
        }
    })

    const cultivationCodes = new Set(
        cultivations.map((c) => c.b_lu_catalogue).filter(Boolean),
    )
    const cropProperties = catalogueEntries
        .filter((e) => cultivationCodes.has(e.b_lu_catalogue))
        .map((e) => ({
            b_lu_catalogue: e.b_lu_catalogue,
            b_lu_yield: e.b_lu_yield ?? null,
            b_lu_n_harvestable: e.b_lu_n_harvestable ?? null,
            b_lu_n_residue: e.b_lu_n_residue ?? null,
        }))

    // Build harvestsByBlu for this specific field's cultivations
    const fieldHarvestsByBlu = new Map<
        string,
        { b_lu_harvest_date?: Date | null; b_lu_yield?: number | null }[]
    >()
    for (const cult of cultivations) {
        if (cult.b_lu) {
            const harvests = harvestsMap.get(cult.b_lu) ?? []
            fieldHarvestsByBlu.set(
                cult.b_lu,
                harvests.map((h) => ({
                    b_lu_harvest_date: h.b_lu_harvest_date,
                    b_lu_yield:
                        h.harvestable?.harvestable_analyses?.[0]?.b_lu_yield ??
                        null,
                })),
            )
        }
    }

    const requestBody = buildDynaRequest(
        field,
        soilData,
        cultivations,
        dynaFertilizers,
        farmSector,
        timeframe,
        cropProperties.length > 0 ? cropProperties : undefined,
        fieldHarvestsByBlu,
    )

    return getDyna(fdm, {
        b_id: field.b_id,
        nmiApiKey,
        requestBody,
        cacheDate: new Date().toLocaleDateString("en-CA"),
    })
}

/**
 * Fetches the DYNA nitrogen advice simulation for a single field.
 *
 * Orchestrates the full pipeline:
 * 1. Retrieves field geometry, soil data, all cultivations (across all years),
 *    and crop catalogue data from FDM.
 * 2. Builds the DYNA API request body via {@link buildDynaRequest}.
 * 3. Delegates to {@link getDyna} (DB-cached) from `@nmi-agro/fdm-calculator`.
 *
 * **Important:** All cultivations are fetched without a timeframe filter so that
 * preceding-year entries appear in the rotation array. The DYNA model requires
 * historical rotation data to compute carry-over N from previous seasons.
 *
 * Results are automatically cached in the FDM database. The cache is
 * invalidated whenever cultivations, soil data, or fertilizer applications change.
 *
 * @param params.principal_id - Authenticated user / principal identifier.
 * @param params.b_id - FDM field identifier.
 * @param params.b_id_farm - FDM farm identifier (used to look up crop catalogue).
 * @param params.timeframe - Calendar year window; determines the requested calculation year.
 * @param params.farmSector - Farm sector string (e.g. `"arable"`, `"dairy"`).
 * @param params.fertilizers - Fertilizer applications for the current year,
 *   enriched with nutrient content from the fertilizer catalogue.
 * @returns A {@link DynaResult} with daily simulation data, nitrogen balance,
 *   and optional fertilizer / harvest recommendations.
 * @throws `Error` if the field is not found or the NMI API key is not configured.
 * @throws {@link NmiApiError} on NMI API errors.
 */
export async function getDynaForField({
    principal_id,
    b_id,
    b_id_farm,
    timeframe,
    farmSector,
    fertilizers,
}: {
    principal_id: string
    b_id: string
    b_id_farm: string
    timeframe: Timeframe
    farmSector: string
    fertilizers?: {
        p_id: string
        p_n_rt?: number | null
        p_n_if?: number | null
        p_n_of?: number | null
        p_n_wc?: number | null
        p_p_rt?: number | null
        p_k_rt?: number | null
        p_dm?: number | null
        p_om?: number | null
        p_date?: Date | null
        p_dose?: number | null
        p_app_method?: string | null
    }[]
}): Promise<import("@nmi-agro/fdm-calculator").DynaResult> {
    const nmiApiKey = getNmiApiKey()
    if (!nmiApiKey) {
        throw new Error("NMI API-sleutel niet geconfigureerd")
    }

    const [field, soilDataArray, cultivations, catalogueEntries, harvestsMap] =
        await Promise.all([
            getField(fdm, principal_id, b_id),
            getCurrentSoilData(fdm, principal_id, b_id),
            // Fetch ALL cultivations (no timeframe) so preceding-year entries
            // appear in the DYNA rotation history
            getCultivations(fdm, principal_id, b_id),
            getCultivationsFromCatalogue(fdm, principal_id, b_id_farm),
            getHarvestsForFarm(fdm, principal_id, b_id_farm, timeframe),
        ])

    if (!field) throw new Error(`Perceel niet gevonden: ${b_id}`)

    // Reuse applications from input or fetch if missing (though usually passed in)
    const applications = (fertilizers ?? []).map((f) => ({
        p_id: f.p_id,
        p_app_date: f.p_date ?? null,
        p_app_amount: f.p_dose ?? 0,
        p_app_method: f.p_app_method ?? null,
    }))
    const fertilizerMap = new Map(
        (fertilizers ?? []).map((f) => [
            f.p_id,
            {
                p_id: f.p_id,
                p_n_rt: f.p_n_rt,
                p_n_if: f.p_n_if,
                p_n_of: f.p_n_of,
                p_n_wc: f.p_n_wc,
                p_p_rt: f.p_p_rt,
                p_k_rt: f.p_k_rt,
                p_dm: f.p_dm,
                p_om: f.p_om,
            },
        ]),
    )

    return runDynaForPrefetchedField({
        field,
        soilDataArray,
        cultivations,
        applications,
        fertilizerMap: fertilizerMap as any,
        catalogueEntries,
        harvestsMap,
        farmSector,
        timeframe,
        nmiApiKey,
    })
}

/**
 * Fetches the DYNA nitrogen advice simulation for all non-buffer fields in a farm.
 *
 * This is an optimized batch operation that fetches all required data (soil,
 * cultivations, fertilizers, harvests) for the entire farm in a few queries,
 * then maps them per-field and returns an array of independent promises.
 *
 * **Architecture:** Because DYNA calculations can take 30-60 seconds per field,
 * this function returns an array of promises. The UI can then resolve each field
 * independently (streaming) rather than waiting for the entire farm to finish.
 */
export async function getDynaForFarm({
    principal_id,
    b_id_farm,
    timeframe,
}: {
    principal_id: string
    b_id_farm: string
    timeframe: Timeframe
}): Promise<Promise<FarmDynaResult>[]> {
    const nmiApiKey = getNmiApiKey()
    if (!nmiApiKey) {
        throw new Error("NMI API-sleutel niet geconfigureerd")
    }

    const year = timeframe.start?.getFullYear() ?? new Date().getFullYear()

    // 1. Optimized batch fetching for all fields in the farm
    const [
        fields,
        isGrazing,
        applications,
        fertilizers,
        cultivations,
        soilDataArray,
        catalogueEntries,
        harvestsMap,
    ] = await Promise.all([
        getFields(fdm, principal_id, b_id_farm, timeframe),
        getGrazingIntention(fdm, principal_id, b_id_farm, year),
        getFertilizerApplicationsForFarm(
            fdm,
            principal_id,
            b_id_farm,
            timeframe,
        ),
        getFertilizers(fdm, principal_id, b_id_farm),
        getCultivationsForFarm(fdm, principal_id, b_id_farm),
        getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm),
        getCultivationsFromCatalogue(fdm, principal_id, b_id_farm),
        getHarvestsForFarm(fdm, principal_id, b_id_farm, timeframe),
    ])

    const farmSector = isGrazing ? "dairy" : "arable"
    const nonBufferFields = fields.filter((f) => !f.b_bufferstrip)
    const fertilizerMap = new Map(fertilizers.map((f) => [f.p_id, f]))

    // 3. Map each field to an independent calculation promise with concurrency limiting
    const CONCURRENCY = 5
    const activeTasks = new Array(CONCURRENCY).fill(Promise.resolve())
    let taskIndex = 0

    return nonBufferFields.map((field) => {
        const currentSlot = taskIndex % CONCURRENCY
        const task = activeTasks[currentSlot].then(
            async (): Promise<FarmDynaResult> => {
                try {
                    const result = await runDynaForPrefetchedField({
                        field,
                        soilDataArray: soilDataArray.get(field.b_id) ?? [],
                        cultivations: cultivations.get(field.b_id) ?? [],
                        applications: applications.get(field.b_id) ?? [],
                        fertilizerMap,
                        catalogueEntries,
                        harvestsMap,
                        farmSector,
                        timeframe,
                        nmiApiKey,
                    })
                    return {
                        b_id: field.b_id,
                        b_name: field.b_name ?? field.b_id,
                        result,
                    }
                } catch (err) {
                    return {
                        b_id: field.b_id,
                        b_name: field.b_name ?? field.b_id,
                        error: err instanceof Error ? err.message : String(err),
                    }
                }
            },
        )
        activeTasks[currentSlot] = task
        taskIndex++
        return task
    })
}

// ─── Insights ─────────────────────────────────────────────────────────────────

/**
 * Generates Dutch-language insights comparing a field's N supply to the farm
 * average and reporting season progress.
 *
 * This is a presentation-layer helper — it produces user-facing text strings
 * suitable for display in an "Inzicht" card on the field detail page.
 *
 * **Rules:**
 * - If `totalAnnualN` is >20% above `farmAvgN`: warn about potential over-supply.
 * - If `totalAnnualN` is >20% below `farmAvgN`: suggest improving organic matter.
 * - If `completeness.score < 70`: advise a more comprehensive soil analysis.
 * - Always: report current-season progress (N mineralised to date vs. remaining).
 *
 * @param nsupply - The N supply result for the field.
 * @param farmAvgN - Weighted farm-average annual N mineralisation (kg N/ha).
 *   Pass `undefined` when not yet available (e.g. farm-level call still pending).
 * @param currentDoy - Day of year to use as "today" (1–366).
 * @returns Array of Dutch insight strings. May be empty if no noteworthy conditions.
 */
export function generateInsights(
    nsupply: import("@nmi-agro/fdm-calculator").NSupplyResult,
    farmAvgN: number | undefined,
    currentDoy: number,
    year: number,
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
        const date = doyToDateString(currentDoy, year)
        insights.push(
            `Op ${date} is circa ${Math.round(currentPoint.d_n_supply_actual)} kg N/ha gemineraliseerd. Tot einde groeiseizoen wordt nog ~${Math.round(remaining)} kg N/ha verwacht.`,
        )
    }

    return insights
}
