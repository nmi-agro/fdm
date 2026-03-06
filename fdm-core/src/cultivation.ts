import {
    and,
    asc,
    desc,
    eq,
    gte,
    inArray,
    isNotNull,
    isNull,
    lte,
    or,
    type SQL,
    sql,
} from "drizzle-orm"
import { checkPermission } from "./authorization"
import type { PrincipalId } from "./authorization.d"
import type {
    Cultivation,
    CultivationCatalogue,
    CultivationDefaultDates,
    CultivationPlan,
} from "./cultivation.d"
import * as schema from "./db/schema"
import { handleError } from "./error"
import type { FdmType } from "./fdm"
import {
    addHarvest,
    getDefaultsForHarvestParameters,
    getHarvestableTypeOfCultivation,
    getHarvests,
    removeHarvest,
} from "./harvest"
import { createId } from "./id"
import type { Timeframe } from "./timeframe"

/**
 * Retrieves cultivations available in the enabled catalogues for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @returns A Promise that resolves with an array of cultivation catalogue entries.
 * @alpha
 */
export async function getCultivationsFromCatalogue(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<CultivationCatalogue[]> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "read",
            b_id_farm,
            principal_id,
            "getCultivationsFromCatalogue",
        )

        // Get enabled catalogues for the farm
        const enabledCatalogues = await fdm
            .select({
                b_lu_source: schema.cultivationCatalogueSelecting.b_lu_source,
            })
            .from(schema.cultivationCatalogueSelecting)
            .where(
                eq(schema.cultivationCatalogueSelecting.b_id_farm, b_id_farm),
            )

        // If no catalogues are enabled, return empty array
        if (enabledCatalogues.length === 0) {
            return []
        }

        // Get cultivations from enabled catalogues
        const cultivationsCatalogue = await fdm
            .select()
            .from(schema.cultivationsCatalogue)
            .where(
                inArray(
                    schema.cultivationsCatalogue.b_lu_source,
                    enabledCatalogues.map(
                        (c: { b_lu_source: string }) => c.b_lu_source,
                    ),
                ),
            )

        return cultivationsCatalogue
    } catch (err) {
        throw handleError(err, "Exception for getCultivationsFromCatalogue", {
            principal_id,
            b_id_farm,
        })
    }
}

/**
 * Adds a new cultivation to the catalogue.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param properties The properties of the cultivation to add. This includes fields like `b_lu_catalogue`, `b_lu_name`, `b_lu_harvestable`, `b_lu_eom`, `b_lu_eom_residues`, and optionally `b_lu_variety_options` to specify available varieties.
 * @returns A Promise that resolves when the cultivation is added.
 * @throws If the insertion fails.
 * @alpha
 */
export async function addCultivationToCatalogue(
    fdm: FdmType,
    properties: {
        b_lu_catalogue: schema.cultivationsCatalogueTypeInsert["b_lu_catalogue"]
        b_lu_source: schema.cultivationsCatalogueTypeInsert["b_lu_source"]
        b_lu_name: schema.cultivationsCatalogueTypeInsert["b_lu_name"]
        b_lu_name_en: schema.cultivationsCatalogueTypeInsert["b_lu_name_en"]
        b_lu_harvestable: schema.cultivationsCatalogueTypeInsert["b_lu_harvestable"]
        b_lu_harvestcat: schema.cultivationsCatalogueTypeInsert["b_lu_harvestcat"]
        b_lu_hcat3: schema.cultivationsCatalogueTypeInsert["b_lu_hcat3"]
        b_lu_hcat3_name: schema.cultivationsCatalogueTypeInsert["b_lu_hcat3_name"]
        b_lu_croprotation: schema.cultivationsCatalogueTypeInsert["b_lu_croprotation"]
        b_lu_yield: schema.cultivationsCatalogueTypeInsert["b_lu_yield"]
        b_lu_dm: schema.cultivationsCatalogueTypeInsert["b_lu_dm"]
        b_lu_hi: schema.cultivationsCatalogueTypeInsert["b_lu_hi"]
        b_lu_n_harvestable: schema.cultivationsCatalogueTypeInsert["b_lu_n_harvestable"]
        b_lu_n_residue: schema.cultivationsCatalogueTypeInsert["b_lu_n_residue"]
        b_n_fixation: schema.cultivationsCatalogueTypeInsert["b_n_fixation"]
        b_lu_eom: schema.cultivationsCatalogueTypeInsert["b_lu_eom"]
        b_lu_eom_residues: schema.cultivationsCatalogueTypeInsert["b_lu_eom_residues"]
        b_lu_rest_oravib: schema.cultivationsCatalogueTypeInsert["b_lu_rest_oravib"]
        b_lu_variety_options: schema.cultivationsCatalogueTypeInsert["b_lu_variety_options"]
        b_lu_start_default: schema.cultivationsCatalogueTypeInsert["b_lu_start_default"]
        b_date_harvest_default: schema.cultivationsCatalogueTypeInsert["b_date_harvest_default"]
    },
): Promise<void> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            // Check for existing cultivation
            const existing = await tx
                .select()
                .from(schema.cultivationsCatalogue)
                .where(
                    eq(
                        schema.cultivationsCatalogue.b_lu_catalogue,
                        properties.b_lu_catalogue,
                    ),
                )
                .limit(1)

            if (existing.length > 0) {
                throw new Error("Cultivation already exists in catalogue")
            }

            // Validate if b_lu_start_default and b_date_harvest_default follows format MM-dd
            const dateRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/
            if (
                properties.b_lu_start_default &&
                !dateRegex.test(properties.b_lu_start_default)
            ) {
                throw new Error(
                    "Invalid b_lu_start_default format. Expected MM-dd.",
                )
            }
            if (
                properties.b_date_harvest_default &&
                !dateRegex.test(properties.b_date_harvest_default)
            ) {
                throw new Error(
                    "Invalid b_date_harvest_default format. Expected MM-dd.",
                )
            }

            // Insert the cultivation in the db
            await tx.insert(schema.cultivationsCatalogue).values(properties)
        })
    } catch (err) {
        throw handleError(err, "Exception for addCultivationToCatalogue", {
            properties,
        })
    }
}

/**
 * Retrieves the default start and end dates for a given cultivation in a specific year.
 *
 * This function checks for read permissions on the farm, then queries the cultivation catalogue
 * to find the default sowing and harvest dates for the specified cultivation. It constructs
 * Date objects for the given year. For single-harvest crops, it calculates the default end
 * date and adjusts the year if the sowing date felt into the previous calendar year.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param b_lu_catalogue The catalogue ID of the cultivation.
 * @param year The year for which to determine the default dates.
 * @returns A Promise that resolves with an object containing the default start and end dates.
 * @throws {Error} If the cultivation is not found in the enabled catalogues for the farm.
 * @alpha
 */
export async function getDefaultDatesOfCultivation(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeSelect["b_id_farm"],
    b_lu_catalogue: schema.cultivationsCatalogueTypeSelect["b_lu_catalogue"],
    year: number,
): Promise<CultivationDefaultDates> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "read",
            b_id_farm,
            principal_id,
            "getDefaultDatesOfCultivation",
        )

        // Validate year
        if (!year || !Number.isInteger(year) || year < 1970 || year >= 2100) {
            throw new Error("Invalid year")
        }

        // Retrieve the enabled cultivation catalogues for the specified farm.
        const enabledCatalogues = await fdm
            .select({
                b_lu_source: schema.cultivationCatalogueSelecting.b_lu_source,
            })
            .from(schema.cultivationCatalogueSelecting)
            .where(
                eq(schema.cultivationCatalogueSelecting.b_id_farm, b_id_farm),
            )

        if (enabledCatalogues.length === 0) {
            throw new Error("Cultivation not found in catalogue")
        }

        // Fetch the specified cultivation's default date information from the enabled catalogues.
        const cultivationsCatalogue = await fdm
            .select({
                b_lu_catalogue: schema.cultivationsCatalogue.b_lu_catalogue,
                b_lu_harvestable: schema.cultivationsCatalogue.b_lu_harvestable,
                b_lu_start_default:
                    schema.cultivationsCatalogue.b_lu_start_default,
                b_date_harvest_default:
                    schema.cultivationsCatalogue.b_date_harvest_default,
            })
            .from(schema.cultivationsCatalogue)
            .where(
                and(
                    inArray(
                        schema.cultivationsCatalogue.b_lu_source,
                        enabledCatalogues.map(
                            (c: { b_lu_source: string }) => c.b_lu_source,
                        ),
                    ),
                    eq(
                        schema.cultivationsCatalogue.b_lu_catalogue,
                        b_lu_catalogue,
                    ),
                ),
            )
            .limit(1)

        if (cultivationsCatalogue.length === 0) {
            throw new Error("Cultivation not found in catalogue")
        }

        // Set default dates of March 15th to September 15th if not provided
        const defaultStart =
            cultivationsCatalogue[0].b_lu_start_default ?? "03-15"
        const defaultEnd =
            cultivationsCatalogue[0].b_date_harvest_default ?? "09-15"

        // Construct the default start date using the provided year.
        const cultivationDefaultDates: CultivationDefaultDates = {
            b_lu_start: new Date(`${year}-${defaultStart}`),
            b_lu_end: new Date(`${year}-${defaultEnd}`),
        }

        // If the calculated end date is earlier than the start date, it implies the sowing
        // occurred in the previous year, so we use the previous year for the start date.
        if (
            cultivationDefaultDates.b_lu_end &&
            cultivationDefaultDates.b_lu_end.getTime() <=
                cultivationDefaultDates.b_lu_start.getTime()
        ) {
            cultivationDefaultDates.b_lu_start = new Date(
                `${year - 1}-${defaultStart}`,
            )
        }

        // For cultivations that can be harvested multiple times or not at all, set b_lu_end to undefined
        if (cultivationsCatalogue[0].b_lu_harvestable !== "once") {
            cultivationDefaultDates.b_lu_end = undefined
        }

        return cultivationDefaultDates
    } catch (err) {
        throw handleError(err, "Exception for getDefaultDatesOfCultivation", {
            principal_id,
            b_id_farm,
            b_lu_catalogue,
            year,
        })
    }
}

/**
 * Adds a new cultivation to a specific field.
 *
 * The function validates that the sowing and (if provided) termination dates are valid Date objects and that the termination date is after the sowing date. It ensures the target field and cultivation catalogue entry exist and that no duplicate cultivation is recorded. A permission check is performed before any database operations. If a termination date is provided for a cultivation that is harvestable only once, a harvest record is automatically scheduled for the termination date.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal performing the operation.
 * @param b_lu_catalogue - The catalogue ID corresponding to the cultivation entry.
 * @param b_id - The identifier of the field to which the cultivation is added.
 * @param b_lu_start - The sowing date of the cultivation.
 * @param b_lu_end - The optional termination date of the cultivation.
 * @param m_cropresidue - (Optional) Whether crop residues are left on the field or not after termination of the cultivation.
 * @param b_lu_variety - (Optional) The variety of the cultivation.
 * @returns A promise that resolves with the unique ID of the newly added cultivation.
 * @throws {Error} If the sowing date is invalid, the termination date is invalid or not after the sowing date, the field or catalogue entry does not exist, or a duplicate cultivation is detected.
 * @alpha
 */
export async function addCultivation(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_lu_catalogue: schema.cultivationsTypeInsert["b_lu_catalogue"],
    b_id: schema.cultivationStartingTypeInsert["b_id"],
    b_lu_start: schema.cultivationStartingTypeInsert["b_lu_start"],
    b_lu_end?: schema.cultivationEndingTypeInsert["b_lu_end"],
    m_cropresidue?: schema.cultivationEndingTypeInsert["m_cropresidue"],
    b_lu_variety?: schema.cultivationsTypeInsert["b_lu_variety"],
): Promise<schema.cultivationsTypeSelect["b_lu"]> {
    try {
        await checkPermission(
            fdm,
            "field",
            "write",
            b_id,
            principal_id,
            "addCultivation",
        )

        return await fdm.transaction(async (tx: FdmType) => {
            // Generate an ID for the cultivation
            const b_lu = createId()

            // Validate b_lu_start is a Date object
            if (!(b_lu_start instanceof Date)) {
                throw new Error("Invalid sowing date: Must be a Date object")
            }

            if (b_lu_end) {
                // Validate if terminate date is a Date object
                if (!(b_lu_end instanceof Date)) {
                    throw new Error(
                        "Invalid terminate date: Must be a Date object",
                    )
                }

                // Validate if terminate date is after sowing date
                if (b_lu_end.getTime() <= b_lu_start.getTime()) {
                    throw new Error("Terminate date must be after sowing date")
                }
            }

            // Validate if field exists
            const field = await tx
                .select()
                .from(schema.fields)
                .where(eq(schema.fields.b_id, b_id))
                .limit(1)
            if (field.length === 0) {
                throw new Error("Field does not exist")
            }

            // Validate if cultivation exists in catalogue
            const cultivation = await tx
                .select()
                .from(schema.cultivationsCatalogue)
                .where(
                    eq(
                        schema.cultivationsCatalogue.b_lu_catalogue,
                        b_lu_catalogue,
                    ),
                )
                .limit(1)
            if (cultivation.length === 0) {
                throw new Error("Cultivation in catalogue does not exist")
            }

            // Validate if cultivation is not an duplicate of already existing cultivation
            const existingCultivation = await tx
                .select()
                .from(schema.cultivationStarting)
                .leftJoin(
                    schema.cultivations,
                    eq(
                        schema.cultivationStarting.b_lu,
                        schema.cultivations.b_lu,
                    ),
                )
                .where(
                    and(
                        eq(schema.cultivationStarting.b_id, b_id),
                        or(
                            eq(schema.cultivationStarting.b_lu, b_lu),
                            and(
                                eq(
                                    schema.cultivationStarting.b_lu_start,
                                    b_lu_start,
                                ),
                                eq(
                                    schema.cultivations.b_lu_catalogue,
                                    b_lu_catalogue,
                                ),
                            ),
                        ),
                    ),
                )
                .limit(1)

            if (existingCultivation.length > 0) {
                throw new Error("Cultivation already exists")
            }

            // Validate when b_lu_variety is provided for the cultivation that the variety provided is listed as an option in the cultivation catalogue
            if (b_lu_variety) {
                const catalogueEntry = await tx
                    .select({
                        b_lu_variety_options:
                            schema.cultivationsCatalogue.b_lu_variety_options,
                    })
                    .from(schema.cultivationsCatalogue)
                    .where(
                        eq(
                            schema.cultivationsCatalogue.b_lu_catalogue,
                            b_lu_catalogue,
                        ),
                    )
                    .limit(1)

                if (
                    catalogueEntry.length > 0 &&
                    catalogueEntry[0].b_lu_variety_options &&
                    !catalogueEntry[0].b_lu_variety_options.includes(
                        b_lu_variety,
                    )
                ) {
                    throw new Error(
                        "Variety not available for this cultivation",
                    )
                }
            }

            await tx.insert(schema.cultivations).values({
                b_lu: b_lu,
                b_lu_catalogue: b_lu_catalogue,
                b_lu_variety: b_lu_variety,
            })

            await tx.insert(schema.cultivationStarting).values({
                b_id: b_id,
                b_lu: b_lu,
                b_lu_start: b_lu_start,
            })

            await tx.insert(schema.cultivationEnding).values({
                b_lu: b_lu,
                b_lu_end: b_lu_end,
                m_cropresidue: m_cropresidue,
            })

            if (b_lu_end) {
                const harvestableType = await getHarvestableTypeOfCultivation(
                    tx,
                    b_lu,
                )

                if (harvestableType === "once") {
                    // If cultivation can only be harvested once, add harvest on terminate date
                    const defaultHarvestParameters =
                        await getDefaultsForHarvestParameters(
                            b_lu_catalogue,
                            cultivation,
                        )

                    await addHarvest(
                        tx,
                        principal_id,
                        b_lu,
                        b_lu_end,
                        defaultHarvestParameters,
                    )
                }
            }
            return b_lu
        })
    } catch (err) {
        throw handleError(err, "Exception for addCultivation", {
            b_lu_catalogue,
            b_id,
            b_lu_start,
            b_lu_end,
            m_cropresidue,
            b_lu_variety,
        })
    }
}

/**
 * Retrieves details of a specific cultivation after verifying access permissions.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal requesting access.
 * @param b_lu - The unique identifier of the cultivation.
 * @returns A promise that resolves with the cultivation details.
 * @throws {Error} If no cultivation matches the provided identifier.
 *
 * @remark A permission check is performed to ensure the requesting principal has read access.
 */
export async function getCultivation(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_lu: schema.cultivationsTypeSelect["b_lu"],
): Promise<Cultivation> {
    try {
        await checkPermission(
            fdm,
            "cultivation",
            "read",
            b_lu,
            principal_id,
            "getCultivation",
        )

        // Get properties of the requested cultivation
        const cultivation = await fdm
            .select({
                b_lu: schema.cultivations.b_lu,
                b_lu_catalogue: schema.cultivationsCatalogue.b_lu_catalogue,
                b_lu_source: schema.cultivationsCatalogue.b_lu_source,
                b_lu_name: schema.cultivationsCatalogue.b_lu_name,
                b_lu_name_en: schema.cultivationsCatalogue.b_lu_name_en,
                b_lu_hcat3: schema.cultivationsCatalogue.b_lu_hcat3,
                b_lu_hcat3_name: schema.cultivationsCatalogue.b_lu_hcat3_name,
                b_lu_harvestcat: schema.cultivationsCatalogue.b_lu_harvestcat,
                b_lu_harvestable: schema.cultivationsCatalogue.b_lu_harvestable,
                b_lu_eom: schema.cultivationsCatalogue.b_lu_eom,
                b_lu_eom_residues:
                    schema.cultivationsCatalogue.b_lu_eom_residues,
                b_lu_croprotation:
                    schema.cultivationsCatalogue.b_lu_croprotation,
                b_lu_variety: schema.cultivations.b_lu_variety,
                b_lu_start: schema.cultivationStarting.b_lu_start,
                b_lu_end: schema.cultivationEnding.b_lu_end,
                m_cropresidue: schema.cultivationEnding.m_cropresidue,
                b_id: schema.cultivationStarting.b_id,
            })
            .from(schema.cultivations)
            .leftJoin(
                schema.cultivationStarting,
                eq(schema.cultivationStarting.b_lu, schema.cultivations.b_lu),
            )
            .leftJoin(
                schema.cultivationEnding,
                eq(schema.cultivationEnding.b_lu, schema.cultivations.b_lu),
            )
            .leftJoin(
                schema.cultivationsCatalogue,
                eq(
                    schema.cultivations.b_lu_catalogue,
                    schema.cultivationsCatalogue.b_lu_catalogue,
                ),
            )
            .where(eq(schema.cultivations.b_lu, b_lu))
            .limit(1)

        // If no cultivation is found return an error
        if (cultivation.length === 0) {
            throw new Error("Cultivation does not exist")
        }

        return cultivation[0]
    } catch (err) {
        throw handleError(err, "Exception for getCultivation", { b_lu })
    }
}

/**
 * Retrieves all cultivations associated with a specific field.
 *
 * This function verifies that the requesting principal has read access to the field, then queries the database
 * and returns an array of cultivation records.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - Identifier of the principal requesting access.
 * @param b_id - Identifier of the field.
 * @param timeframe - Optional timeframe to filter cultivations by start and end dates.
 *
 * @returns A Promise resolving to an array of cultivation details.
 *
 * @throws {Error} If the principal does not have read permission or if the database query fails.
 *
 * @alpha
 */
export async function getCultivations(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id: schema.cultivationStartingTypeSelect["b_id"],
    timeframe?: Timeframe,
): Promise<Cultivation[]> {
    try {
        await checkPermission(
            fdm,
            "field",
            "read",
            b_id,
            principal_id,
            "getCultivations",
        )

        const timeframeCondition = buildCultivationTimeframeCondition(timeframe)

        const cultivations = await fdm
            .select({
                b_lu: schema.cultivations.b_lu,
                b_lu_catalogue: schema.cultivationsCatalogue.b_lu_catalogue,
                b_lu_source: schema.cultivationsCatalogue.b_lu_source,
                b_lu_name: schema.cultivationsCatalogue.b_lu_name,
                b_lu_name_en: schema.cultivationsCatalogue.b_lu_name_en,
                b_lu_hcat3: schema.cultivationsCatalogue.b_lu_hcat3,
                b_lu_hcat3_name: schema.cultivationsCatalogue.b_lu_hcat3_name,
                b_lu_croprotation:
                    schema.cultivationsCatalogue.b_lu_croprotation,
                b_lu_eom: schema.cultivationsCatalogue.b_lu_eom,
                b_lu_eom_residues:
                    schema.cultivationsCatalogue.b_lu_eom_residues,
                b_lu_harvestcat: schema.cultivationsCatalogue.b_lu_harvestcat,
                b_lu_harvestable: schema.cultivationsCatalogue.b_lu_harvestable,
                b_lu_variety: schema.cultivations.b_lu_variety,
                b_lu_start: schema.cultivationStarting.b_lu_start,
                b_lu_end: schema.cultivationEnding.b_lu_end,
                m_cropresidue: schema.cultivationEnding.m_cropresidue,
                b_id: schema.cultivationStarting.b_id,
            })
            .from(schema.cultivations)
            .leftJoin(
                schema.cultivationStarting,
                eq(schema.cultivationStarting.b_lu, schema.cultivations.b_lu),
            )
            .leftJoin(
                schema.cultivationEnding,
                eq(schema.cultivationEnding.b_lu, schema.cultivations.b_lu),
            )
            .leftJoin(
                schema.cultivationsCatalogue,
                eq(
                    schema.cultivations.b_lu_catalogue,
                    schema.cultivationsCatalogue.b_lu_catalogue,
                ),
            )
            .where(
                timeframeCondition
                    ? and(
                          eq(schema.cultivationStarting.b_id, b_id),
                          timeframeCondition,
                      )
                    : eq(schema.cultivationStarting.b_id, b_id),
            )
            .orderBy(
                desc(schema.cultivationStarting.b_lu_start),
                asc(schema.cultivationsCatalogue.b_lu_name),
            )

        return cultivations
    } catch (err) {
        throw handleError(err, "Exception for getCultivations", { b_id })
    }
}

/**
 * Retrieves a comprehensive cultivation plan for a specified farm.
 *
 * This function aggregates cultivation data from multiple related tables and returns an array of cultivation
 * entries. Each entry includes the catalogue identifier, its name, sowing and termination dates (if available),
 * and an array of fields on which the cultivation was applied. Each field entry details associated fertilizer
 * applications and harvest records (with accompanying analyses).
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal requesting access to the cultivation plan.
 * @param b_id_farm - The unique ID of the farm for which the cultivation plan is to be retrieved.
 * @param timeframe - Optional timeframe to filter cultivations by start and end dates.
 *
 * @returns A Promise that resolves to an array representing the cultivation plan. Each element in the array has the following structure:
 *
 * ```
 * {
 *   b_lu_catalogue: string;   // Unique ID of the cultivation catalogue item
 *   b_lu_name: string;        // Name of the cultivation
 *   b_lu_variety: string;     // Variety of the cultivation
 *   b_area: number;           // Total area of the cultivation
 *   b_lu_start: Date;         // Sowing date for the cultivation (if available)
 *   b_lu_end: Date;           // Termination date for the cultivation (if available)
 *   m_cropresidue: boolean    // Whether crop residues are left on the field or not after termination of the cultivation
 *   fields: [
 *     {
 *       b_lu: string;        // Unique ID of the cultivation record
 *       b_id: string;        // Unique ID of the field
 *       b_name: string;      // Name of the field
 *       b_area: number;      // Area of the field
 *       b_bufferstrip: boolean; // Whether the field is a bufferstrip
 *       fertilizer_applications: [
 *         {
 *           p_id_catalogue: string; // Fertilizer catalogue ID
 *           p_name_nl: string;      // Fertilizer name (Dutch)
 *           p_app_amount: number;   // Amount applied
 *           p_app_method: string;   // Application method
 *           p_app_date: Date;       // Application date
 *           p_app_id: string;       // Unique ID of the fertilizer application
 *         }
 *       ],
 *       harvests: [
 *         {
 *           b_id_harvesting: string;  // Unique ID of the harvest record
 *           b_lu_harvest_date: Date;  // Harvest date
 *           harvestable: {
 *               b_id_harvestable: string; // Unique ID of the harvestable
 *               harvestable_analyses: [
 *                 {
 *                   b_lu_yield: number;         // Yield in kg/ha
 *                   b_lu_n_harvestable: number;   // N content in harvestable yield (g N/kg)
 *                   b_lu_n_residue: number;       // N content in residue (g N/kg)
 *                   b_lu_p_harvestable: number;   // P content in harvestable yield (g P2O5/kg)
 *                   b_lu_p_residue: number;       // P content in residue (g P2O5/kg)
 *                   b_lu_k_harvestable: number;   // K content in harvestable yield (g K2O/kg)
 *                   b_lu_k_residue: number;       // K content in residue (g K2O/kg)
 *                 }
 *               ]
 *             }
 *         }
 *       ]
 *     }
 *   ]
 * }
 * ```
 * If no cultivations are found for the specified farm, an empty array is returned.
 *
 * @example
 * ```typescript
 * const cultivationPlan = await getCultivationPlan(fdm, 'principal123', 'farm123');
 * if (cultivationPlan.length) {
 *   console.log("Cultivation Plan:", cultivationPlan);
 * } else {
 *   console.log("No cultivations found for this farm.");
 * }
 * ```
 *
 * @alpha
 */
export async function getCultivationPlan(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeSelect["b_id_farm"],
    timeframe?: Timeframe,
): Promise<CultivationPlan[]> {
    try {
        if (!b_id_farm) {
            throw new Error("Farm ID is required")
        }
        await checkPermission(
            fdm,
            "farm",
            "read",
            b_id_farm,
            principal_id,
            "getCultivationPlan",
        )

        const timeframeCondition = buildCultivationTimeframeCondition(timeframe)

        const cultivations = await fdm
            .select({
                b_lu_catalogue: schema.cultivationsCatalogue.b_lu_catalogue,
                b_lu_name: schema.cultivationsCatalogue.b_lu_name,
                b_lu_variety: schema.cultivations.b_lu_variety,
                b_lu: schema.cultivations.b_lu,
                b_id: schema.fields.b_id,
                b_name: schema.fields.b_name,
                b_area: sql<number>`ROUND((ST_Area(b_geometry::geography)/10000)::NUMERIC, 2)::FLOAT`,
                b_perimeter: sql<number>`ROUND((ST_Length(ST_ExteriorRing(b_geometry)::geography))::NUMERIC, 2)::FLOAT`,
                b_bufferstrip: schema.fields.b_bufferstrip,
                b_lu_start: schema.cultivationStarting.b_lu_start,
                b_lu_end: schema.cultivationEnding.b_lu_end,
                m_cropresidue: schema.cultivationEnding.m_cropresidue,
                p_id_catalogue: schema.fertilizersCatalogue.p_id_catalogue,
                p_name_nl: schema.fertilizersCatalogue.p_name_nl,
                p_app_amount: schema.fertilizerApplication.p_app_amount,
                p_app_method: schema.fertilizerApplication.p_app_method,
                p_app_date: schema.fertilizerApplication.p_app_date,
                p_app_id: schema.fertilizerApplication.p_app_id,
                b_id_harvesting: schema.cultivationHarvesting.b_id_harvesting,
                b_lu_harvest_date:
                    schema.cultivationHarvesting.b_lu_harvest_date,
                b_lu_croprotation:
                    schema.cultivationsCatalogue.b_lu_croprotation,
                b_lu_eom: schema.cultivationsCatalogue.b_lu_eom,
                b_lu_eom_residues:
                    schema.cultivationsCatalogue.b_lu_eom_residues,
                b_lu_harvestcat: schema.cultivationsCatalogue.b_lu_harvestcat,
                b_lu_harvestable: schema.cultivationsCatalogue.b_lu_harvestable,
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
            .from(schema.farms)
            .leftJoin(
                schema.fieldAcquiring,
                eq(schema.farms.b_id_farm, schema.fieldAcquiring.b_id_farm),
            )
            .leftJoin(
                schema.fields,
                eq(schema.fieldAcquiring.b_id, schema.fields.b_id),
            )
            .leftJoin(
                schema.cultivationStarting,
                eq(schema.fields.b_id, schema.cultivationStarting.b_id),
            )
            .leftJoin(
                schema.cultivationEnding,
                eq(
                    schema.cultivationEnding.b_lu,
                    schema.cultivationStarting.b_lu,
                ),
            )
            .leftJoin(
                schema.cultivations,
                eq(schema.cultivationStarting.b_lu, schema.cultivations.b_lu),
            )
            .leftJoin(
                schema.cultivationsCatalogue,
                eq(
                    schema.cultivations.b_lu_catalogue,
                    schema.cultivationsCatalogue.b_lu_catalogue,
                ),
            )
            .leftJoin(
                schema.fertilizerApplication,
                eq(schema.fertilizerApplication.b_id, schema.fields.b_id),
            )
            .leftJoin(
                schema.fertilizerPicking,
                eq(
                    schema.fertilizerPicking.p_id,
                    schema.fertilizerApplication.p_id,
                ),
            )
            .leftJoin(
                schema.fertilizersCatalogue,
                eq(
                    schema.fertilizersCatalogue.p_id_catalogue,
                    schema.fertilizerPicking.p_id_catalogue,
                ),
            )
            .leftJoin(
                schema.cultivationHarvesting,
                eq(schema.cultivations.b_lu, schema.cultivationHarvesting.b_lu),
            )
            .leftJoin(
                schema.harvestables,
                eq(
                    schema.cultivationHarvesting.b_id_harvestable,
                    schema.harvestables.b_id_harvestable,
                ),
            )
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
                timeframeCondition
                    ? and(
                          eq(schema.farms.b_id_farm, b_id_farm),
                          isNotNull(
                              schema.cultivationsCatalogue.b_lu_catalogue,
                          ),
                          isNotNull(schema.cultivationStarting.b_id),
                          timeframeCondition,
                      )
                    : and(
                          eq(schema.farms.b_id_farm, b_id_farm),
                          isNotNull(
                              schema.cultivationsCatalogue.b_lu_catalogue,
                          ),
                          isNotNull(schema.cultivationStarting.b_id),
                      ),
            )

        const cultivationPlan = cultivations.reduce(
            (acc: CultivationPlan[], curr: (typeof cultivations)[0]) => {
                let existingCultivation = acc.find(
                    (item) =>
                        item.b_lu_catalogue === curr.b_lu_catalogue &&
                        item.b_lu_variety === curr.b_lu_variety &&
                        (item.b_lu_start?.getTime() ?? 0) ===
                            (curr.b_lu_start?.getTime() ?? 0) &&
                        (item.b_lu_end?.getTime() ?? 0) ===
                            (curr.b_lu_end?.getTime() ?? 0),
                )

                if (!existingCultivation) {
                    existingCultivation = {
                        b_lu_catalogue: curr.b_lu_catalogue,
                        b_lu_name: curr.b_lu_name,
                        b_lu_variety: curr.b_lu_variety,
                        b_lu_croprotation: curr.b_lu_croprotation,
                        b_lu_eom: curr.b_lu_eom,
                        b_lu_eom_residues: curr.b_lu_eom_residues,
                        b_lu_harvestcat: curr.b_lu_harvestcat,
                        b_lu_harvestable: curr.b_lu_harvestable,
                        b_area: 0,
                        b_lu_start: curr.b_lu_start,
                        b_lu_end: curr.b_lu_end,
                        m_cropresidue: curr.m_cropresidue,
                        fields: [],
                    }
                    acc.push(existingCultivation)
                }

                let existingField = existingCultivation.fields.find(
                    (field) => field.b_id === curr.b_id,
                )

                if (!existingField) {
                    existingField = {
                        b_lu: curr.b_lu,
                        b_id: curr.b_id,
                        b_area: curr.b_area,
                        b_name: curr.b_name,
                        b_bufferstrip: curr.b_bufferstrip,
                        fertilizer_applications: [],
                        harvests: [],
                    }
                    existingCultivation.fields.push(existingField)
                    if (curr.b_area) {
                        existingCultivation.b_area += curr.b_area
                    }
                }

                if (curr.p_app_id) {
                    // Only add if it's a fertilizer application
                    existingField.fertilizer_applications.push({
                        p_id_catalogue: curr.p_id_catalogue,
                        p_name_nl: curr.p_name_nl,
                        p_app_amount: curr.p_app_amount,
                        p_app_method: curr.p_app_method,
                        p_app_date: curr.p_app_date,
                        p_app_id: curr.p_app_id,
                    })
                }

                if (curr.b_id_harvesting) {
                    // Only add if it's a harvest
                    existingField.harvests.push({
                        b_id_harvesting: curr.b_id_harvesting,
                        b_lu_harvest_date: curr.b_lu_harvest_date,
                        harvestable: {
                            b_id_harvestable: curr.b_id_harvestable,
                            harvestable_analyses: [
                                {
                                    b_lu_yield: curr.b_lu_yield,
                                    b_lu_yield_fresh: curr.b_lu_yield_fresh,
                                    b_lu_yield_bruto: curr.b_lu_yield_bruto,
                                    b_lu_tarra: curr.b_lu_tarra,
                                    b_lu_dm: curr.b_lu_dm,
                                    b_lu_moist: curr.b_lu_moist,
                                    b_lu_uww: curr.b_lu_uww,
                                    b_lu_cp: curr.b_lu_cp,
                                    b_lu_n_harvestable: curr.b_lu_n_harvestable,
                                    b_lu_n_residue: curr.b_lu_n_residue,
                                    b_lu_p_harvestable: curr.b_lu_p_harvestable,
                                    b_lu_p_residue: curr.b_lu_p_residue,
                                    b_lu_k_harvestable: curr.b_lu_k_harvestable,
                                    b_lu_k_residue: curr.b_lu_k_residue,
                                },
                            ],
                        },
                    })
                }
                return acc
            },
            [],
        )
        return cultivationPlan
    } catch (err) {
        throw handleError(err, "Exception for getCultivationPlan", {
            b_id_farm,
        })
    }
}

/**
 * Removes a cultivation and its related sowing and termination records from the database.
 *
 * The function first verifies that the principal has permission to perform the removal, then executes a transaction that
 * deletes the cultivation's termination, sowing, and main records. An error is thrown if the cultivation does not exist
 * or if the deletion fails.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param b_lu - The unique identifier of the cultivation to remove.
 *
 * @returns A Promise that resolves once the removal is complete.
 *
 * @throws {Error} If the cultivation is not found or the deletion operation fails.
 *
 * @alpha
 */
export async function removeCultivation(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_lu: schema.cultivationsTypeInsert["b_lu"],
): Promise<void> {
    try {
        await checkPermission(
            fdm,
            "cultivation",
            "write",
            b_lu,
            principal_id,
            "removeCultivation",
        )
        return await fdm.transaction(async (tx: FdmType) => {
            const existing = await tx
                .select()
                .from(schema.cultivations)
                .where(eq(schema.cultivations.b_lu, b_lu))
                .limit(1)

            if (existing.length === 0) {
                throw new Error("Cultivation does not exist")
            }

            // Delete associated harvest records first
            await tx
                .delete(schema.cultivationHarvesting)
                .where(eq(schema.cultivationHarvesting.b_lu, b_lu))

            await tx
                .delete(schema.cultivationEnding)
                .where(eq(schema.cultivationEnding.b_lu, b_lu))

            await tx
                .delete(schema.cultivationStarting)
                .where(eq(schema.cultivationStarting.b_lu, b_lu))

            await tx
                .delete(schema.cultivations)
                .where(eq(schema.cultivations.b_lu, b_lu))
        })
    } catch (err) {
        throw handleError(err, "Exception for removeCultivation", { b_lu })
    }
}

/**
 * Updates the specified cultivation's details.
 *
 * Performs permission checks and validates that the new dates are logically consistent and that the referenced cultivation and catalogue entries exist. Depending on the inputs, it updates the main cultivation record along with its related sowing, termination, and, if applicable, harvest records.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The ID of the principal authorized to perform this update.
 * @param b_lu - The unique cultivation identifier.
 * @param b_lu_catalogue - (Optional) The new catalogue ID; if provided, it must correspond to an existing catalogue entry.
 * @param b_lu_start - (Optional) The updated sowing date; when provided with a termination date, it must precede it.
 * @param b_lu_end - (Optional) The updated termination date; if provided, it must be later than the sowing date.
 * @param m_cropresidue - (Optional) Whether crop residues are left on the field or not after termination of the cultivation.
 * @param b_lu_variety - (Optional) The updated variety of the cultivation.
 * @returns A Promise that resolves upon successful completion of the update.
 *
 * @throws {Error} If the cultivation does not exist, if date validations fail, or if the update operation encounters an issue.
 *
 * @alpha
 */
export async function updateCultivation(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_lu: schema.cultivationsTypeSelect["b_lu"],
    b_lu_catalogue?: schema.cultivationsTypeInsert["b_lu_catalogue"],
    b_lu_start?: schema.cultivationStartingTypeInsert["b_lu_start"],
    b_lu_end?: schema.cultivationEndingTypeInsert["b_lu_end"],
    m_cropresidue?: schema.cultivationEndingTypeInsert["m_cropresidue"],
    b_lu_variety?: schema.cultivationsTypeInsert["b_lu_variety"],
): Promise<void> {
    try {
        const updated = new Date()

        await checkPermission(
            fdm,
            "cultivation",
            "write",
            b_lu,
            principal_id,
            "updateCultivation",
        )

        if (
            b_lu_start &&
            b_lu_end &&
            b_lu_end.getTime() <= b_lu_start.getTime()
        ) {
            throw new Error("Terminate date must be after sowing date")
        }
        return await fdm.transaction(async (tx: FdmType) => {
            // Check if cultivation exists *before* attempting updates
            const existingCultivation = await tx
                .select()
                .from(schema.cultivations)
                .where(eq(schema.cultivations.b_lu, b_lu))
                .limit(1)

            if (existingCultivation.length === 0) {
                throw new Error("Cultivation does not exist")
            }

            //Validate if the cultivation exists in catalogue
            const cultivation = await tx
                .select()
                .from(schema.cultivationsCatalogue)
                .where(
                    eq(
                        schema.cultivationsCatalogue.b_lu_catalogue,
                        b_lu_catalogue ?? existingCultivation[0].b_lu_catalogue,
                    ),
                )
                .limit(1)

            if (cultivation.length === 0) {
                throw new Error("Cultivation does not exist in catalogue")
            }

            if (b_lu_catalogue) {
                await tx
                    .update(schema.cultivations)
                    .set({ b_lu_catalogue: b_lu_catalogue, updated: updated })
                    .where(eq(schema.cultivations.b_lu, b_lu))
            }

            if (b_lu_variety !== undefined) {
                if (b_lu_variety) {
                    // Determine which catalogue to validate against (new vs existing)
                    const catalogueIdToValidate =
                        b_lu_catalogue ?? existingCultivation[0].b_lu_catalogue

                    // Validate if variety is listed as option for this cultivation
                    const catalogueEntry = await tx
                        .select({
                            b_lu_variety_options:
                                schema.cultivationsCatalogue
                                    .b_lu_variety_options,
                        })
                        .from(schema.cultivationsCatalogue)
                        .where(
                            eq(
                                schema.cultivationsCatalogue.b_lu_catalogue,
                                catalogueIdToValidate, // Use new catalogue if provided
                            ),
                        )
                        .limit(1)

                    if (
                        catalogueEntry.length > 0 &&
                        catalogueEntry[0].b_lu_variety_options &&
                        !catalogueEntry[0].b_lu_variety_options.includes(
                            b_lu_variety,
                        )
                    ) {
                        throw new Error(
                            "Variety not available for this cultivation",
                        )
                    }
                }

                await tx
                    .update(schema.cultivations)
                    .set({ b_lu_variety: b_lu_variety, updated: updated })
                    .where(eq(schema.cultivations.b_lu, b_lu))
            }

            if (b_lu_start) {
                // Validate if sowing date is before termination date
                if (b_lu_end === undefined) {
                    const result = await tx
                        .select({
                            b_lu_end: schema.cultivationEnding.b_lu_end,
                        })
                        .from(schema.cultivationEnding)
                        .where(
                            and(
                                eq(schema.cultivationEnding.b_lu, b_lu),
                                isNotNull(schema.cultivationEnding.b_lu_end),
                            ),
                        )
                        .limit(1)

                    if (result.length > 0 && result[0].b_lu_end) {
                        if (
                            b_lu_start.getTime() >= result[0].b_lu_end.getTime()
                        ) {
                            throw new Error(
                                "Sowing date must be before termination date",
                            )
                        }
                    }
                }

                await tx
                    .update(schema.cultivationStarting)
                    .set({ b_lu_start: b_lu_start, updated: updated })
                    .where(eq(schema.cultivationStarting.b_lu, b_lu))
            }

            if (b_lu_end) {
                // Validate if terminatinge date is after sowing date
                if (!b_lu_start) {
                    const result = await tx
                        .select({
                            b_lu_start: schema.cultivationStarting.b_lu_start,
                        })
                        .from(schema.cultivationStarting)
                        .where(
                            and(
                                eq(schema.cultivationStarting.b_lu, b_lu),
                                isNotNull(
                                    schema.cultivationStarting.b_lu_start,
                                ),
                            ),
                        )
                        .limit(1)

                    if (result.length > 0) {
                        if (
                            result[0].b_lu_start.getTime() >= b_lu_end.getTime()
                        ) {
                            throw new Error(
                                "Terminate date must be after sowing date",
                            )
                        }
                    }
                }

                await tx
                    .update(schema.cultivationEnding)
                    .set({
                        updated: updated,
                        b_lu_end: b_lu_end,
                    })
                    .where(eq(schema.cultivationEnding.b_lu, b_lu))
            }

            if (m_cropresidue !== undefined) {
                await tx
                    .update(schema.cultivationEnding)
                    .set({
                        updated: updated,
                        m_cropresidue: m_cropresidue,
                    })
                    .where(eq(schema.cultivationEnding.b_lu, b_lu))
            }

            if (b_lu_end) {
                const harvestableType = await getHarvestableTypeOfCultivation(
                    tx,
                    b_lu,
                )
                if (harvestableType === "once") {
                    // If harvestable type is "once", add harvest on terminate date
                    const harvests = await getHarvests(tx, principal_id, b_lu)
                    if (harvests.length > 0) {
                        await tx
                            .update(schema.cultivationHarvesting)
                            .set({
                                updated: updated,
                                b_lu_harvest_date: b_lu_end,
                            })
                            .where(
                                eq(
                                    schema.cultivationHarvesting
                                        .b_id_harvesting,
                                    harvests[0].b_id_harvesting,
                                ),
                            )
                    } else {
                        // If cultivation can only be harvested once, add harvest on terminate date
                        const defaultHarvestParameters =
                            await getDefaultsForHarvestParameters(
                                b_lu_catalogue ??
                                    existingCultivation[0].b_lu_catalogue,
                                cultivation,
                            )

                        await addHarvest(
                            tx,
                            principal_id,
                            b_lu,
                            b_lu_end,
                            defaultHarvestParameters,
                        )
                    }
                }
            } else if (b_lu_end === null) {
                const harvestableType = await getHarvestableTypeOfCultivation(
                    tx,
                    b_lu,
                )
                if (harvestableType === "once") {
                    // If harvestable type is "once", remove the harvest
                    const harvests = await getHarvests(tx, principal_id, b_lu)
                    await Promise.all(
                        harvests.map((harvest) =>
                            removeHarvest(
                                tx,
                                principal_id,
                                harvest.b_id_harvesting,
                            ),
                        ),
                    )
                } else {
                    await tx
                        .update(schema.cultivationEnding)
                        .set({ b_lu_end: null, updated: updated })
                        .where(eq(schema.cultivationEnding.b_lu, b_lu))
                }
            }
        })
    } catch (err) {
        throw handleError(err, "Exception for updateCultivation", {
            b_lu,
            b_lu_catalogue,
            b_lu_start,
            b_lu_end,
            m_cropresidue,
            b_lu_variety,
        })
    }
}

/**
 * Builds a SQL condition for filtering cultivations based on a timeframe.
 *
 * This function constructs a SQL clause to filter cultivations that overlap
 * with a given timeframe. An overlap occurs if the cultivation's start is before
 * the timeframe's end, AND the cultivation's end is after the timeframe's start.
 * A cultivation with no end date is considered to extend indefinitely into the future,
 * which correctly includes it in the timeframe if it started before the timeframe ended.
 *
 * @param timeframe - An object with optional `start` and `end` Date properties.
 * @returns A Drizzle-ORM SQL condition, or `undefined` if the timeframe is not provided.
 */
export const buildCultivationTimeframeCondition = (
    timeframe: Timeframe | undefined,
): SQL | undefined => {
    if (!timeframe?.start || !timeframe?.end) {
        return undefined
    }

    // A cultivation is within the timeframe if:
    // 1. It has an end date AND (it starts within, ends within, or spans the timeframe)
    // OR
    // 2. It does NOT have an end date AND its start date is on or before the timeframe's end.
    return or(
        // Case 1: Cultivation has an end date and overlaps with the timeframe
        and(
            isNotNull(schema.cultivationEnding.b_lu_end),
            or(
                // Cultivation starts within the timeframe
                and(
                    gte(schema.cultivationStarting.b_lu_start, timeframe.start),
                    lte(schema.cultivationStarting.b_lu_start, timeframe.end),
                ),
                // Cultivation ends within the timeframe
                and(
                    gte(schema.cultivationEnding.b_lu_end, timeframe.start),
                    lte(schema.cultivationEnding.b_lu_end, timeframe.end),
                ),
                // Cultivation spans the entire timeframe
                and(
                    lte(schema.cultivationStarting.b_lu_start, timeframe.start),
                    gte(schema.cultivationEnding.b_lu_end, timeframe.end),
                ),
            ),
        ),
        // Case 2: Cultivation has no end date and its start is on or before the timeframe's end
        and(
            isNull(schema.cultivationEnding.b_lu_end),
            lte(schema.cultivationStarting.b_lu_start, timeframe.end),
        ),
    )
}
