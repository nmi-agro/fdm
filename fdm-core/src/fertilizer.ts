import {
    type ApplicationMethods,
    type CatalogueFertilizerItem,
    hashFertilizer,
} from "@nmi-agro/fdm-data"
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm"
import { checkPermission } from "./authorization"
import type { PrincipalId } from "./authorization.types"
import { getEnabledFertilizerCatalogues } from "./catalogues"
import * as schema from "./db/schema"
import * as authZSchema from "./db/schema-authz"
import { handleError } from "./error"
import type { FdmType } from "./fdm.types"
import type {
    BaseFertilizerApplication,
    Fertilizer,
    FertilizerApplication,
    FertilizerCatalogue,
    FertilizerParameterDescription,
} from "./fertilizer.types"
import {
    APP_AMOUNT_UNITS,
    type AppAmountUnit,
    fromKgPerHa,
    toKgPerHa,
} from "./fertilizer-application-unit-conversion"
import { createId } from "./id"
import type { Timeframe } from "./timeframe"

/**
 * Retrieves all fertilizers from the enabled catalogues for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @returns A Promise that resolves with an array of fertilizer catalogue entries.
 * @alpha
 */
export async function getFertilizersFromCatalogue(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<FertilizerCatalogue[]> {
    try {
        const catalogueIds = await getEnabledFertilizerCatalogues(
            fdm,
            principal_id,
            b_id_farm,
        )
        return await getFertilizersFromCatalogues(
            fdm,
            principal_id,
            catalogueIds,
        )
    } catch (err) {
        throw handleError(err, "Exception for getFertilizersFromCatalogue", {
            principal_id,
            b_id_farm,
        })
    }
}

/**
 * Retrieves all fertilizers from the catalogues whose source IDs are given.
 *
 * Only catalogue sources that are enabled for farms accessible by the given principal are returned.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param catalogueIds Catalogue source IDs to retrieve fertilizers from, such as "baat" or "srm".
 * @returns A Promise that resolves with a flat array of fertilizer catalogue entries across all given catalogues.
 * @alpha
 */
export async function getFertilizersFromCatalogues(
    fdm: FdmType,
    principal_id: PrincipalId,
    catalogueIds: schema.fertilizersCatalogueTypeSelect["p_source"][],
): Promise<FertilizerCatalogue[]> {
    try {
        if (catalogueIds.length === 0) {
            return []
        }

        // Filter to only catalogue sources that are enabled for farms the principal can access
        const authorizedRows = await fdm
            .selectDistinct({
                p_source: schema.fertilizerCatalogueEnabling.p_source,
            })
            .from(schema.fertilizerCatalogueEnabling)
            .innerJoin(
                authZSchema.role,
                and(
                    eq(authZSchema.role.resource, "farm"),
                    eq(
                        authZSchema.role.resource_id,
                        schema.fertilizerCatalogueEnabling.b_id_farm,
                    ),
                    inArray(
                        authZSchema.role.principal_id,
                        [principal_id].flat(),
                    ),
                    isNull(authZSchema.role.deleted),
                ),
            )
            .where(
                inArray(
                    schema.fertilizerCatalogueEnabling.p_source,
                    catalogueIds,
                ),
            )
        const authorizedSources = new Set(
            authorizedRows.map((r: { p_source: string }) => r.p_source),
        )
        const filteredCatalogueIds = catalogueIds.filter((id) =>
            authorizedSources.has(id),
        )
        if (filteredCatalogueIds.length === 0) {
            return []
        }

        const fertilizersCatalogue: schema.fertilizersCatalogueTypeSelect[] =
            await fdm
                .select()
                .from(schema.fertilizersCatalogue)
                .where(
                    inArray(
                        schema.fertilizersCatalogue.p_source,
                        filteredCatalogueIds,
                    ),
                )
                .orderBy(
                    asc(schema.fertilizersCatalogue.p_source),
                    asc(schema.fertilizersCatalogue.p_name_nl),
                )

        return fertilizersCatalogue.map((result) => ({
            ...result,
            p_app_method_options: result.p_app_method_options as
                | ApplicationMethods[]
                | null,
            p_app_amount_unit: result.p_app_amount_unit as AppAmountUnit,
            p_type: deriveFertilizerType(result),
        }))
    } catch (err) {
        throw handleError(err, "Exception for getFertilizersFromCatalogues", {
            catalogueIds,
        })
    }
}

/**
 * Adds a new custom fertilizer to the catalogue of a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param properties The properties of the fertilizer to add.
 * @returns A Promise that resolves when the fertilizer has been added.
 * @throws If adding the fertilizer fails.
 * @alpha
 */
export async function addFertilizerToCatalogue(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
    properties: {
        p_name_nl: schema.fertilizersCatalogueTypeInsert["p_name_nl"]
        p_name_en: schema.fertilizersCatalogueTypeInsert["p_name_en"]
        p_description: schema.fertilizersCatalogueTypeInsert["p_description"]
        p_app_method_options: schema.fertilizersCatalogueTypeInsert["p_app_method_options"]
        p_app_amount_unit: schema.fertilizersCatalogueTypeInsert["p_app_amount_unit"]
        p_dm: schema.fertilizersCatalogueTypeInsert["p_dm"]
        p_density: schema.fertilizersCatalogueTypeInsert["p_density"]
        p_om: schema.fertilizersCatalogueTypeInsert["p_om"]
        p_a: schema.fertilizersCatalogueTypeInsert["p_a"]
        p_hc: schema.fertilizersCatalogueTypeInsert["p_hc"]
        p_eom: schema.fertilizersCatalogueTypeInsert["p_eom"]
        p_eoc: schema.fertilizersCatalogueTypeInsert["p_eoc"]
        p_c_rt: schema.fertilizersCatalogueTypeInsert["p_c_rt"]
        p_c_of: schema.fertilizersCatalogueTypeInsert["p_c_of"]
        p_c_if: schema.fertilizersCatalogueTypeInsert["p_c_if"]
        p_c_fr: schema.fertilizersCatalogueTypeInsert["p_c_fr"]
        p_cn_of: schema.fertilizersCatalogueTypeInsert["p_cn_of"]
        p_n_rt: schema.fertilizersCatalogueTypeInsert["p_n_rt"]
        p_n_if: schema.fertilizersCatalogueTypeInsert["p_n_if"]
        p_n_of: schema.fertilizersCatalogueTypeInsert["p_n_of"]
        p_n_wc: schema.fertilizersCatalogueTypeInsert["p_n_wc"]
        p_no3_rt: schema.fertilizersCatalogueTypeInsert["p_no3_rt"]
        p_nh4_rt: schema.fertilizersCatalogueTypeInsert["p_nh4_rt"]
        p_p_rt: schema.fertilizersCatalogueTypeInsert["p_p_rt"]
        p_k_rt: schema.fertilizersCatalogueTypeInsert["p_k_rt"]
        p_mg_rt: schema.fertilizersCatalogueTypeInsert["p_mg_rt"]
        p_ca_rt: schema.fertilizersCatalogueTypeInsert["p_ca_rt"]
        p_ne: schema.fertilizersCatalogueTypeInsert["p_ne"]
        p_s_rt: schema.fertilizersCatalogueTypeInsert["p_s_rt"]
        p_s_wc: schema.fertilizersCatalogueTypeInsert["p_s_wc"]
        p_cu_rt: schema.fertilizersCatalogueTypeInsert["p_cu_rt"]
        p_zn_rt: schema.fertilizersCatalogueTypeInsert["p_zn_rt"]
        p_na_rt: schema.fertilizersCatalogueTypeInsert["p_na_rt"]
        p_si_rt: schema.fertilizersCatalogueTypeInsert["p_si_rt"]
        p_b_rt: schema.fertilizersCatalogueTypeInsert["p_b_rt"]
        p_mn_rt: schema.fertilizersCatalogueTypeInsert["p_mn_rt"]
        p_ni_rt: schema.fertilizersCatalogueTypeInsert["p_ni_rt"]
        p_fe_rt: schema.fertilizersCatalogueTypeInsert["p_fe_rt"]
        p_mo_rt: schema.fertilizersCatalogueTypeInsert["p_mo_rt"]
        p_co_rt: schema.fertilizersCatalogueTypeInsert["p_co_rt"]
        p_as_rt: schema.fertilizersCatalogueTypeInsert["p_as_rt"]
        p_cd_rt: schema.fertilizersCatalogueTypeInsert["p_cd_rt"]
        p_cr_rt: schema.fertilizersCatalogueTypeInsert["p_cr_rt"]
        p_cr_vi: schema.fertilizersCatalogueTypeInsert["p_cr_vi"]
        p_pb_rt: schema.fertilizersCatalogueTypeInsert["p_pb_rt"]
        p_hg_rt: schema.fertilizersCatalogueTypeInsert["p_hg_rt"]
        p_cl_rt: schema.fertilizersCatalogueTypeInsert["p_cl_rt"]
        p_ef_nh3: schema.fertilizersCatalogueTypeInsert["p_ef_nh3"]
        p_type: "manure" | "mineral" | "compost" | null
        p_type_rvo: schema.fertilizersCatalogueTypeInsert["p_type_rvo"]
    },
): Promise<schema.fertilizersCatalogueTypeSelect["p_id_catalogue"]> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "write",
            b_id_farm,
            principal_id,
            "addFertilizerToCatalogue",
        )

        const p_id_catalogue = createId()
        const input: schema.fertilizersCatalogueTypeInsert = {
            ...properties,
            p_id_catalogue: p_id_catalogue,
            p_source: b_id_farm,
            hash: null,
            p_type_manure: properties.p_type === "manure",
            p_type_mineral: properties.p_type === "mineral",
            p_type_compost: properties.p_type === "compost",
        }
        input.hash = await hashFertilizer(
            input as unknown as CatalogueFertilizerItem,
        )

        // Insert the farm in the db
        await fdm.insert(schema.fertilizersCatalogue).values(input)

        return p_id_catalogue
    } catch (err) {
        throw handleError(err, "Exception for addFertilizerToCatalogue", {
            properties,
        })
    }
}

/**
 * Adds a fertilizer aqcuiring record to a farm.
 *
 * This function creates a new fertilizer acquiring record by performing a transactional insertion into the
 * fertilizers, fertilizerAcquiring, and fertilizerPicking tables. It verifies that the user has write permission
 * on the specified farm before proceeding.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The identifier of the user making the request.
 * @param p_id_catalogue The catalogue ID of the fertilizer.
 * @param b_id_farm The ID of the farm where the fertilizer is applied.
 * @param p_acquiring_amount The amount of fertilizer acquired.
 * @param p_acquiring_date The date when the fertilizer was acquired.
 * @returns A Promise resolving to the ID of the newly created fertilizer acquiring record.
 * @throws If adding the fertilizer acquiring record fails.
 * @alpha
 */
export async function addFertilizer(
    fdm: FdmType,
    principal_id: PrincipalId,
    p_id_catalogue: schema.fertilizersCatalogueTypeInsert["p_id_catalogue"],
    b_id_farm: schema.fertilizerAcquiringTypeInsert["b_id_farm"],
    p_acquiring_amount: schema.fertilizerAcquiringTypeInsert["p_acquiring_amount"],
    p_acquiring_date: schema.fertilizerAcquiringTypeInsert["p_acquiring_date"],
): Promise<schema.fertilizerAcquiringTypeInsert["p_id"]> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "write",
            b_id_farm,
            principal_id,
            "addFertilizer",
        )

        return await fdm.transaction(async (tx) => {
            // Generate an ID for the fertilizer
            const p_id = createId()

            // Insert the fertilizer in the db
            const fertilizerAcquiringData = {
                b_id_farm: b_id_farm,
                p_id: p_id,
                p_acquiring_amount: p_acquiring_amount,
                p_acquiring_date: p_acquiring_date,
            }

            const fertilizerPickingData = {
                p_id: p_id,
                p_id_catalogue: p_id_catalogue,
                p_picking_date: new Date(),
            }

            await tx.insert(schema.fertilizers).values({
                p_id: p_id,
            })

            await tx
                .insert(schema.fertilizerAcquiring)
                .values(fertilizerAcquiringData)

            await tx
                .insert(schema.fertilizerPicking)
                .values(fertilizerPickingData)

            return p_id
        })
    } catch (err) {
        throw handleError(err, "Exception for addFertilizer", {
            p_id_catalogue,
            b_id_farm,
            p_acquiring_amount,
            p_acquiring_date,
        })
    }
}

/**
 * Retrieves the details of a specific fertilizer.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param p_id The ID of the fertilizer.
 * @returns A Promise that resolves with the fertilizer details.
 * @throws If retrieving the fertilizer details fails or the fertilizer is not found.
 * @alpha
 */
export async function getFertilizer(
    fdm: FdmType,
    p_id: schema.fertilizersTypeSelect["p_id"],
): Promise<Fertilizer> {
    try {
        // Get properties of the requested fertilizer
        const fertilizer = await fdm
            .select({
                p_id: schema.fertilizers.p_id,
                p_id_catalogue: schema.fertilizersCatalogue.p_id_catalogue,
                p_source: schema.fertilizersCatalogue.p_source,
                p_name_nl: schema.fertilizersCatalogue.p_name_nl,
                p_name_en: schema.fertilizersCatalogue.p_name_en,
                p_description: schema.fertilizersCatalogue.p_description,
                p_app_method_options:
                    schema.fertilizersCatalogue.p_app_method_options,
                p_app_amount_unit:
                    schema.fertilizersCatalogue.p_app_amount_unit,
                p_acquiring_amount:
                    schema.fertilizerAcquiring.p_acquiring_amount,
                p_acquiring_date: schema.fertilizerAcquiring.p_acquiring_date,
                p_picking_date: schema.fertilizerPicking.p_picking_date,
                p_dm: schema.fertilizersCatalogue.p_dm,
                p_density: schema.fertilizersCatalogue.p_density,
                p_om: schema.fertilizersCatalogue.p_om,
                p_a: schema.fertilizersCatalogue.p_a,
                p_hc: schema.fertilizersCatalogue.p_hc,
                p_eom: schema.fertilizersCatalogue.p_eom,
                p_eoc: schema.fertilizersCatalogue.p_eoc,
                p_c_rt: schema.fertilizersCatalogue.p_c_rt,
                p_c_of: schema.fertilizersCatalogue.p_c_of,
                p_c_if: schema.fertilizersCatalogue.p_c_if,
                p_c_fr: schema.fertilizersCatalogue.p_c_fr,
                p_cn_of: schema.fertilizersCatalogue.p_cn_of,
                p_n_rt: schema.fertilizersCatalogue.p_n_rt,
                p_n_if: schema.fertilizersCatalogue.p_n_if,
                p_n_of: schema.fertilizersCatalogue.p_n_of,
                p_n_wc: schema.fertilizersCatalogue.p_n_wc,
                p_no3_rt: schema.fertilizersCatalogue.p_no3_rt,
                p_nh4_rt: schema.fertilizersCatalogue.p_nh4_rt,
                p_p_rt: schema.fertilizersCatalogue.p_p_rt,
                p_k_rt: schema.fertilizersCatalogue.p_k_rt,
                p_mg_rt: schema.fertilizersCatalogue.p_mg_rt,
                p_ca_rt: schema.fertilizersCatalogue.p_ca_rt,
                p_ne: schema.fertilizersCatalogue.p_ne,
                p_s_rt: schema.fertilizersCatalogue.p_s_rt,
                p_s_wc: schema.fertilizersCatalogue.p_s_wc,
                p_cu_rt: schema.fertilizersCatalogue.p_cu_rt,
                p_zn_rt: schema.fertilizersCatalogue.p_zn_rt,
                p_na_rt: schema.fertilizersCatalogue.p_na_rt,
                p_si_rt: schema.fertilizersCatalogue.p_si_rt,
                p_b_rt: schema.fertilizersCatalogue.p_b_rt,
                p_mn_rt: schema.fertilizersCatalogue.p_mn_rt,
                p_ni_rt: schema.fertilizersCatalogue.p_ni_rt,
                p_fe_rt: schema.fertilizersCatalogue.p_fe_rt,
                p_mo_rt: schema.fertilizersCatalogue.p_mo_rt,
                p_co_rt: schema.fertilizersCatalogue.p_co_rt,
                p_as_rt: schema.fertilizersCatalogue.p_as_rt,
                p_cd_rt: schema.fertilizersCatalogue.p_cd_rt,
                p_cr_rt: schema.fertilizersCatalogue.p_cr_rt,
                p_cr_vi: schema.fertilizersCatalogue.p_cr_vi,
                p_pb_rt: schema.fertilizersCatalogue.p_pb_rt,
                p_hg_rt: schema.fertilizersCatalogue.p_hg_rt,
                p_cl_rt: schema.fertilizersCatalogue.p_cl_rt,
                p_ef_nh3: schema.fertilizersCatalogue.p_ef_nh3,
                p_type_manure: schema.fertilizersCatalogue.p_type_manure,
                p_type_mineral: schema.fertilizersCatalogue.p_type_mineral,
                p_type_compost: schema.fertilizersCatalogue.p_type_compost,
                p_type_rvo: schema.fertilizersCatalogue.p_type_rvo,
            })
            .from(schema.fertilizers)
            .leftJoin(
                schema.fertilizerAcquiring,
                eq(schema.fertilizers.p_id, schema.fertilizerAcquiring.p_id),
            )
            .leftJoin(
                schema.fertilizerPicking,
                eq(schema.fertilizers.p_id, schema.fertilizerPicking.p_id),
            )
            .leftJoin(
                schema.fertilizersCatalogue,
                eq(
                    schema.fertilizerPicking.p_id_catalogue,
                    schema.fertilizersCatalogue.p_id_catalogue,
                ),
            )
            .where(eq(schema.fertilizers.p_id, p_id))
            .limit(1)

        const result = fertilizer[0]
        if (!result) {
            throw new Error("Fertilizer not found")
        }

        return {
            ...result,
            p_type: deriveFertilizerType(
                result as Partial<schema.fertilizersCatalogueTypeSelect>,
            ),
        } as unknown as Fertilizer
    } catch (err) {
        throw handleError(err, "Exception for getFertilizer", {
            p_id,
        })
    }
}

/**
 * Updates an existing fertilizer in the catalogue of a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param p_id_catalogue The ID of the fertilizer in the catalogue to update
 * @param properties The properties of the fertilizer to update.
 * @returns A Promise that resolves when the fertilizer has been updated.
 * @throws If updating the fertilizer fails.
 * @alpha
 */
export async function updateFertilizerFromCatalogue(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
    p_id_catalogue: schema.fertilizersCatalogueTypeInsert["p_id_catalogue"],
    properties: Partial<{
        p_name_nl: schema.fertilizersCatalogueTypeInsert["p_name_nl"]
        p_name_en: schema.fertilizersCatalogueTypeInsert["p_name_en"]
        p_description: schema.fertilizersCatalogueTypeInsert["p_description"]
        p_app_method_options: schema.fertilizersCatalogueTypeInsert["p_app_method_options"]
        p_dm: schema.fertilizersCatalogueTypeInsert["p_dm"]
        p_density: schema.fertilizersCatalogueTypeInsert["p_density"]
        p_om: schema.fertilizersCatalogueTypeInsert["p_om"]
        p_a: schema.fertilizersCatalogueTypeInsert["p_a"]
        p_hc: schema.fertilizersCatalogueTypeInsert["p_hc"]
        p_eom: schema.fertilizersCatalogueTypeInsert["p_eom"]
        p_eoc: schema.fertilizersCatalogueTypeInsert["p_eoc"]
        p_c_rt: schema.fertilizersCatalogueTypeInsert["p_c_rt"]
        p_c_of: schema.fertilizersCatalogueTypeInsert["p_c_of"]
        p_c_if: schema.fertilizersCatalogueTypeInsert["p_c_if"]
        p_c_fr: schema.fertilizersCatalogueTypeInsert["p_c_fr"]
        p_cn_of: schema.fertilizersCatalogueTypeInsert["p_cn_of"]
        p_n_rt: schema.fertilizersCatalogueTypeInsert["p_n_rt"]
        p_n_if: schema.fertilizersCatalogueTypeInsert["p_n_if"]
        p_n_of: schema.fertilizersCatalogueTypeInsert["p_n_of"]
        p_n_wc: schema.fertilizersCatalogueTypeInsert["p_n_wc"]
        p_no3_rt: schema.fertilizersCatalogueTypeInsert["p_no3_rt"]
        p_nh4_rt: schema.fertilizersCatalogueTypeInsert["p_nh4_rt"]
        p_p_rt: schema.fertilizersCatalogueTypeInsert["p_p_rt"]
        p_k_rt: schema.fertilizersCatalogueTypeInsert["p_k_rt"]
        p_mg_rt: schema.fertilizersCatalogueTypeInsert["p_mg_rt"]
        p_ca_rt: schema.fertilizersCatalogueTypeInsert["p_ca_rt"]
        p_ne: schema.fertilizersCatalogueTypeInsert["p_ne"]
        p_s_rt: schema.fertilizersCatalogueTypeInsert["p_s_rt"]
        p_s_wc: schema.fertilizersCatalogueTypeInsert["p_s_wc"]
        p_cu_rt: schema.fertilizersCatalogueTypeInsert["p_cu_rt"]
        p_zn_rt: schema.fertilizersCatalogueTypeInsert["p_zn_rt"]
        p_na_rt: schema.fertilizersCatalogueTypeInsert["p_na_rt"]
        p_si_rt: schema.fertilizersCatalogueTypeInsert["p_si_rt"]
        p_b_rt: schema.fertilizersCatalogueTypeInsert["p_b_rt"]
        p_mn_rt: schema.fertilizersCatalogueTypeInsert["p_mn_rt"]
        p_ni_rt: schema.fertilizersCatalogueTypeInsert["p_ni_rt"]
        p_fe_rt: schema.fertilizersCatalogueTypeInsert["p_fe_rt"]
        p_mo_rt: schema.fertilizersCatalogueTypeInsert["p_mo_rt"]
        p_co_rt: schema.fertilizersCatalogueTypeInsert["p_co_rt"]
        p_as_rt: schema.fertilizersCatalogueTypeInsert["p_as_rt"]
        p_cd_rt: schema.fertilizersCatalogueTypeInsert["p_cd_rt"]
        p_cr_rt: schema.fertilizersCatalogueTypeInsert["p_cr_rt"]
        p_cr_vi: schema.fertilizersCatalogueTypeInsert["p_cr_vi"]
        p_pb_rt: schema.fertilizersCatalogueTypeInsert["p_pb_rt"]
        p_hg_rt: schema.fertilizersCatalogueTypeInsert["p_hg_rt"]
        p_cl_rt: schema.fertilizersCatalogueTypeInsert["p_cl_rt"]
        p_ef_nh3: schema.fertilizersCatalogueTypeInsert["p_ef_nh3"]
        p_type: "manure" | "mineral" | "compost" | null
        p_type_rvo: schema.fertilizersCatalogueTypeInsert["p_type_rvo"]
    }>,
): Promise<void> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "write",
            b_id_farm,
            principal_id,
            "updateFertilizerFromCatalogue",
        )

        const existingFertilizer = await fdm
            .select()
            .from(schema.fertilizersCatalogue)
            .where(
                and(
                    eq(
                        schema.fertilizersCatalogue.p_id_catalogue,
                        p_id_catalogue,
                    ),
                    eq(schema.fertilizersCatalogue.p_source, b_id_farm),
                ),
            )
        if (existingFertilizer.length === 0) {
            throw new Error("Fertilizer does not exist in catalogue")
        }

        const { p_type, ...rest } = properties
        const updatedProperties: schema.fertilizersCatalogueTypeInsert = {
            ...existingFertilizer[0],
            ...rest,
            hash: null,
            // Preserve current flags when p_type is not provided
            p_type_manure:
                p_type !== undefined
                    ? p_type === "manure"
                    : existingFertilizer[0].p_type_manure,
            p_type_mineral:
                p_type !== undefined
                    ? p_type === "mineral"
                    : existingFertilizer[0].p_type_mineral,
            p_type_compost:
                p_type !== undefined
                    ? p_type === "compost"
                    : existingFertilizer[0].p_type_compost,
        }
        updatedProperties.hash = await hashFertilizer(
            updatedProperties as unknown as CatalogueFertilizerItem,
        )

        await fdm
            .update(schema.fertilizersCatalogue)
            .set(updatedProperties)
            .where(
                and(
                    eq(
                        schema.fertilizersCatalogue.p_id_catalogue,
                        p_id_catalogue,
                    ),
                    eq(schema.fertilizersCatalogue.p_source, b_id_farm),
                ),
            )
    } catch (err) {
        throw handleError(err, "Exception for updateFertilizerFromCatalogue", {
            p_id_catalogue,
            properties,
        })
    }
}

/**
 * Retrieves fertilizer details for a specified farm.
 *
 * This function verifies that the requesting principal has read access to the farm,
 * then queries the database to return a list of fertilizers along with their catalogue
 * and application details.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The ID of the principal making the request.
 * @param b_id_farm - The ID of the farm for which the fertilizers are retrieved.
 * @returns A promise that resolves with an array of fertilizer detail objects.
 *
 * @alpha
 */
export async function getFertilizers(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.fertilizerAcquiringTypeSelect["b_id_farm"],
) {
    try {
        await checkPermission(
            fdm,
            "farm",
            "read",
            b_id_farm,
            principal_id,
            "getFertilizers",
        )

        const fertilizers = await fdm
            .select({
                b_id_farm: schema.fertilizerAcquiring.b_id_farm,
                p_id: schema.fertilizers.p_id,
                p_id_catalogue: schema.fertilizersCatalogue.p_id_catalogue,
                p_source: schema.fertilizersCatalogue.p_source,
                p_name_nl: schema.fertilizersCatalogue.p_name_nl,
                p_name_en: schema.fertilizersCatalogue.p_name_en,
                p_description: schema.fertilizersCatalogue.p_description,
                p_app_method_options:
                    schema.fertilizersCatalogue.p_app_method_options,
                p_app_amount_unit:
                    schema.fertilizersCatalogue.p_app_amount_unit,
                p_acquiring_amount:
                    schema.fertilizerAcquiring.p_acquiring_amount,
                p_acquiring_date: schema.fertilizerAcquiring.p_acquiring_date,
                p_picking_date: schema.fertilizerPicking.p_picking_date,
                p_dm: schema.fertilizersCatalogue.p_dm,
                p_density: schema.fertilizersCatalogue.p_density,
                p_om: schema.fertilizersCatalogue.p_om,
                p_a: schema.fertilizersCatalogue.p_a,
                p_hc: schema.fertilizersCatalogue.p_hc,
                p_eom: schema.fertilizersCatalogue.p_eom,
                p_eoc: schema.fertilizersCatalogue.p_eoc,
                p_c_rt: schema.fertilizersCatalogue.p_c_rt,
                p_c_of: schema.fertilizersCatalogue.p_c_of,
                p_c_if: schema.fertilizersCatalogue.p_c_if,
                p_c_fr: schema.fertilizersCatalogue.p_c_fr,
                p_cn_of: schema.fertilizersCatalogue.p_cn_of,
                p_n_rt: schema.fertilizersCatalogue.p_n_rt,
                p_n_if: schema.fertilizersCatalogue.p_n_if,
                p_n_of: schema.fertilizersCatalogue.p_n_of,
                p_n_wc: schema.fertilizersCatalogue.p_n_wc,
                p_no3_rt: schema.fertilizersCatalogue.p_no3_rt,
                p_nh4_rt: schema.fertilizersCatalogue.p_nh4_rt,
                p_p_rt: schema.fertilizersCatalogue.p_p_rt,
                p_k_rt: schema.fertilizersCatalogue.p_k_rt,
                p_mg_rt: schema.fertilizersCatalogue.p_mg_rt,
                p_ca_rt: schema.fertilizersCatalogue.p_ca_rt,
                p_ne: schema.fertilizersCatalogue.p_ne,
                p_s_rt: schema.fertilizersCatalogue.p_s_rt,
                p_s_wc: schema.fertilizersCatalogue.p_s_wc,
                p_cu_rt: schema.fertilizersCatalogue.p_cu_rt,
                p_zn_rt: schema.fertilizersCatalogue.p_zn_rt,
                p_na_rt: schema.fertilizersCatalogue.p_na_rt,
                p_si_rt: schema.fertilizersCatalogue.p_si_rt,
                p_b_rt: schema.fertilizersCatalogue.p_b_rt,
                p_mn_rt: schema.fertilizersCatalogue.p_mn_rt,
                p_ni_rt: schema.fertilizersCatalogue.p_ni_rt,
                p_fe_rt: schema.fertilizersCatalogue.p_fe_rt,
                p_mo_rt: schema.fertilizersCatalogue.p_mo_rt,
                p_co_rt: schema.fertilizersCatalogue.p_co_rt,
                p_as_rt: schema.fertilizersCatalogue.p_as_rt,
                p_cd_rt: schema.fertilizersCatalogue.p_cd_rt,
                p_cr_rt: schema.fertilizersCatalogue.p_cr_rt,
                p_cr_vi: schema.fertilizersCatalogue.p_cr_vi,
                p_pb_rt: schema.fertilizersCatalogue.p_pb_rt,
                p_hg_rt: schema.fertilizersCatalogue.p_hg_rt,
                p_cl_rt: schema.fertilizersCatalogue.p_cl_rt,
                p_ef_nh3: schema.fertilizersCatalogue.p_ef_nh3,
                p_type_manure: schema.fertilizersCatalogue.p_type_manure,
                p_type_mineral: schema.fertilizersCatalogue.p_type_mineral,
                p_type_compost: schema.fertilizersCatalogue.p_type_compost,
                p_type_rvo: schema.fertilizersCatalogue.p_type_rvo,
            })
            .from(schema.fertilizers)
            .leftJoin(
                schema.fertilizerAcquiring,
                eq(schema.fertilizers.p_id, schema.fertilizerAcquiring.p_id),
            )
            .leftJoin(
                schema.fertilizerPicking,
                eq(schema.fertilizers.p_id, schema.fertilizerPicking.p_id),
            )
            .leftJoin(
                schema.fertilizersCatalogue,
                eq(
                    schema.fertilizerPicking.p_id_catalogue,
                    schema.fertilizersCatalogue.p_id_catalogue,
                ),
            )
            .where(eq(schema.fertilizerAcquiring.b_id_farm, b_id_farm))
            .orderBy(asc(schema.fertilizersCatalogue.p_name_nl))

        return fertilizers.map((f: (typeof fertilizers)[number]) => {
            return {
                ...f,
                p_type: deriveFertilizerType(
                    f as Partial<schema.fertilizersCatalogueTypeSelect>,
                ),
            } as unknown as Fertilizer
        })
    } catch (err) {
        throw handleError(err, "Exception for getFertilizers", {
            b_id_farm,
        })
    }
}

/**
 * Removes a fertilizer from a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param p_id The ID of the fertilizer to remove.
 * @returns A Promise that resolves when the fertilizer has been removed.
 * @throws If removing the fertilizer fails.
 * @alpha
 */
export async function removeFertilizer(
    fdm: FdmType,
    p_id: schema.fertilizerAcquiringTypeInsert["p_id"],
): Promise<void> {
    try {
        return await fdm.transaction(async (tx) => {
            await tx
                .delete(schema.fertilizerAcquiring)
                .where(eq(schema.fertilizerAcquiring.p_id, p_id))

            await tx
                .delete(schema.fertilizerPicking)
                .where(eq(schema.fertilizerPicking.p_id, p_id))

            await tx
                .delete(schema.fertilizers)
                .where(eq(schema.fertilizers.p_id, p_id))
        })
    } catch (err) {
        throw handleError(err, "Exception for removeFertilizer", {
            p_id,
        })
    }
}

/**
 * Adds a fertilizer application record.
 *
 * Validates that the specified field and fertilizer exist and that the principal has write permission on the field before inserting the application record.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The ID of the principal performing the operation.
 * @param b_id - The ID of the field where the fertilizer application is recorded.
 * @param p_id - The ID of the fertilizer to be applied.
 * @param p_app_amount_display - The amount of fertilizer applied in the display unit.
 * @param p_app_method - The method used for applying the fertilizer.
 * @param p_app_date - The date of the fertilizer application.
 * @returns A Promise that resolves with the unique ID of the newly created fertilizer application record.
 *
 * @throws {Error} When the specified field or fertilizer does not exist or if the record insertion fails.
 */
export async function addFertilizerApplication(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id: schema.fertilizerApplicationTypeInsert["b_id"],
    p_id: schema.fertilizerApplicationTypeInsert["p_id"],
    p_app_amount_display: number,
    p_app_method: schema.fertilizerApplicationTypeInsert["p_app_method"],
    p_app_date: schema.fertilizerApplicationTypeInsert["p_app_date"],
): Promise<schema.fertilizerApplicationTypeInsert["p_app_id"]> {
    try {
        await checkPermission(
            fdm,
            "field",
            "write",
            b_id,
            principal_id,
            "addFertilizerApplication",
        )
        // Validate that the field exists
        const fieldExists = await fdm
            .select()
            .from(schema.fields)
            .where(eq(schema.fields.b_id, b_id))
            .limit(1)
        if (fieldExists.length === 0) {
            throw new Error(`Field with b_id ${b_id} does not exist`)
        }

        // Validate that the fertilizer exists and get it
        const fertilizer = await getFertilizer(fdm, p_id)

        const p_app_id = createId()

        const p_app_amount = toKgPerHa(
            p_app_amount_display,
            fertilizer.p_app_amount_unit,
            fertilizer.p_density,
        )

        await fdm.insert(schema.fertilizerApplication).values({
            p_app_id,
            b_id,
            p_id,
            p_app_amount,
            p_app_method,
            p_app_date,
        })

        return p_app_id
    } catch (err) {
        throw handleError(err, "Exception for addFertilizerApplication", {
            b_id,
            p_id,
            p_app_amount_display,
            p_app_method,
            p_app_date,
        })
    }
}

/**
 * Updates an existing fertilizer application record.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The ID of the principal performing the update.
 * @param p_app_id - The unique identifier of the fertilizer application record.
 * @param p_id - The unique identifier of the associated fertilizer.
 * @param p_app_amount_display - The amount of fertilizer applied in the display unit.
 * @param p_app_method - The method used for applying the fertilizer.
 * @param p_app_date - The date when the fertilizer was applied.
 *
 * @throws {Error} Thrown if the update operation fails due to insufficient permissions or a database error.
 */
export async function updateFertilizerApplication(
    fdm: FdmType,
    principal_id: PrincipalId,
    p_app_id: schema.fertilizerApplicationTypeInsert["p_app_id"],
    p_id: schema.fertilizerApplicationTypeInsert["p_id"],
    p_app_amount_display: number | undefined | null,
    p_app_method: schema.fertilizerApplicationTypeInsert["p_app_method"],
    p_app_date: schema.fertilizerApplicationTypeInsert["p_app_date"],
): Promise<void> {
    try {
        await checkPermission(
            fdm,
            "fertilizer_application",
            "write",
            p_app_id,
            principal_id,
            "updateFertilizerApplication",
        )
        const fertilizer = await getFertilizer(fdm, p_id)
        const p_app_amount =
            p_app_amount_display !== null && p_app_amount_display !== undefined
                ? toKgPerHa(
                      p_app_amount_display,
                      fertilizer.p_app_amount_unit,
                      fertilizer.p_density,
                  )
                : undefined
        await fdm
            .update(schema.fertilizerApplication)
            .set({ p_id, p_app_amount, p_app_method, p_app_date })
            .where(eq(schema.fertilizerApplication.p_app_id, p_app_id))
    } catch (err) {
        throw handleError(err, "Exception for updateFertilizerApplication", {
            p_app_id,
            p_id,
            p_app_amount_display,
            p_app_method,
            p_app_date,
        })
    }
}

/**
 * Removes a fertilizer application record.
 *
 * This function verifies that the principal has write permissions before deleting the fertilizer
 * application record identified by the given ID.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The ID of the principal performing the removal.
 * @param p_app_id - The fertilizer application record's ID to remove.
 *
 * @throws {Error} If the removal operation fails.
 */
export async function removeFertilizerApplication(
    fdm: FdmType,
    principal_id: PrincipalId,
    p_app_id: schema.fertilizerApplicationTypeInsert["p_app_id"],
): Promise<void> {
    try {
        await checkPermission(
            fdm,
            "fertilizer_application",
            "write",
            p_app_id,
            principal_id,
            "removeFertilizerApplication",
        )

        await fdm
            .delete(schema.fertilizerApplication)
            .where(eq(schema.fertilizerApplication.p_app_id, p_app_id))
    } catch (err) {
        throw handleError(err, "Exception for removeFertilizerApplication", {
            p_app_id,
        })
    }
}

/**
 * Retrieves a fertilizer application record by its unique identifier.
 *
 * Checks if the principal has read permission before querying the database for the fertilizer
 * application record, including associated catalogue details. Returns the record if found,
 * or null otherwise.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The ID of the principal retrieving the application.
 * @param p_app_id - The unique ID of the fertilizer application record.
 * @returns A Promise that resolves with the fertilizer application record, or null if not found.
 * @throws Error if the retrieval process fails.
 */
export async function getFertilizerApplication(
    fdm: FdmType,
    principal_id: PrincipalId,
    p_app_id: schema.fertilizerApplicationTypeSelect["p_app_id"],
): Promise<FertilizerApplication | null> {
    try {
        await checkPermission(
            fdm,
            "fertilizer_application",
            "read",
            p_app_id,
            principal_id,
            "getFertilizerApplication",
        )

        const result = (await fdm
            .select({
                p_id: schema.fertilizerApplication.p_id,
                p_id_catalogue: schema.fertilizersCatalogue.p_id_catalogue,
                p_name_nl: schema.fertilizersCatalogue.p_name_nl,
                p_app_amount: schema.fertilizerApplication.p_app_amount,
                p_app_amount_unit:
                    schema.fertilizersCatalogue.p_app_amount_unit,
                p_density: schema.fertilizersCatalogue.p_density,
                p_app_method: schema.fertilizerApplication.p_app_method,
                p_app_date: schema.fertilizerApplication.p_app_date,
                p_app_id: schema.fertilizerApplication.p_app_id,
            })
            .from(schema.fertilizerApplication)
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
            .where(
                eq(schema.fertilizerApplication.p_app_id, p_app_id),
            )) as (BaseFertilizerApplication & {
            p_app_amount_unit: AppAmountUnit
            p_density: number | null
        })[]

        return result.length > 0
            ? extendFertilizerApplication(
                  result[0],
                  result[0].p_app_amount_unit,
                  result[0].p_density,
              )
            : null
    } catch (err) {
        throw handleError(err, "Exception for getFertilizerApplication", {
            p_app_id,
        })
    }
}

/**
 * Retrieves fertilizer application records for a specific field.
 *
 * This function first ensures that the requesting principal has read permission for the specified field, then
 * queries the database for fertilizer application records associated with that field. The returned records are
 * ordered by application date in descending order.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal making the request.
 * @param b_id - The identifier of the field.
 * @param timeframe - Optional timeframe to filter the fertilizer applications.
 * @returns A promise that resolves with an array of fertilizer application records.
 * @throws {Error} If permission is denied or if an error occurs during record retrieval.
 */
export async function getFertilizerApplications(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id: schema.fertilizerApplicationTypeSelect["b_id"],
    timeframe?: Timeframe,
): Promise<FertilizerApplication[]> {
    try {
        await checkPermission(
            fdm,
            "field",
            "read",
            b_id,
            principal_id,
            "getFertilizerApplications",
        )

        const results = (await fdm
            .select({
                p_id: schema.fertilizerApplication.p_id,
                p_id_catalogue: schema.fertilizersCatalogue.p_id_catalogue,
                p_name_nl: schema.fertilizersCatalogue.p_name_nl,
                p_app_amount: schema.fertilizerApplication.p_app_amount,
                p_app_amount_unit:
                    schema.fertilizersCatalogue.p_app_amount_unit,
                p_density: schema.fertilizersCatalogue.p_density,
                p_app_method: schema.fertilizerApplication.p_app_method,
                p_app_date: schema.fertilizerApplication.p_app_date,
                p_app_id: schema.fertilizerApplication.p_app_id,
            })
            .from(schema.fertilizerApplication)
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
            .where(
                timeframe
                    ? and(
                          eq(schema.fertilizerApplication.b_id, b_id),
                          timeframe.start
                              ? gte(
                                    schema.fertilizerApplication.p_app_date,
                                    timeframe.start,
                                )
                              : undefined,
                          timeframe.end
                              ? lte(
                                    schema.fertilizerApplication.p_app_date,
                                    timeframe.end,
                                )
                              : undefined,
                      )
                    : eq(schema.fertilizerApplication.b_id, b_id),
            )
            .orderBy(
                desc(schema.fertilizerApplication.p_app_date),
            )) as (BaseFertilizerApplication & {
            p_app_amount_unit: AppAmountUnit
            p_density: number | null
        })[]

        return results.map((result) =>
            extendFertilizerApplication(
                result,
                result.p_app_amount_unit,
                result.p_density,
            ),
        )
    } catch (err) {
        throw handleError(err, "Exception for getFertilizerApplications", {
            b_id,
        })
    }
}

/**
 * Retrieves all fertilizer applications for every field on a farm.
 *
 * Instead of issuing one query per field, this function joins through
 * `fieldAcquiring` so that all fertilizer applications for the farm are fetched at once.
 * A single farm-level permission check is performed instead of one per field.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param timeframe Optional timeframe to filter fertilizer applications.
 * @returns A Promise resolving to a Map keyed by field ID (`b_id`), with arrays of {@link FertilizerApplication} as values.
 * @alpha
 */
export async function getFertilizerApplicationsForFarm(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeSelect["b_id_farm"],
    timeframe?: Timeframe,
): Promise<Map<string, FertilizerApplication[]>> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "read",
            b_id_farm,
            principal_id,
            "getFertilizerApplicationsForFarm",
        )

        const rows = (await fdm
            .select({
                p_id: schema.fertilizerApplication.p_id,
                p_id_catalogue: schema.fertilizersCatalogue.p_id_catalogue,
                p_name_nl: schema.fertilizersCatalogue.p_name_nl,
                p_app_amount: schema.fertilizerApplication.p_app_amount,
                p_app_amount_unit:
                    schema.fertilizersCatalogue.p_app_amount_unit,
                p_density: schema.fertilizersCatalogue.p_density,
                p_app_method: schema.fertilizerApplication.p_app_method,
                p_app_date: schema.fertilizerApplication.p_app_date,
                p_app_id: schema.fertilizerApplication.p_app_id,
                // extra field for grouping – not part of FertilizerApplication type
                b_id: schema.fertilizerApplication.b_id,
            })
            .from(schema.fertilizerApplication)
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
            .innerJoin(
                schema.fieldAcquiring,
                eq(
                    schema.fieldAcquiring.b_id,
                    schema.fertilizerApplication.b_id,
                ),
            )
            .where(
                timeframe
                    ? and(
                          eq(schema.fieldAcquiring.b_id_farm, b_id_farm),
                          timeframe.start
                              ? gte(
                                    schema.fertilizerApplication.p_app_date,
                                    timeframe.start,
                                )
                              : undefined,
                          timeframe.end
                              ? lte(
                                    schema.fertilizerApplication.p_app_date,
                                    timeframe.end,
                                )
                              : undefined,
                      )
                    : eq(schema.fieldAcquiring.b_id_farm, b_id_farm),
            )
            .orderBy(
                desc(schema.fertilizerApplication.p_app_date),
            )) as (BaseFertilizerApplication & {
            b_id: schema.fertilizerApplicationTypeSelect["b_id"]
            p_app_amount_unit: AppAmountUnit
            p_density: schema.fertilizersCatalogueTypeSelect["p_density"]
        })[]

        const result = new Map<string, FertilizerApplication[]>()
        for (const row of rows) {
            if (!row.b_id) continue
            // b_id is used for grouping only and is not part of FertilizerApplication
            const fertilizerApplication = extendFertilizerApplication(
                row,
                row.p_app_amount_unit,
                row.p_density,
            )
            const existing = result.get(row.b_id)
            if (existing) {
                existing.push(fertilizerApplication as FertilizerApplication)
            } else {
                result.set(row.b_id, [
                    fertilizerApplication as FertilizerApplication,
                ])
            }
        }
        return result
    } catch (err) {
        throw handleError(
            err,
            "Exception for getFertilizerApplicationsForFarm",
            {
                b_id_farm,
            },
        )
    }
}

/**
 * Retrieves a description of the available fertilizer parameters.
 *
 * This function returns an array of objects, each describing a fertilizer parameter.
 * Each description includes the parameter's name, unit, type (numeric or enum),
 * a human-readable name, a detailed description, and optional constraints like
 * minimum and maximum values or a list of valid options for enum types.
 *
 * @param locale - The locale for which to retrieve the descriptions. Currently only 'NL-nl' is supported.
 * @returns An array of fertilizerParameterDescriptionItem objects.
 * @throws {Error} If an unsupported locale is provided.
 */
export function getFertilizerParametersDescription(
    locale = "NL-nl",
): FertilizerParameterDescription {
    if (locale !== "NL-nl") throw new Error("Unsupported locale")
    const fertilizerParameterDescription: FertilizerParameterDescription = [
        {
            parameter: "p_id_catalogue",
            unit: "",
            name: "ID",
            type: "text",
            category: "general",
            description: "Catalogu ID van meststof",
        },
        {
            parameter: "p_source",
            unit: "",
            name: "Bron",
            type: "text",
            category: "general",
            description: "Gegevensbron van meststof",
        },
        {
            parameter: "p_name_nl",
            unit: "",
            name: "Naam",
            type: "text",
            category: "general",
            description: "Nederlandse naam van meststof",
        },
        // {
        //     parameter: "p_name_en",
        //     unit: "",
        //     name: "Naam (Engels)",
        //     type: "text",
        //     category: "general",
        //     description: "Engelse naam van meststof",
        // },
        // {
        //     parameter: "p_description",
        //     unit: "",
        //     name: "Beschrijving",
        //     type: "text",
        //     category: "general",
        //     description: "Beschrijvingen en/of opmerkingen over de meststof",
        // },
        // {
        //     parameter: "p_type",
        //     unit: "",
        //     name: "Type",
        //     type: "enum",
        //     category: "general",
        //     description: "Typering van de meststof",
        //     options: [
        //         { value: "manure", label: "Dierlijke mest" },
        //         { value: "mineral", label: "Kunstmest" },
        //         { value: "compost", label: "Compost" },
        //     ],
        // },
        {
            parameter: "p_type_rvo",
            unit: "",
            name: "Mestcode (RVO)",
            type: "enum",
            category: "general",
            description: "Mestcode volgens RVO",
            options: schema.typeRvoOptions,
        },
        {
            parameter: "p_app_amount_unit",
            unit: "",
            name: "Voorkeurseenheid",
            type: "enum",
            category: "general",
            description:
                "Eenheid voor het weergeven van de hoeveelheid van deze meststof",
            options: APP_AMOUNT_UNITS,
        },
        {
            parameter: "p_app_method_options",
            unit: "",
            name: "Toedieningsmethodes",
            type: "enum_multi",
            category: "general",
            description: "Toedieningsmethodes mogelijk voor deze meststof",
            options: schema.applicationMethodOptions,
        },
        {
            parameter: "p_dm",
            unit: "g/kg",
            name: "Droge stofgehalte",
            type: "numeric",
            category: "physical",
            description: "",
            min: 0,
            max: 1000,
        },
        {
            parameter: "p_density",
            unit: "kg/l",
            name: "Dichtheid",
            type: "numeric",
            category: "physical",
            description: "",
            min: 0.00016,
            max: 17.31,
        },
        {
            parameter: "p_n_rt",
            unit: "g N/kg",
            name: "N",
            type: "numeric",
            category: "primary",
            description: "Stikstof, totaal",
            min: 0,
            max: 1000,
        },
        {
            parameter: "p_n_wc",
            unit: "-",
            name: "N-werking",
            type: "numeric",
            category: "primary",
            description: "Stikstof, werkingscoëfficient",
            min: 0,
            max: 1,
        },
        {
            parameter: "p_no3_rt",
            unit: "g N/kg",
            name: "NO3",
            type: "numeric",
            category: "primary",
            description: "Nitraat",
            min: 0,
            max: 1000,
        },
        {
            parameter: "p_nh4_rt",
            unit: "g N/kg",
            name: "NH4",
            type: "numeric",
            category: "primary",
            description: "Ammonium",
            min: 0,
            max: 1000,
        },
        {
            parameter: "p_p_rt",
            unit: "g P2O5/kg",
            name: "P",
            type: "numeric",
            category: "primary",
            description: "Fosfaat",
            min: 0,
            max: 4583,
        },
        {
            parameter: "p_k_rt",
            unit: "g K2O/kg",
            name: "K",
            type: "numeric",
            category: "primary",
            description: "Kalium",
            min: 0,
            max: 2409.2,
        },
        {
            parameter: "p_eoc",
            unit: "g EOC/kg",
            name: "EOC",
            type: "numeric",
            category: "secondary",
            description: "Koolstof, effectief",
            min: 0,
            max: 1000,
        },
        {
            parameter: "p_s_rt",
            unit: "g SO3/kg",
            name: "S",
            type: "numeric",
            category: "secondary",
            description: "Zwavel",
            min: 0,
            max: 2497.2,
        },
        {
            parameter: "p_mg_rt",
            unit: "g MgO/kg",
            name: "Mg",
            type: "numeric",
            category: "secondary",
            description: "Magnesium",
            min: 0,
            max: 1659,
        },
        {
            parameter: "p_ca_rt",
            unit: "g CaO/kg",
            name: "Ca",
            type: "numeric",
            category: "secondary",
            description: "Calcium",
            min: 0,
            max: 1399.2,
        },
        {
            parameter: "p_na_rt",
            unit: "g Na2O/kg",
            name: "Na",
            type: "numeric",
            category: "secondary",
            description: "Natrium",
            min: 0,
            max: 2695900,
        },
        {
            parameter: "p_cu_rt",
            unit: "mg Cu/kg",
            name: "Cu",
            type: "numeric",
            category: "trace",
            description: "Koper",
            min: 0,
            max: 1000000,
        },
        {
            parameter: "p_zn_rt",
            unit: "mg Zn/kg",
            name: "Zn",
            type: "numeric",
            category: "trace",
            description: "Zink",
            min: 0,
            max: 1000000,
        },
        {
            parameter: "p_co_rt",
            unit: "mg Co/kg",
            name: "Co",
            type: "numeric",
            category: "trace",
            description: "Kobalt",
            min: 0,
            max: 1000000,
        },
        {
            parameter: "p_mn_rt",
            unit: "mg Mn/kg",
            name: "Mn",
            type: "numeric",
            category: "trace",
            description: "Mangaan",
            min: 0,
            max: 1000000,
        },
        {
            parameter: "p_mo_rt",
            unit: "mg Mo/kg",
            name: "Mo",
            type: "numeric",
            category: "trace",
            description: "Molybdeen",
            min: 0,
            max: 1000000,
        },
        {
            parameter: "p_b_rt",
            unit: "mg B/kg",
            name: "B",
            type: "numeric",
            category: "trace",
            description: "Boor",
            min: 0,
            max: 1000000,
        },
    ]

    return fertilizerParameterDescription
}

/**
 * Determines the fertilizer type based on the RVO code.
 *
 * @param p_type_rvo The RVO code for the fertilizer type.
 * @returns The fertilizer type ("manure", "mineral", "compost") or null if not classified.
 * @internal
 */
function convertRvoTypeToFertilizerType(
    p_type_rvo?: schema.fertilizersCatalogueTypeSelect["p_type_rvo"],
): "manure" | "mineral" | "compost" | null {
    if (!p_type_rvo) {
        return null
    }

    // Manure codes
    const manureCodes = [
        "10",
        "11",
        "12",
        "13",
        "14",
        "17",
        "18",
        "19",
        "23",
        "30",
        "31",
        "32",
        "33",
        "35",
        "39",
        "40",
        "41",
        "42",
        "43",
        "46",
        "50",
        "56",
        "60",
        "61",
        "75",
        "76",
        "80",
        "81",
        "90",
        "91",
        "92",
        "25",
        "26",
        "27",
        "95",
        "96",
        "97",
        "98",
        "99",
        "100",
        "101",
        "102",
        "103",
        "104",
        "105",
        "106",
        "110",
        "117",
        "120",
    ]

    // Compost codes
    const compostCodes = ["107", "108", "109", "111", "112"]

    // Mineral codes
    const mineralCodes = ["115"]

    // "Other" codes
    const otherCodes = ["113", "114", "116"]

    if (manureCodes.includes(p_type_rvo)) {
        return "manure"
    }

    if (compostCodes.includes(p_type_rvo)) {
        return "compost"
    }

    if (mineralCodes.includes(p_type_rvo)) {
        return "mineral"
    }

    if (otherCodes.includes(p_type_rvo)) {
        return null
    }

    return null
}

/**
 * Determines the fertilizer type based on the fields of a fertilizer catalogue database entry.
 *
 * @param fertilizer Selected fertilizer catalogue row from the database, possibly joined with other tables
 * @returns The fertilizer type ("manure", "mineral", "compost") or null if not classified.
 * @internal
 */
function deriveFertilizerType(
    fertilizer: Partial<schema.fertilizersCatalogueTypeSelect>,
) {
    if (fertilizer.p_type_rvo) {
        return convertRvoTypeToFertilizerType(fertilizer.p_type_rvo)
    }
    if (fertilizer.p_type_manure) {
        return "manure"
    }
    if (fertilizer.p_type_mineral) {
        return "mineral"
    }
    if (fertilizer.p_type_compost) {
        return "compost"
    }
    return null
}

/**
 * Extends the given fertilizer application with computed data and removes unknown properties
 * @param app fertilizer application
 * @returns the same fertilizer application with p_app_amount_display filled in and properties
 * that do not belong to FertilizerApplication removed
 */
function extendFertilizerApplication<
    T extends BaseFertilizerApplication & {
        p_app_amount_unit: AppAmountUnit
        p_density: number | null
    },
>(
    app: T,
    p_app_amount_unit: AppAmountUnit,
    p_density: number | null,
): FertilizerApplication {
    const p_app_amount_display =
        app.p_app_amount !== null && app.p_app_amount !== undefined
            ? fromKgPerHa(app.p_app_amount, p_app_amount_unit, p_density)
            : app.p_app_amount

    return {
        p_id: app.p_id,
        p_id_catalogue: app.p_id_catalogue,
        p_name_nl: app.p_name_nl,
        p_app_amount: app.p_app_amount,
        p_app_amount_unit: p_app_amount_unit,
        p_app_amount_display: p_app_amount_display,
        p_app_method: app.p_app_method,
        p_app_date: app.p_app_date,
        p_app_id: app.p_app_id,
    }
}
