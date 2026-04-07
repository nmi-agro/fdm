// TODO: Support combining harvesting actions into a single harvestable with multiple analyses.
// Currently, each harvesting action is treated as a separate harvestable with a single analysis.
// The database schema supports combined harvests, but the functions here do not yet implement this feature.
// The current join structure is: cultivations (1) => cultivation_harvesting (M) => harvestables (1) => harvestable_sampling (1) => harvestable_analyses (1)

import { Decimal } from "decimal.js"
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm"
import { checkPermission } from "./authorization"
import type { PrincipalId } from "./authorization.types"
import * as schema from "./db/schema"
import { handleError } from "./error"
import type { FdmType } from "./fdm.types"
import type {
    Harvest,
    HarvestParameters,
    HarvestParametersDefault,
} from "./harvest.types"
import { convertHarvestParameters } from "./harvest-conversion"
import { createId } from "./id"
import type { Timeframe } from "./timeframe"

/**
 * Adds a new harvest to a cultivation.
 *
 * This function verifies the principal's permission and ensures that the designated cultivation exists
 * before adding a new harvest record. Within a single transaction, it creates associated records for the
 * harvestable, its analyses, and the corresponding sampling entry. If the cultivation allows only one harvest,
 * the function also updates its termination date to the harvest date.
 *
 * The function assumes that the harvest is not combined with another harvestable and that the analysis is performed
 * on the same day as the harvest.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The principal's ID used for permission verification.
 * @param b_lu - The cultivation ID.
 * @param b_lu_harvest_date - The date of the harvest.
 * @param properties - An object containing the harvest properties.
 * @param properties.b_lu_yield - The dry-matter yield for the harvest, in kg/ha.
 * @param properties.b_lu_yield_bruto - The gross yield of the harvest, in kg/ha.
 * @param properties.b_lu_yield_fresh - The fresh-matter yield of the harvest, in kg/ha.
 * @param properties.b_lu_tarra - The tarra percentage of the harvest (e.g., soil).
 * @param properties.b_lu_dm - The dry matter content of the harvest, in g/kg.
 * @param properties.b_lu_moist - The moisture content of the harvest, in g/kg.
 * @param properties.b_lu_uww - The underwater weight of the harvest, in g/5kg.
 * @param properties.b_lu_cp - The crude protein content of the harvest, in g/kg.
 * @param properties.b_lu_n_harvestable - The total nitrogen content in the harvestable yield (g N/kg).
 * @param properties.b_lu_n_residue - The total nitrogen content in the crop residue (g N/kg).
 * @param properties.b_lu_p_harvestable - The total phosphorus content in the harvestable yield (g P2O5/kg).
 * @param properties.b_lu_p_residue - The total phosphorus content in the crop residue (g P2O5/kg).
 * @param properties.b_lu_k_harvestable - The total potassium content in the harvestable yield (g K2O/kg).
 * @param properties.b_lu_k_residue - The total potassium content in the crop residue (g K2O/kg).
 *
 * @returns A Promise that resolves with the new harvest's unique identifier.
 *
 * @throws Error If the cultivation does not exist, permission checks fail, or any database insertion fails.
 */
export async function addHarvest(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_lu: schema.cultivationHarvestingTypeInsert["b_lu"],
    b_lu_harvest_date: schema.cultivationHarvestingTypeInsert["b_lu_harvest_date"],
    properties?: {
        b_lu_yield?: schema.harvestableAnalysesTypeInsert["b_lu_yield"]
        b_lu_yield_bruto?: schema.harvestableAnalysesTypeInsert["b_lu_yield_bruto"]
        b_lu_yield_fresh?: schema.harvestableAnalysesTypeInsert["b_lu_yield_fresh"]
        b_lu_tarra?: schema.harvestableAnalysesTypeInsert["b_lu_tarra"]
        b_lu_dm?: schema.harvestableAnalysesTypeInsert["b_lu_dm"]
        b_lu_moist?: schema.harvestableAnalysesTypeInsert["b_lu_moist"]
        b_lu_uww?: schema.harvestableAnalysesTypeInsert["b_lu_uww"]
        b_lu_cp?: schema.harvestableAnalysesTypeInsert["b_lu_cp"]
        b_lu_n_harvestable?: schema.harvestableAnalysesTypeInsert["b_lu_n_harvestable"]
        b_lu_n_residue?: schema.harvestableAnalysesTypeInsert["b_lu_n_residue"]
        b_lu_p_harvestable?: schema.harvestableAnalysesTypeInsert["b_lu_p_harvestable"]
        b_lu_p_residue?: schema.harvestableAnalysesTypeInsert["b_lu_p_residue"]
        b_lu_k_harvestable?: schema.harvestableAnalysesTypeInsert["b_lu_k_harvestable"]
        b_lu_k_residue?: schema.harvestableAnalysesTypeInsert["b_lu_k_residue"]
    },
): Promise<schema.cultivationHarvestingTypeSelect["b_id_harvesting"]> {
    try {
        await checkPermission(
            fdm,
            "cultivation",
            "write",
            b_lu,
            principal_id,
            "addHarvest",
        )

        return await fdm.transaction(async (tx: FdmType) => {
            // Validate if cultivation exists
            const cultivation = await tx
                .select({
                    b_lu_harvestcat:
                        schema.cultivationsCatalogue.b_lu_harvestcat,
                })
                .from(schema.cultivations)
                .leftJoin(
                    schema.cultivationsCatalogue,
                    eq(
                        schema.cultivations.b_lu_catalogue,
                        schema.cultivationsCatalogue.b_lu_catalogue,
                    ),
                )
                .where(eq(schema.cultivations.b_lu, b_lu))
                .limit(1)
            if (cultivation.length === 0) {
                throw new Error("Cultivation does not exist")
            }

            const b_lu_harvestable = await checkHarvestDateCompability(
                tx,
                b_lu,
                b_lu_harvest_date,
            )

            // Setup the harvestable analysis record
            const b_id_harvestable_analysis = createId()
            let harvestableAnalysis: {
                b_id_harvestable_analysis: schema.harvestableAnalysesTypeInsert["b_id_harvestable_analysis"]
                b_lu_yield?: schema.harvestableAnalysesTypeInsert["b_lu_yield"]
                b_lu_yield_bruto?: schema.harvestableAnalysesTypeInsert["b_lu_yield_bruto"]
                b_lu_yield_fresh?: schema.harvestableAnalysesTypeInsert["b_lu_yield_fresh"]
                b_lu_tarra?: schema.harvestableAnalysesTypeInsert["b_lu_tarra"]
                b_lu_dm?: schema.harvestableAnalysesTypeInsert["b_lu_dm"]
                b_lu_moist?: schema.harvestableAnalysesTypeInsert["b_lu_moist"]
                b_lu_uww?: schema.harvestableAnalysesTypeInsert["b_lu_uww"]
                b_lu_cp?: schema.harvestableAnalysesTypeInsert["b_lu_cp"]
                b_lu_n_harvestable?: schema.harvestableAnalysesTypeInsert["b_lu_n_harvestable"]
                b_lu_n_residue?: schema.harvestableAnalysesTypeInsert["b_lu_n_residue"]
                b_lu_p_harvestable?: schema.harvestableAnalysesTypeInsert["b_lu_p_harvestable"]
                b_lu_p_residue?: schema.harvestableAnalysesTypeInsert["b_lu_p_residue"]
                b_lu_k_harvestable?: schema.harvestableAnalysesTypeInsert["b_lu_k_harvestable"]
                b_lu_k_residue?: schema.harvestableAnalysesTypeInsert["b_lu_k_residue"]
            } = {
                b_id_harvestable_analysis: b_id_harvestable_analysis,
            }
            if (properties) {
                const b_lu_harvestcat = cultivation[0].b_lu_harvestcat
                const standardHarvest = convertHarvestParameters(
                    b_lu_harvestcat,
                    properties.b_lu_yield,
                    properties.b_lu_yield_bruto,
                    properties.b_lu_yield_fresh,
                    properties.b_lu_tarra,
                    properties.b_lu_moist,
                    properties.b_lu_uww,
                    properties.b_lu_dm,
                    properties.b_lu_cp,
                    properties.b_lu_n_harvestable,
                )
                harvestableAnalysis = {
                    ...harvestableAnalysis,
                    b_lu_yield: standardHarvest.b_lu_yield,
                    b_lu_yield_bruto: properties.b_lu_yield_bruto,
                    b_lu_yield_fresh: properties.b_lu_yield_fresh,
                    b_lu_tarra: properties.b_lu_tarra,
                    b_lu_dm: properties.b_lu_dm,
                    b_lu_moist: properties.b_lu_moist,
                    b_lu_uww: properties.b_lu_uww,
                    b_lu_cp: properties.b_lu_cp,
                    b_lu_n_harvestable: standardHarvest.b_lu_n_harvestable,
                    b_lu_n_residue: properties.b_lu_n_residue,
                    b_lu_p_harvestable: properties.b_lu_p_harvestable,
                    b_lu_p_residue: properties.b_lu_p_residue,
                    b_lu_k_harvestable: properties.b_lu_k_harvestable,
                    b_lu_k_residue: properties.b_lu_k_residue,
                }
            }

            // Insert the harvestable in the db
            const b_id_harvestable = createId()
            await tx.insert(schema.harvestables).values({
                b_id_harvestable: b_id_harvestable,
            })

            // Insert the harvest in the db
            const b_id_harvesting = createId()
            await tx.insert(schema.cultivationHarvesting).values({
                b_id_harvesting: b_id_harvesting,
                b_id_harvestable: b_id_harvestable,
                b_lu: b_lu,
                b_lu_harvest_date: b_lu_harvest_date,
            })

            // Terminate the cultivation if cultivation can only be harvested once
            if (b_lu_harvestable === "once") {
                await tx
                    .update(schema.cultivationEnding)
                    .set({ b_lu_end: b_lu_harvest_date })
                    .where(eq(schema.cultivationEnding.b_lu, b_lu))
            }

            // Add harvestable analysis
            await tx
                .insert(schema.harvestableAnalyses)
                .values(harvestableAnalysis)

            // Add sampling for harvestable analysis, defaults to same date as harvest
            await tx.insert(schema.harvestableSampling).values({
                b_id_harvestable: b_id_harvestable,
                b_id_harvestable_analysis: b_id_harvestable_analysis,
                b_sampling_date: b_lu_harvest_date,
            })

            return b_id_harvesting
        })
    } catch (err) {
        throw handleError(err, "Exception for addHarvest", {
            b_lu,
            b_lu_harvest_date,
            properties,
        })
    }
}

/**
 * Retrieves harvest details for a specific record.
 *
 * This function verifies the read permission for the requesting principal before
 * obtaining and returning the harvest data. An error is thrown if the harvest is not found.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - Identifier of the principal requesting the harvest.
 * @param b_id_harvesting - Unique identifier for the harvest.
 * @returns A promise that resolves with the harvest details.
 * @throws {Error} When the specified harvest record does not exist.
 */
export async function getHarvest(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_harvesting: schema.cultivationHarvestingTypeSelect["b_id_harvesting"],
): Promise<Harvest> {
    try {
        await checkPermission(
            fdm,
            "harvesting",
            "read",
            b_id_harvesting,
            principal_id,
            "getHarvest",
        )

        const harvest = getHarvestSimplified(fdm, b_id_harvesting)
        return harvest
    } catch (err) {
        throw handleError(err, "Exception for getHarvest", { b_id_harvesting })
    }
}

/**
 * Retrieves harvest details for a specified cultivation.
 *
 * This function verifies that the requesting principal has permission to access the cultivation's
 * harvest data, then fetches all harvest records in descending order by harvest date. Each record
 * is enriched with additional details via a simplified query.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - Identifier for the principal requesting the harvest details.
 * @param b_lu - Identifier of the cultivation.
 *
 * @returns A promise that resolves with an array of detailed harvest information.
 *
 * @throws {Error} If access is denied or if an error occurs during data retrieval.
 */
export async function getHarvests(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_lu: schema.cultivationHarvestingTypeSelect["b_lu"],
    timeframe?: Timeframe,
): Promise<Harvest[]> {
    try {
        await checkPermission(
            fdm,
            "cultivation",
            "read",
            b_lu,
            principal_id,
            "getHarvests",
        )

        let whereClause: SQL | undefined
        if (timeframe?.start && timeframe?.end) {
            whereClause = and(
                eq(schema.cultivationHarvesting.b_lu, b_lu),
                gte(
                    schema.cultivationHarvesting.b_lu_harvest_date,
                    timeframe.start,
                ),
                lte(
                    schema.cultivationHarvesting.b_lu_harvest_date,
                    timeframe.end,
                ),
            )
        } else if (timeframe?.start) {
            whereClause = and(
                eq(schema.cultivationHarvesting.b_lu, b_lu),
                gte(
                    schema.cultivationHarvesting.b_lu_harvest_date,
                    timeframe.start,
                ),
            )
        } else if (timeframe?.end) {
            whereClause = and(
                eq(schema.cultivationHarvesting.b_lu, b_lu),
                lte(
                    schema.cultivationHarvesting.b_lu_harvest_date,
                    timeframe.end,
                ),
            )
        } else {
            whereClause = eq(schema.cultivationHarvesting.b_lu, b_lu)
        }

        const harvests = await fdm
            .select({
                b_id_harvesting: schema.cultivationHarvesting.b_id_harvesting,
                b_lu_harvest_date:
                    schema.cultivationHarvesting.b_lu_harvest_date,
                b_lu: schema.cultivationHarvesting.b_lu,
            })
            .from(schema.cultivationHarvesting)
            .where(whereClause)
            .orderBy(desc(schema.cultivationHarvesting.b_lu_harvest_date))

        // Get details of each harvest
        const result = await Promise.all(
            harvests.map(async (harvest) => {
                const harvestDetails = getHarvestSimplified(
                    fdm,
                    harvest.b_id_harvesting,
                )
                return harvestDetails
            }),
        )

        return result
    } catch (err) {
        throw handleError(err, "Exception for getHarvests", { b_lu })
    }
}

/**
 * Retrieves all harvests for every cultivation on a farm.
 *
 * Instead of issuing multiple queries per cultivation, this function performs a single
 * joined query across `cultivationHarvesting`, `harvestables`, `harvestableSampling`,
 * `harvestableAnalyses`, `cultivationStarting`, and `fieldAcquiring` so that all
 * harvest data for the farm is fetched at once.
 * A single farm-level permission check is performed instead of one per cultivation.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param timeframe Optional timeframe to filter by harvest date.
 * @returns A Promise resolving to a Map keyed by cultivation ID (`b_lu`), with arrays of {@link Harvest} as values.
 * @alpha
 */
export async function getHarvestsForFarm(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeSelect["b_id_farm"],
    timeframe?: Timeframe,
): Promise<Map<string, Harvest[]>> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "read",
            b_id_farm,
            principal_id,
            "getHarvestsForFarm",
        )

        let whereClause: SQL | undefined
        if (timeframe?.start && timeframe?.end) {
            whereClause = and(
                eq(schema.fieldAcquiring.b_id_farm, b_id_farm),
                gte(
                    schema.cultivationHarvesting.b_lu_harvest_date,
                    timeframe.start,
                ),
                lte(
                    schema.cultivationHarvesting.b_lu_harvest_date,
                    timeframe.end,
                ),
            )
        } else if (timeframe?.start) {
            whereClause = and(
                eq(schema.fieldAcquiring.b_id_farm, b_id_farm),
                gte(
                    schema.cultivationHarvesting.b_lu_harvest_date,
                    timeframe.start,
                ),
            )
        } else if (timeframe?.end) {
            whereClause = and(
                eq(schema.fieldAcquiring.b_id_farm, b_id_farm),
                lte(
                    schema.cultivationHarvesting.b_lu_harvest_date,
                    timeframe.end,
                ),
            )
        } else {
            whereClause = eq(schema.fieldAcquiring.b_id_farm, b_id_farm)
        }

        const rows = await fdm
            .select({
                b_id_harvesting: schema.cultivationHarvesting.b_id_harvesting,
                b_lu_harvest_date:
                    schema.cultivationHarvesting.b_lu_harvest_date,
                b_lu: schema.cultivationHarvesting.b_lu,
                b_id_harvestable: schema.harvestables.b_id_harvestable,
                b_id_harvestable_analysis:
                    schema.harvestableAnalyses.b_id_harvestable_analysis,
                b_lu_yield: schema.harvestableAnalyses.b_lu_yield,
                b_lu_yield_fresh: schema.harvestableAnalyses.b_lu_yield_fresh,
                b_lu_yield_bruto: schema.harvestableAnalyses.b_lu_yield_bruto,
                b_lu_tarra: schema.harvestableAnalyses.b_lu_tarra,
                b_lu_dm: schema.harvestableAnalyses.b_lu_dm,
                b_lu_moist: schema.harvestableAnalyses.b_lu_moist,
                b_lu_uww: schema.harvestableAnalyses.b_lu_uww,
                b_lu_cp: schema.harvestableAnalyses.b_lu_cp,
                b_lu_n_harvestable:
                    schema.harvestableAnalyses.b_lu_n_harvestable,
                b_lu_n_residue: schema.harvestableAnalyses.b_lu_n_residue,
                b_lu_p_harvestable:
                    schema.harvestableAnalyses.b_lu_p_harvestable,
                b_lu_p_residue: schema.harvestableAnalyses.b_lu_p_residue,
                b_lu_k_harvestable:
                    schema.harvestableAnalyses.b_lu_k_harvestable,
                b_lu_k_residue: schema.harvestableAnalyses.b_lu_k_residue,
            })
            .from(schema.cultivationHarvesting)
            .leftJoin(
                schema.harvestables,
                eq(
                    schema.harvestables.b_id_harvestable,
                    schema.cultivationHarvesting.b_id_harvestable,
                ),
            )
            .leftJoin(
                schema.harvestableSampling,
                eq(
                    schema.harvestableSampling.b_id_harvestable,
                    schema.harvestables.b_id_harvestable,
                ),
            )
            .leftJoin(
                schema.harvestableAnalyses,
                eq(
                    schema.harvestableAnalyses.b_id_harvestable_analysis,
                    schema.harvestableSampling.b_id_harvestable_analysis,
                ),
            )
            .innerJoin(
                schema.cultivations,
                eq(schema.cultivations.b_lu, schema.cultivationHarvesting.b_lu),
            )
            .innerJoin(
                schema.cultivationStarting,
                eq(schema.cultivationStarting.b_lu, schema.cultivations.b_lu),
            )
            .innerJoin(
                schema.fieldAcquiring,
                eq(schema.fieldAcquiring.b_id, schema.cultivationStarting.b_id),
            )
            .where(whereClause)
            .orderBy(desc(schema.cultivationHarvesting.b_lu_harvest_date))

        // Reconstruct nested Harvest objects, grouping analyses by harvest ID, then by cultivation ID
        const harvestsById = new Map<string, Harvest>()
        for (const row of rows) {
            if (!row.b_lu) continue

            let harvest = harvestsById.get(row.b_id_harvesting)
            if (!harvest) {
                harvest = {
                    b_id_harvesting: row.b_id_harvesting,
                    b_lu_harvest_date: row.b_lu_harvest_date,
                    b_lu: row.b_lu,
                    harvestable: {
                        b_id_harvestable: row.b_id_harvestable ?? "",
                        harvestable_analyses: [],
                    },
                }
                harvestsById.set(row.b_id_harvesting, harvest)
            }

            if (row.b_id_harvestable_analysis) {
                harvest.harvestable.harvestable_analyses.push({
                    b_id_harvestable_analysis: row.b_id_harvestable_analysis,
                    b_lu_yield: row.b_lu_yield,
                    b_lu_yield_fresh: row.b_lu_yield_fresh,
                    b_lu_yield_bruto: row.b_lu_yield_bruto,
                    b_lu_tarra: row.b_lu_tarra,
                    b_lu_dm: row.b_lu_dm,
                    b_lu_moist: row.b_lu_moist,
                    b_lu_uww: row.b_lu_uww,
                    b_lu_cp: row.b_lu_cp,
                    b_lu_n_harvestable: row.b_lu_n_harvestable,
                    b_lu_n_residue: row.b_lu_n_residue,
                    b_lu_p_harvestable: row.b_lu_p_harvestable,
                    b_lu_p_residue: row.b_lu_p_residue,
                    b_lu_k_harvestable: row.b_lu_k_harvestable,
                    b_lu_k_residue: row.b_lu_k_residue,
                })
            }
        }

        const result = new Map<string, Harvest[]>()
        for (const harvest of harvestsById.values()) {
            const existing = result.get(harvest.b_lu)
            if (existing) {
                existing.push(harvest)
            } else {
                result.set(harvest.b_lu, [harvest])
            }
        }
        return result
    } catch (err) {
        throw handleError(err, "Exception for getHarvestsForFarm", {
            b_id_farm,
        })
    }
}

/**
 * Removes a harvest record along with its related sampling, analyses, and harvestable entries.
 *
 * This asynchronous function verifies that the principal has write permission on the specified harvest.
 * In a single transaction, it retrieves the harvest details, deletes linked sampling entries, analyses,
 * and the harvestable record, and finally removes the harvest record itself. For once-harvestable
 * cultivations, it also clears the cultivation's terminating date.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param b_id_harvesting Identifier of the harvest record to remove.
 * @throws Error if an error occurs during the transaction.
 */
export async function removeHarvest(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_harvesting: schema.cultivationHarvestingTypeSelect["b_id_harvesting"],
): Promise<void> {
    try {
        await checkPermission(
            fdm,
            "harvesting",
            "write",
            b_id_harvesting,
            principal_id,
            "removeHarvest",
        )

        return await fdm.transaction(async (tx: FdmType) => {
            const harvest = await getHarvest(tx, principal_id, b_id_harvesting)

            const b_id_harvestable = harvest.harvestable.b_id_harvestable
            const b_id_harvestable_analysis =
                harvest.harvestable.harvestable_analyses[0]
                    .b_id_harvestable_analysis
            const b_lu = harvest.b_lu

            // Delete related sampling entries
            await tx
                .delete(schema.harvestableSampling)
                .where(
                    eq(
                        schema.harvestableSampling.b_id_harvestable,
                        b_id_harvestable,
                    ),
                )

            // Delete related analyses
            await tx
                .delete(schema.harvestableAnalyses)
                .where(
                    eq(
                        schema.harvestableAnalyses.b_id_harvestable_analysis,
                        b_id_harvestable_analysis,
                    ),
                )

            // Delete the cultivationHarvesting entry
            await tx
                .delete(schema.cultivationHarvesting)
                .where(
                    eq(
                        schema.cultivationHarvesting.b_id_harvesting,
                        b_id_harvesting,
                    ),
                )

            // Delete the harvestable entry
            await tx
                .delete(schema.harvestables)
                .where(
                    eq(schema.harvestables.b_id_harvestable, b_id_harvestable),
                )

            // Check if cultivation can be harvested
            const b_lu_harvestable = await getHarvestableTypeOfCultivation(
                tx,
                b_lu,
            )

            if (b_lu_harvestable === "once") {
                // Remove terminating date for once-harvestable crops, since the harvest is being removed
                await tx
                    .update(schema.cultivationEnding)
                    .set({ b_lu_end: null, updated: new Date() })
                    .where(eq(schema.cultivationEnding.b_lu, b_lu))
            }
        })
    } catch (err) {
        throw handleError(err, "Exception for removeHarvest", {
            b_id_harvesting,
        })
    }
}

/**
 * Retrieves the harvestable type of a cultivation.
 *
 * This function queries the database to determine whether a cultivation can be harvested
 * 'once', 'multiple' times, or 'none'. This is based on the cultivation's catalogue information.
 *
 * @param tx The FDM transaction instance.
 * @param b_lu The identifier of the cultivation.
 * @returns A promise that resolves with the harvestable type ('once', 'multiple', or 'none').
 * @throws {Error} If the cultivation does not exist.
 */
export async function getHarvestableTypeOfCultivation(
    tx: FdmType,
    b_lu: schema.cultivationsTypeSelect["b_lu"],
) {
    const b_lu_harvestable = await tx
        .select({
            b_lu_harvestable: schema.cultivationsCatalogue.b_lu_harvestable,
        })
        .from(schema.cultivations)
        .leftJoin(
            schema.cultivationsCatalogue,
            eq(
                schema.cultivations.b_lu_catalogue,
                schema.cultivationsCatalogue.b_lu_catalogue,
            ),
        )
        .where(eq(schema.cultivations.b_lu, b_lu))
        .limit(1)

    if (b_lu_harvestable.length === 0) {
        throw new Error("Cultivation does not exist")
    }

    return b_lu_harvestable[0].b_lu_harvestable
}

/**
 * Validates whether the proposed harvest date fits within the cultivation's schedule.
 *
 * This function ensures that a harvest date is provided and that it falls after the sowing date. It also verifies that the cultivation is harvestable. For cultivations that support a single harvest, it checks that no previous harvest exists and that the harvest date exactly matches the terminating date. For cultivations that support multiple harvests, it ensures the harvest date occurs before the terminating date.
 *
 * @param tx The FDM transaction instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param b_lu - Identifier of the cultivation.
 * @param b_lu_harvest_date - The proposed harvest date.
 * @returns The allowed harvestable type for the cultivation (e.g., "once" or "multiple").
 *
 * @throws {Error} If the harvest date is missing, the cultivation is not harvestable, the sowing date is missing or invalid (i.e., the harvest date is not after the sowing date), the terminating date is missing, or if the harvest date violates the constraints for single or multiple harvest cultivations.
 */
export async function checkHarvestDateCompability(
    tx: FdmType,
    b_lu: schema.cultivationsTypeSelect["b_lu"],
    b_lu_harvest_date: schema.cultivationHarvestingTypeInsert["b_lu_harvest_date"],
) {
    // console.log(b_lu_harvest_date)
    if (!b_lu_harvest_date) {
        // Handle undefined dates *before* anything else
        throw new Error("Argument b_lu_harvest_date is missing")
    }

    // Check if cultivation can be harvested
    const b_lu_harvestable = await getHarvestableTypeOfCultivation(tx, b_lu)
    // console.log(b_lu_harvestable)

    if (b_lu_harvestable === "none") {
        throw new Error("Cultivation cannot be harvested")
    }

    // Check if harvest date is after sowing date
    const sowingDate = await tx
        .select({
            b_lu_start: schema.cultivationStarting.b_lu_start,
        })
        .from(schema.cultivationStarting)
        .where(eq(schema.cultivationStarting.b_lu, b_lu))
        .limit(1)

    if (sowingDate.length === 0 || sowingDate[0].b_lu_start === null) {
        throw new Error("Sowing date does not exist")
    }

    // If cultivation has harvest date before or on sowing date throw an error
    if (b_lu_harvest_date.getTime() < sowingDate[0].b_lu_start.getTime()) {
        throw new Error("Harvest date must be after or on sowing date")
    }

    const terminatingDate = await tx
        .select({
            b_lu_end: schema.cultivationEnding.b_lu_end,
        })
        .from(schema.cultivationEnding)
        .where(eq(schema.cultivationEnding.b_lu, b_lu))
        .limit(1)

    if (terminatingDate.length === 0) {
        throw new Error("Terminating date does not exist")
    }

    if (b_lu_harvestable === "once") {
        // If cultivation can only be harvested once, check if a harvest is already present
        const existingHarvest = await tx
            .select()
            .from(schema.cultivationHarvesting)
            .where(eq(schema.cultivationHarvesting.b_lu, b_lu))
            .limit(1)

        if (existingHarvest.length > 0) {
            throw new Error("Cultivation can only be harvested once")
        }

        // If cultivation can only be harvested once, check if harvest is on the same date as terminating date
        if (
            terminatingDate[0].b_lu_end &&
            b_lu_harvest_date.getTime() !==
                terminatingDate[0].b_lu_end.getTime()
        ) {
            throw new Error(
                "Harvest date must be equal to terminating date for this cultivation",
            )
        }
    }

    // If cultivation can be harvested multiple times, check if harvest is before termination date
    if (
        b_lu_harvestable === "multiple" &&
        terminatingDate[0].b_lu_end &&
        b_lu_harvest_date.getTime() > terminatingDate[0].b_lu_end.getTime()
    ) {
        throw new Error(
            "Harvest date must be before terminating date for this cultivation",
        )
    }

    return b_lu_harvestable
}

/**
 * Updates an existing harvest record.
 *
 * This function allows for the modification of harvest details. It first verifies that the principal has the necessary
 * permissions to update the harvest. Within a database transaction, it updates the harvest date and the associated
 * analysis data, such as yield and nutrient content. If the cultivation is designated as a single-harvest type,
 * the function also adjusts the cultivation's termination date to match the new harvest date.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal performing the update, for permission checking.
 * @param b_id_harvesting The unique identifier of the harvest to be updated.
 * @param b_lu_harvest_date The new date of the harvest.
 * @param properties - An object containing the harvest properties.
 * @param properties.b_lu_yield - The new dry-matter yield for the harvest, in kg/ha.
 * @param properties.b_lu_yield_bruto - The gross yield of the harvest, in kg/ha.
 * @param properties.b_lu_yield_fresh - The fresh-matter yield of the harvest, in kg/ha.
 * @param properties.b_lu_tarra - The tarra percentage of the harvest (e.g., soil).
 * @param properties.b_lu_dm - The dry matter content of the harvest, in g/kg.
 * @param properties.b_lu_moist - The moisture content of the harvest, in g/kg.
 * @param properties.b_lu_uww - The underwater weight of the harvest, in g/5kg.
 * @param properties.b_lu_cp - The crude protein content of the harvest, in g/kg.
 * @param properties.b_lu_n_harvestable - The new total nitrogen content in the harvestable yield (g N/kg).
 * @param properties.b_lu_n_residue - The new total nitrogen content in the crop residue (g N/kg).
 * @param properties.b_lu_p_harvestable - The new total phosphorus content in the harvestable yield (g P2O5/kg).
 * @param properties.b_lu_p_residue - The new total phosphorus content in the crop residue (g P2O5/kg).
 * @param properties.b_lu_k_harvestable - The new total potassium content in the harvestable yield (g K2O/kg).
 * @param properties.b_lu_k_residue - The new total potassium content in the crop residue (g K2O/kg).
 *
 * @returns A Promise that resolves when the update is complete.
 *
 * @throws Error if the harvest does not exist, permission checks fail, or any database update fails.
 */
export async function updateHarvest(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_harvesting: schema.cultivationHarvestingTypeSelect["b_id_harvesting"],
    b_lu_harvest_date: schema.cultivationHarvestingTypeInsert["b_lu_harvest_date"],
    properties?: {
        b_lu_yield?: schema.harvestableAnalysesTypeInsert["b_lu_yield"]
        b_lu_yield_bruto?: schema.harvestableAnalysesTypeInsert["b_lu_yield_bruto"]
        b_lu_yield_fresh?: schema.harvestableAnalysesTypeInsert["b_lu_yield_fresh"]
        b_lu_tarra?: schema.harvestableAnalysesTypeInsert["b_lu_tarra"]
        b_lu_dm?: schema.harvestableAnalysesTypeInsert["b_lu_dm"]
        b_lu_moist?: schema.harvestableAnalysesTypeInsert["b_lu_moist"]
        b_lu_uww?: schema.harvestableAnalysesTypeInsert["b_lu_uww"]
        b_lu_cp?: schema.harvestableAnalysesTypeInsert["b_lu_cp"]
        b_lu_n_harvestable?: schema.harvestableAnalysesTypeInsert["b_lu_n_harvestable"]
        b_lu_n_residue?: schema.harvestableAnalysesTypeInsert["b_lu_n_residue"]
        b_lu_p_harvestable?: schema.harvestableAnalysesTypeInsert["b_lu_p_harvestable"]
        b_lu_p_residue?: schema.harvestableAnalysesTypeInsert["b_lu_p_residue"]
        b_lu_k_harvestable?: schema.harvestableAnalysesTypeInsert["b_lu_k_harvestable"]
        b_lu_k_residue?: schema.harvestableAnalysesTypeInsert["b_lu_k_residue"]
    },
): Promise<void> {
    try {
        await checkPermission(
            fdm,
            "harvesting",
            "write",
            b_id_harvesting,
            principal_id,
            "updateHarvest",
        )

        return await fdm.transaction(async (tx: FdmType) => {
            const harvest = await getHarvestSimplified(tx, b_id_harvesting)
            if (!harvest) {
                throw new Error("Harvest does not exist")
            }

            const b_lu = harvest.b_lu

            // Validation logic
            if (!b_lu_harvest_date) {
                throw new Error("Argument b_lu_harvest_date is missing")
            }

            const sowingDate = await tx
                .select({
                    b_lu_start: schema.cultivationStarting.b_lu_start,
                })
                .from(schema.cultivationStarting)
                .where(eq(schema.cultivationStarting.b_lu, b_lu))
                .limit(1)

            if (sowingDate.length === 0 || !sowingDate[0].b_lu_start) {
                throw new Error("Sowing date does not exist")
            }

            if (
                b_lu_harvest_date.getTime() < sowingDate[0].b_lu_start.getTime()
            ) {
                throw new Error("Harvest date must be after or on sowing date")
            }

            const b_lu_harvestable = await getHarvestableTypeOfCultivation(
                tx,
                b_lu,
            )

            // Get the standardized harvest parameters
            const cultivation = await tx
                .select({
                    b_lu_harvestcat:
                        schema.cultivationsCatalogue.b_lu_harvestcat,
                })
                .from(schema.cultivationHarvesting)
                .leftJoin(
                    schema.cultivations,
                    eq(
                        schema.cultivations.b_lu,
                        schema.cultivationHarvesting.b_lu,
                    ),
                )
                .leftJoin(
                    schema.cultivationsCatalogue,
                    eq(
                        schema.cultivations.b_lu_catalogue,
                        schema.cultivationsCatalogue.b_lu_catalogue,
                    ),
                )
                .where(
                    eq(
                        schema.cultivationHarvesting.b_id_harvesting,
                        b_id_harvesting,
                    ),
                )
                .limit(1)
            if (cultivation.length === 0) {
                throw new Error("Cultivation catalogue not found")
            }
            const b_lu_harvestcat = cultivation[0].b_lu_harvestcat

            if (b_lu_harvestable === "multiple") {
                const terminatingDate = await tx
                    .select({
                        b_lu_end: schema.cultivationEnding.b_lu_end,
                    })
                    .from(schema.cultivationEnding)
                    .where(eq(schema.cultivationEnding.b_lu, b_lu))
                    .limit(1)

                if (
                    terminatingDate.length > 0 &&
                    terminatingDate[0].b_lu_end &&
                    b_lu_harvest_date.getTime() >
                        terminatingDate[0].b_lu_end.getTime()
                ) {
                    throw new Error(
                        "Harvest date must be before terminating date for this cultivation",
                    )
                }
            }
            // End of validation logic
            const b_id_harvestable_analysis =
                harvest.harvestable.harvestable_analyses[0]
                    .b_id_harvestable_analysis

            await tx
                .update(schema.cultivationHarvesting)
                .set({
                    b_lu_harvest_date: b_lu_harvest_date,
                    updated: new Date(),
                })
                .where(
                    eq(
                        schema.cultivationHarvesting.b_id_harvesting,
                        b_id_harvesting,
                    ),
                )

            if (properties) {
                const standardHarvest = convertHarvestParameters(
                    b_lu_harvestcat,
                    properties.b_lu_yield,
                    properties.b_lu_yield_bruto,
                    properties.b_lu_yield_fresh,
                    properties.b_lu_tarra,
                    properties.b_lu_moist,
                    properties.b_lu_uww,
                    properties.b_lu_dm,
                    properties.b_lu_cp,
                    properties.b_lu_n_harvestable,
                )
                await tx
                    .update(schema.harvestableAnalyses)
                    .set({
                        b_lu_yield: standardHarvest.b_lu_yield,
                        b_lu_yield_bruto: properties.b_lu_yield_bruto,
                        b_lu_yield_fresh: properties.b_lu_yield_fresh,
                        b_lu_tarra: properties.b_lu_tarra,
                        b_lu_moist: properties.b_lu_moist,
                        b_lu_uww: properties.b_lu_uww,
                        b_lu_dm: properties.b_lu_dm,
                        b_lu_cp: properties.b_lu_cp,
                        b_lu_n_harvestable: standardHarvest.b_lu_n_harvestable,
                        b_lu_n_residue: properties.b_lu_n_residue,
                        b_lu_p_harvestable: properties.b_lu_p_harvestable,
                        b_lu_p_residue: properties.b_lu_p_residue,
                        b_lu_k_harvestable: properties.b_lu_k_harvestable,
                        b_lu_k_residue: properties.b_lu_k_residue,
                        updated: new Date(),
                    })
                    .where(
                        eq(
                            schema.harvestableAnalyses
                                .b_id_harvestable_analysis,
                            b_id_harvestable_analysis,
                        ),
                    )
            }

            if (b_lu_harvestable === "once") {
                await tx
                    .update(schema.cultivationEnding)
                    .set({ b_lu_end: b_lu_harvest_date, updated: new Date() })
                    .where(eq(schema.cultivationEnding.b_lu, b_lu))
            }
        })
    } catch (err) {
        throw handleError(err, "Exception for updateHarvest", {
            b_id_harvesting,
            b_lu_harvest_date,
            properties,
        })
    }
}

/**
 * Retrieves simplified details of a harvest, including its associated harvestable and analysis.
 *
 * This asynchronous function queries the database for a harvest record matching the provided identifier.
 * After fetching the primary harvest information, it retrieves the related harvestable record and its analysis details.
 * If no harvest is found for the given ID, the function throws an error.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param b_id_harvesting - Unique identifier of the harvest record to retrieve.
 *
 * @returns An object containing the harvest details along with its associated harvestable and analysis data.
 *
 * @throws {Error} If the harvest record does not exist.
 *
 * @remark Currently, only one-to-one joins for harvest, harvestable, and harvestable analysis are supported.
 */
async function getHarvestSimplified(
    fdm: FdmType,
    b_id_harvesting: schema.cultivationHarvestingTypeSelect["b_id_harvesting"],
): Promise<Harvest> {
    // Get properties of the requested harvest action
    const harvesting = await fdm
        .select({
            b_id_harvesting: schema.cultivationHarvesting.b_id_harvesting,
            b_lu_harvest_date: schema.cultivationHarvesting.b_lu_harvest_date,
            b_lu: schema.cultivationHarvesting.b_lu,
        })
        .from(schema.cultivationHarvesting)
        .where(
            eq(schema.cultivationHarvesting.b_id_harvesting, b_id_harvesting),
        )
        .limit(1)

    // If no harvest is found return an error
    if (harvesting.length === 0) {
        throw new Error("Harvest does not exist")
    }

    const harvest = harvesting[0]

    // Get properties of harvestables for this harvesting
    // CAUTION: Currently only 1:1 joins for harvesting, harvestables and harvestable_analysis is supported. When 1:M joins is supported in these functions (db schema alreayd supports it) than the code below needs to be updated
    const harvestables = await fdm
        .select({
            b_id_harvestable: schema.harvestables.b_id_harvestable,
        })
        .from(schema.harvestables)
        .leftJoin(
            schema.cultivationHarvesting,
            eq(
                schema.harvestables.b_id_harvestable,
                schema.cultivationHarvesting.b_id_harvestable,
            ),
        )
        .where(
            eq(
                schema.cultivationHarvesting.b_id_harvesting,
                harvest.b_id_harvesting,
            ),
        )
        .limit(1)

    // Get properties of harvestable analyses for this harvesting
    const harvestableAnalyses = await fdm
        .select({
            b_id_harvestable_analysis:
                schema.harvestableAnalyses.b_id_harvestable_analysis,
            b_lu_yield: schema.harvestableAnalyses.b_lu_yield,
            b_lu_yield_fresh: schema.harvestableAnalyses.b_lu_yield_fresh,
            b_lu_yield_bruto: schema.harvestableAnalyses.b_lu_yield_bruto,
            b_lu_tarra: schema.harvestableAnalyses.b_lu_tarra,
            b_lu_dm: schema.harvestableAnalyses.b_lu_dm,
            b_lu_moist: schema.harvestableAnalyses.b_lu_moist,
            b_lu_uww: schema.harvestableAnalyses.b_lu_uww,
            b_lu_cp: schema.harvestableAnalyses.b_lu_cp,
            b_lu_n_harvestable: schema.harvestableAnalyses.b_lu_n_harvestable,
            b_lu_n_residue: schema.harvestableAnalyses.b_lu_n_residue,
            b_lu_p_harvestable: schema.harvestableAnalyses.b_lu_p_harvestable,
            b_lu_p_residue: schema.harvestableAnalyses.b_lu_p_residue,
            b_lu_k_harvestable: schema.harvestableAnalyses.b_lu_k_harvestable,
            b_lu_k_residue: schema.harvestableAnalyses.b_lu_k_residue,
        })
        .from(schema.harvestables)
        .leftJoin(
            schema.harvestableSampling,
            eq(
                schema.harvestables.b_id_harvestable,
                schema.harvestableSampling.b_id_harvestable,
            ),
        )
        .leftJoin(
            schema.harvestableAnalyses,
            eq(
                schema.harvestableSampling.b_id_harvestable_analysis,
                schema.harvestableAnalyses.b_id_harvestable_analysis,
            ),
        )
        .where(
            eq(
                schema.harvestableSampling.b_id_harvestable,
                harvestables[0]!.b_id_harvestable,
            ),
        )
        .limit(1)

    return {
        ...harvest,
        harvestable: {
            b_id_harvestable: harvestables[0]!.b_id_harvestable,
            harvestable_analyses: harvestableAnalyses,
        },
    } as unknown as Harvest
}

/**
 * Retrieves the required harvest parameters for a given harvest category.
 *
 * This function returns an array of parameter names that are required for a specific
 * harvest category (`b_lu_harvestcat`). Each category corresponds to a different type of crop
 * or harvest measurement, and thus requires a different set of parameters.
 *
 * @param b_lu_harvestcat - The harvest category identifier from the cultivations catalogue.
 * @returns An array of strings, where each string is a required parameter name for the given harvest class. Returns an empty array if the class is not recognized.
 */
export function getParametersForHarvestCat(
    b_lu_harvestcat: schema.cultivationsCatalogueTypeSelect["b_lu_harvestcat"],
): HarvestParameters {
    switch (b_lu_harvestcat) {
        case "HC010":
            return ["b_lu_yield_fresh", "b_lu_dm", "b_lu_n_harvestable"]
        case "HC020":
            return ["b_lu_yield", "b_lu_cp"]
        case "HC031":
            return ["b_lu_yield", "b_lu_cp"]
        case "HC040":
            return [
                "b_lu_yield_bruto",
                "b_lu_tarra",
                "b_lu_dm",
                "b_lu_n_harvestable",
            ]
        case "HC041":
            return [
                "b_lu_yield_bruto",
                "b_lu_tarra",
                "b_lu_dm",
                "b_lu_n_harvestable",
            ]
        case "HC042":
            return [
                "b_lu_yield_bruto",
                "b_lu_tarra",
                "b_lu_uww",
                "b_lu_n_harvestable",
            ]
        case "HC050":
            return ["b_lu_yield_fresh", "b_lu_moist", "b_lu_cp"]
        default:
            return []
    }
}

/**
 * Generates default harvest parameter values for a given cultivation.
 *
 * This function retrieves the required harvest parameters for a specific cultivation's harvest category
 * and calculates default values for each. The calculations are performed using `decimal.js` to ensure
 * precision. The default values are derived from the cultivation's catalogue data.
 *
 * @param b_lu_catalogue - The identifier for the cultivation in the catalogue.
 * @param cultivationsCatalogue - An array of cultivation catalogue items.
 * @returns An object containing the default harvest parameters.
 * @throws If the cultivation catalogue item is not found.
 *
 * @example
 * const defaults = getDefaultsForHarvestParameters("crop-001", catalogue);
 * console.log(defaults);
 * // Output might be: { b_lu_yield: 10000, b_lu_dm: 850 }
 */
export function getDefaultsForHarvestParameters(
    b_lu_catalogue: schema.cultivationsCatalogueTypeSelect["b_lu_catalogue"],
    cultivationsCatalogue: schema.cultivationsCatalogueTypeSelect[],
): HarvestParametersDefault {
    // Find the corresponding cultivation item in the catalogue.
    const cultivationsCatalogueItem = cultivationsCatalogue.find(
        (item) => item.b_lu_catalogue === b_lu_catalogue,
    )
    if (!cultivationsCatalogueItem) {
        throw new Error("Cultivations catalogue item not found")
    }

    // Get the list of required harvest parameters for the given harvest category.
    const harvestParameters = getParametersForHarvestCat(
        cultivationsCatalogueItem.b_lu_harvestcat,
    )

    const defaultHarvestParameters = {} as HarvestParametersDefault

    // Initialize Decimal values from the catalogue, providing defaults if nullish.
    const b_lu_yield = new Decimal(cultivationsCatalogueItem.b_lu_yield ?? 0)
    const b_lu_dm = new Decimal(cultivationsCatalogueItem.b_lu_dm ?? 1)
    // Default tarra (tare) percentage.
    const b_lu_tarra = new Decimal(5)

    // Iterate over the required parameters and calculate their default values.
    for (const parameter of harvestParameters) {
        if (parameter === "b_lu_yield") {
            // Default dry matter yield.
            defaultHarvestParameters[parameter] = b_lu_yield.toNumber()
        } else if (parameter === "b_lu_yield_fresh") {
            // Calculate fresh yield based on dry matter yield and content.
            // Formula: fresh_yield = dry_yield / (dry_matter_content / 1000)
            defaultHarvestParameters[parameter] = b_lu_yield
                .dividedBy(b_lu_dm.dividedBy(1000))
                .round()
                .toNumber()
        } else if (parameter === "b_lu_yield_bruto") {
            // Calculate gross yield including tarra.
            // Formula: gross_yield = dry_yield / (1 - tarra / 100)
            defaultHarvestParameters[parameter] = b_lu_yield
                .dividedBy(b_lu_dm.dividedBy(1000))
                .dividedBy(new Decimal(1).minus(b_lu_tarra.dividedBy(100)))
                .round()
                .toNumber()
        } else if (parameter === "b_lu_tarra") {
            // Default tarra percentage.
            defaultHarvestParameters[parameter] = b_lu_tarra.toNumber()
        } else if (parameter === "b_lu_dm") {
            // Default dry matter content.
            defaultHarvestParameters[parameter] = b_lu_dm.toNumber()
        } else if (parameter === "b_lu_moist") {
            // Calculate moisture content from dry matter.
            // Formula: moisture = (1000 - dry_matter_content) / 10
            defaultHarvestParameters[parameter] = new Decimal(1000)
                .minus(b_lu_dm)
                .dividedBy(10)
                .round()
                .toNumber()
        } else if (parameter === "b_lu_uww") {
            // Default underwater weight.
            defaultHarvestParameters[parameter] = b_lu_dm
                .dividedBy(10)
                .minus(2.0)
                .dividedBy(0.049)
                .round()
                .toNumber()
        } else if (parameter === "b_lu_cp") {
            const b_lu_n_harvestable = new Decimal(
                cultivationsCatalogueItem.b_lu_n_harvestable ?? 0,
            )
            // Calculate crude protein based on nitrogen content and harvest category.
            // The conversion factor from nitrogen to crude protein varies by crop type.
            if (cultivationsCatalogueItem.b_lu_harvestcat === "HC020") {
                defaultHarvestParameters[parameter] = b_lu_n_harvestable
                    .times(6.25)
                    .round()
                    .toNumber()
            } else if (cultivationsCatalogueItem.b_lu_harvestcat === "HC031") {
                defaultHarvestParameters[parameter] = b_lu_n_harvestable
                    .times(6.25)
                    .round()
                    .toNumber()
            } else if (cultivationsCatalogueItem.b_lu_harvestcat === "HC050") {
                defaultHarvestParameters[parameter] = b_lu_n_harvestable
                    .times(5.7)
                    .round()
                    .toNumber()
            } else {
                // Default crude protein value if no specific category matches.
                defaultHarvestParameters[parameter] = 170
            }
        } else if (parameter === "b_lu_n_harvestable") {
            // Default harvestable nitrogen content.
            defaultHarvestParameters[parameter] =
                cultivationsCatalogueItem[parameter]
        }
    }

    return defaultHarvestParameters
}
