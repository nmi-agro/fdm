/**
 * @packageDocumentation
 * @module mineralization/builders
 *
 * Request body builders for the NMI Mineralisatie API endpoints.
 *
 * These pure functions transform FDM domain objects (already fetched from the
 * database by the caller) into the JSON request bodies expected by:
 * - `POST /bemestingsplan/nsupply` — {@link buildNSupplyRequest}
 * - `POST /bemestingsplan/dyna` — {@link buildDynaRequest}
 *
 * No database access is performed here. All required FDM data must be passed
 * in by the caller.
 */

import type { Timeframe } from "@nmi-agro/fdm-core"
import type { NSupplyMethod } from "./types"

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Determines the main cultivation for a given year using the "May 15th" rule.
 *
 * The NMI models expect one principal cultivation per rotation year. This rule
 * identifies the crop that is active on May 15th of the specified year. If no
 * cultivation spans that date (e.g. a late-starting crop), the function falls
 * back to the first non-catchcrop in the year, then to any cultivation.
 *
 * When multiple cultivations overlap May 15th, the most recently started one
 * takes precedence (sorted descending by `b_lu_start`).
 *
 * @param cultivations - All cultivations for the given year.
 * @param year - Calendar year to evaluate (e.g. `2026`).
 * @returns The main cultivation for the year, or `undefined` if the list is empty.
 *
 * @internal
 */
export function getMainCultivation<
    T extends {
        b_lu_catalogue?: string | null
        b_lu_start?: Date | null
        b_lu_end?: Date | null
        b_lu_croprotation?: string | null
    },
>(cultivations: T[], year: number): T | undefined {
    // Use 12:00 noon to avoid timezone edge cases at midnight
    const targetDate = new Date(`${year}-05-15T12:00:00`)

    // 1. First priority: a non-catchcrop that spans May 15th
    // If multiple candidates span the date, pick the one with the most recent start date.
    const activeMainOnMay15 = cultivations
        .filter(
            (c) =>
                c.b_lu_start &&
                c.b_lu_croprotation !== "catchcrop" &&
                (c.b_lu_end ?? targetDate) >= targetDate &&
                c.b_lu_start <= targetDate,
        )
        .reduce<T | undefined>(
            (best, c) =>
                !best ||
                (c.b_lu_start?.getTime() ?? 0) >
                    (best.b_lu_start?.getTime() ?? 0)
                    ? c
                    : best,
            undefined,
        )
    if (activeMainOnMay15) return activeMainOnMay15

    // 2. Second priority: any crop that spans May 15th (including catchcrops)
    const activeAnyOnMay15 = cultivations
        .filter(
            (c) =>
                c.b_lu_start &&
                (c.b_lu_end ?? targetDate) >= targetDate &&
                c.b_lu_start <= targetDate,
        )
        .reduce<T | undefined>(
            (best, c) =>
                !best ||
                (c.b_lu_start?.getTime() ?? 0) >
                    (best.b_lu_start?.getTime() ?? 0)
                    ? c
                    : best,
            undefined,
        )
    if (activeAnyOnMay15) return activeAnyOnMay15

    // 3. Fallback: first non-catchcrop in the year, then any crop
    return (
        cultivations.find((c) => c.b_lu_croprotation !== "catchcrop") ??
        cultivations[0]
    )
}

// ─── N-Supply request builder ─────────────────────────────────────────────────

/**
 * Builds the JSON request body for `POST /bemestingsplan/nsupply`.
 *
 * Maps FDM field, soil, and cultivation data to the flat parameter structure
 * expected by the NMI nsupply endpoint.
 *
 * **Soil parameter mapping:**
 * | FDM parameter | API field | Unit |
 * |---------------|-----------|------|
 * | `a_som_loi` | `a_som_loi` | % |
 * | `a_clay_mi` | `a_clay_mi` | % |
 * | `a_silt_mi` | `a_silt_mi` | % |
 * | `a_sand_mi` | `a_sand_mi` | % |
 * | `a_c_of` | `a_c_of` | g C/kg |
 * | `a_cn_fr` | `a_cn_fr` | — |
 * | `a_n_rt` | `a_n_rt` | mg N/kg |
 * | `a_n_pmn` | `a_n_pmn` | mg N/kg |
 * | `b_soiltype_agr` | `b_soiltype_agr` | — |
 * | `a_depth_lower` | `a_depth` | m (default `0.3`) |
 *
 * The BRP crop code is extracted from `b_lu_catalogue` of the main crop in the
 * requested timeframe. We strip the `"nl_"` prefix and convert to an integer.
 *
 * @example
 * ```typescript
 * const body = buildNSupplyRequest(
 *   { b_centroid: [5.585, 53.288] },
 *   { a_som_loi: 3.5, a_clay_mi: 10, a_silt_mi: 20, a_depth_lower: 0.3 },
 *   [{ b_lu_catalogue: "nl_256", b_lu_start: new Date("2026-04-01") }],
 *   "minip",
 *   { start: new Date("2026-01-01"), end: new Date("2026-12-31") },
 * )
 * ```
 *
 * @param field - Basic field geometry (centroid required for lat/lon).
 * @param soilData - Flat map of soil parameter values from `getCurrentSoilData`.
 * @param cultivations - Cultivations on the field (used to derive BRP code).
 * @param method - Mineralization model to request.
 * @param timeframe - Calendar year timeframe; `start` and `end` set `d_start`/`d_end`.
 * @returns A plain object suitable for `JSON.stringify` and sending to the API.
 */
export function buildNSupplyRequest(
    field: {
        /** [longitude, latitude] in WGS84 */
        b_centroid?: [number, number] | null
        b_area?: number | null
    },
    soilData: Record<string, number | string | null | undefined>,
    cultivations: {
        b_lu_catalogue?: string | null
        b_lu_start?: Date | null
        b_lu_end?: Date | null
        b_lu_croprotation?: string | null
    }[],
    method: NSupplyMethod,
    timeframe: Timeframe,
): Record<string, unknown> {
    const centroid = field.b_centroid
    const a_lon = centroid ? centroid[0] : undefined
    const a_lat = centroid ? centroid[1] : undefined

    // Determine the main crop for the requested year to extract the BRP code.
    const year = timeframe.start?.getFullYear() ?? new Date().getFullYear()
    const mainCrop = getMainCultivation(cultivations, year)

    const b_lu_brp = (() => {
        const code = (mainCrop?.b_lu_catalogue ?? "").replace(/^nl_/, "")
        const parsed = Number.parseInt(code, 10)
        return Number.isNaN(parsed) ? undefined : parsed
    })()

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

// ─── DYNA request builder ─────────────────────────────────────────────────────

/**
 * Builds the JSON request body for `POST /bemestingsplan/dyna`.
 *
 * Constructs the nested `field / farm / crop_properties / fertilizer_properties`
 * structure required by the DYNA endpoint.
 *
 * **Rotation building rules:**
 * 1. Cultivations are grouped by `b_lu_start` calendar year.
 * 2. The main crop per year is selected using the May 15th rule
 *    (see {@link getMainCultivation}).
 * 3. Catchcrops (`b_lu_croprotation === "catchcrop"`) are converted to
 *    `b_lu_green` + `b_date_green_incorporation` on the same year's entry —
 *    they do **not** become a separate rotation entry.
 * 4. Fertilizer amendments are only attached to the current calendar year
 *    (i.e. `timeframe.start.getFullYear()`). Preceding years have empty
 *    amendment arrays.
 * 5. If no cultivations are found at all, a minimal placeholder entry is
 *    generated for the requested year so the API call can still proceed.
 *
 * **Harvests array:**
 * Each rotation entry includes a `harvests` array with one element containing
 * the harvest date and optionally the yield (looked up from `cropProperties`).
 *
 * **Fertilizer properties deduplication:**
 * If the same `p_id` appears in multiple applications, only the first occurrence
 * is included in `fertilizer_properties`.
 *
 * @example
 * ```typescript
 * const body = buildDynaRequest(
 *   { b_id: "field_1", b_centroid: [5.585, 53.288] },
 *   { a_som_loi: 1.5, a_clay_mi: 10, a_silt_mi: 25, a_depth_lower: 0.3 },
 *   cultivations,
 *   fertilizerApplications,
 *   "arable",
 *   { start: new Date("2026-01-01"), end: new Date("2026-12-31") },
 *   cropProperties,
 * )
 * ```
 *
 * @param field - Field geometry and identifier.
 * @param soilData - Flat map of soil parameter values from `getCurrentSoilData`.
 * @param cultivations - **All** cultivations for the field across all years
 *   (no timeframe filter). Preceding-year entries are required for the rotation history.
 * @param fertilizers - Fertilizer applications for the field (current year only, with
 *   application date, dose, method, and nutrient content).
 * @param farmSector - Farm sector string sent to the API (e.g. `"arable"`, `"dairy"`).
 *   Defaults to `"arable"` if empty.
 * @param timeframe - Calendar year timeframe; the `start` year determines the
 *   requested calculation year.
 * @param cropProperties - Optional catalogue entries for the cultivations on the field,
 *   used to populate `b_lu_yield` in harvests and `crop_properties`.
 * @returns A plain object suitable for `JSON.stringify` and sending to the API.
 */
export function buildDynaRequest(
    field: {
        b_id?: string | null
        b_centroid?: [number, number] | null
        b_area?: number | null
    },
    soilData: Record<string, number | string | null | undefined>,
    cultivations: {
        b_lu?: string | null
        b_lu_catalogue?: string | null
        b_lu_start?: Date | null
        b_lu_end?: Date | null
        b_lu_croprotation?: string | null
        m_cropresidue?: boolean | null
    }[],
    fertilizers: {
        p_id: string
        /** Total N content (g N/kg) */
        p_n_rt?: number | null
        /** Inorganic N fraction */
        p_n_if?: number | null
        /** Organic N fraction */
        p_n_of?: number | null
        /** Water content (kg/kg) */
        p_n_wc?: number | null
        /** Total P content (g P2O5/kg) */
        p_p_rt?: number | null
        /** Total K content (g K2O/kg) */
        p_k_rt?: number | null
        /** Dry matter content (%) */
        p_dm?: number | null
        /** Organic matter content (%) */
        p_om?: number | null
        /** Application date */
        p_date?: Date | null
        /** Applied dose (kg/ha or m³/ha) */
        p_dose?: number | null
        /** Application method (e.g. `"broadcasting"`, `"injection"`) */
        p_app_method?: string | null
    }[],
    farmSector: string,
    timeframe: Timeframe,
    cropProperties?: {
        b_lu_catalogue: string
        b_lu_yield?: number | null
        b_lu_n_harvestable?: number | null
        b_lu_n_residue?: number | null
    }[],
    harvestsByBlu?: Map<
        string,
        { b_lu_harvest_date?: Date | null; b_lu_yield?: number | null }[]
    >,
): Record<string, unknown> {
    const centroid = field.b_centroid
    const a_lon = centroid ? centroid[0] : undefined
    const a_lat = centroid ? centroid[1] : undefined
    const year = timeframe.start?.getFullYear() ?? new Date().getFullYear()

    const fieldObj: Record<string, unknown> = {}
    if (field.b_id) fieldObj.b_id = field.b_id
    if (a_lat !== undefined) fieldObj.a_lat = a_lat
    if (a_lon !== undefined) fieldObj.a_lon = a_lon

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
            fieldObj[param] = value
        }
    }

    const aDepthLower = soilData.a_depth_lower
    fieldObj.a_depth =
        aDepthLower !== null && aDepthLower !== undefined
            ? Number(aDepthLower)
            : 0.3

    // Build amendments list — only applications from the current calculation year
    const amendments = fertilizers
        .filter(
            (f) =>
                f.p_date !== null &&
                f.p_date !== undefined &&
                f.p_date.getFullYear() === year,
        )
        .map((f) => ({
            p_id: f.p_id,
            p_dose: f.p_dose ?? 0,
            p_app_method: f.p_app_method ?? "broadcasting",
            p_date_fertilization: f.p_date?.toISOString().split("T")[0],
        }))

    // Build rotation array — only include the current calculation year
    // This ensures the simulation starts at 0 on January 1st of this year.
    const rotation: Record<string, unknown>[] = [year]
        .map((rotationYear) => {
            const yearStart = new Date(rotationYear, 0, 1)
            const yearEnd = new Date(rotationYear, 11, 31, 23, 59, 59, 999)
            const yearCultivations = cultivations.filter(
                (c) =>
                    c.b_lu_catalogue &&
                    c.b_lu_start != null &&
                    c.b_lu_start <= yearEnd &&
                    (c.b_lu_end == null || c.b_lu_end >= yearStart),
            )

            // Select main crop using May 15th rule
            const mainCrop = getMainCultivation(yearCultivations, rotationYear)

            if (!mainCrop?.b_lu_catalogue) return null

            // Look up yield from crop_properties for the harvests array
            const cropProp = cropProperties?.find(
                (cp) => cp.b_lu_catalogue === mainCrop.b_lu_catalogue,
            )

            // Prefer actual harvest records; fall back to inferring a single
            // harvest from b_lu_end when no records are available.
            const actualHarvestRecords =
                mainCrop.b_lu && harvestsByBlu
                    ? (harvestsByBlu.get(mainCrop.b_lu) ?? [])
                    : []
            const harvests =
                actualHarvestRecords.length > 0
                    ? actualHarvestRecords
                          .filter((h) => h.b_lu_harvest_date != null)
                          .map((h) => ({
                              b_date_harvest: h.b_lu_harvest_date
                                  ?.toISOString()
                                  .split("T")[0],
                              ...(h.b_lu_yield != null
                                  ? { b_lu_yield: h.b_lu_yield }
                                  : cropProp?.b_lu_yield != null
                                    ? { b_lu_yield: cropProp.b_lu_yield }
                                    : {}),
                          }))
                    : mainCrop.b_lu_end
                      ? [
                            {
                                b_date_harvest: mainCrop.b_lu_end
                                    .toISOString()
                                    .split("T")[0],
                                ...(cropProp?.b_lu_yield != null
                                    ? { b_lu_yield: cropProp.b_lu_yield }
                                    : {}),
                            },
                        ]
                      : []

            // Catchcrop becomes green manure on the same rotation entry
            const greenManure = yearCultivations.find(
                (c) => c.b_lu_croprotation === "catchcrop" && c !== mainCrop,
            )

            return {
                year: rotationYear,
                b_lu: mainCrop.b_lu_catalogue,
                b_lu_start: mainCrop.b_lu_start?.toISOString().split("T")[0],
                harvests,
                ...(mainCrop.m_cropresidue != null
                    ? { m_cropresidue: mainCrop.m_cropresidue }
                    : {}),
                ...(greenManure?.b_lu_catalogue
                    ? {
                          b_lu_green: greenManure.b_lu_catalogue,
                          b_date_green_incorporation: greenManure.b_lu_end
                              ?.toISOString()
                              .split("T")[0],
                      }
                    : {}),
                irrigation: [],
                // Amendments only on the matching calendar year
                amendments: rotationYear === year ? amendments : [],
            }
        })
        .filter((entry) => entry !== null)

    // Fallback: ensure at least one rotation entry so the API call can proceed
    if (rotation.length === 0) {
        rotation.push({
            year,
            b_lu: undefined,
            b_lu_start: timeframe.start?.toISOString().split("T")[0],
            harvests: [],
            irrigation: [],
            amendments,
        })
    }

    fieldObj.rotation = rotation

    // Deduplicate fertilizers by p_id; include all available nutrient properties
    const seenIds = new Set<string>()
    const fertilizer_properties = fertilizers
        .filter((f) => {
            if (seenIds.has(f.p_id)) return false
            seenIds.add(f.p_id)
            return true
        })
        .map((f) => {
            const props: Record<string, number | string | null> = {
                p_id: f.p_id,
                p_n_rt: f.p_n_rt ?? 0,
            }
            if (f.p_n_if != null) props.p_n_if = f.p_n_if
            if (f.p_n_of != null) props.p_n_of = f.p_n_of
            if (f.p_n_wc != null) props.p_n_wc = f.p_n_wc
            if (f.p_p_rt != null) props.p_p_rt = f.p_p_rt
            if (f.p_k_rt != null) props.p_k_rt = f.p_k_rt
            if (f.p_dm != null) props.p_dm = f.p_dm
            if (f.p_om != null) props.p_om = f.p_om
            return props
        })

    const builtCropProperties =
        cropProperties && cropProperties.length > 0
            ? cropProperties
                  .filter((cp) => cp.b_lu_catalogue)
                  .map((cp) => ({
                      b_lu: cp.b_lu_catalogue,
                      b_lu_yield: cp.b_lu_yield ?? null,
                      b_lu_n_harvestable: cp.b_lu_n_harvestable ?? null,
                      b_lu_n_residue: cp.b_lu_n_residue ?? null,
                  }))
            : null

    return {
        field: fieldObj,
        farm: { sector: farmSector || "arable" },
        crop_properties: builtCropProperties,
        fertilizer_properties:
            fertilizer_properties.length > 0 ? fertilizer_properties : null,
    }
}
