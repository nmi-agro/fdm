import type * as GeoJSON from "geojson"
import {
  type AnyColumn,
  and,
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
import { alias } from "drizzle-orm/pg-core"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type {
  CurrentSoilData,
  CurrentSoilDataItem,
  SoilAnalysis,
  SoilParameterDescription,
  SoilParameters,
  SoilSamplingGeometries,
  SoilZone,
} from "./soil.types"
import type { Timeframe } from "./timeframe"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"
import {
  type AggregationAnalysis,
  aggregateParameter,
  clusterZones,
  hasOverlappingZones,
  selectContributingAnalyses,
  type ZoneAreas,
} from "./soil-aggregation"

/**
 * Adds a new soil analysis record along with its soil sampling details.
 *
 * This function verifies that the principal has write access to the specified field, then creates new entries
 * in the soil analysis and soil sampling tables within a database transaction. The ID of the newly created soil
 * analysis record is returned.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal performing the operation.
 * @param a_date - The date when the soil analysis was performed.
 * @param a_source - The source of the soil analysis data.
 * @param b_id - The identifier of the field where the soil sample was collected.
 * @param a_depth_lower - The lower depth up to which the soil sample was taken.
 * @param b_sampling_date - The date when the soil sample was collected.
 * @param soilAnalysisData - Optional additional data for the soil analysis (e.g., pH, nutrient levels). May include the
 *   sampling geometries `b_sampling_geometry` (MultiPoint) and `b_sampling_geometry_zone` (Polygon or MultiPolygon) in WGS84.
 * @param a_depth_upper - The upper depth from which the soil sample was taken. Defaults to 0
 * @returns The ID of the newly added soil analysis record.
 * @throws {Error} If the database transaction fails.
 */
export async function addSoilAnalysis(
  fdm: FdmType,
  principal_id: PrincipalId,
  a_date: schema.soilAnalysisTypeInsert["a_date"],
  a_source: schema.soilAnalysisTypeInsert["a_source"],
  b_id: schema.soilSamplingTypeInsert["b_id"],
  a_depth_lower: schema.soilSamplingTypeInsert["a_depth_lower"],
  b_sampling_date: schema.soilSamplingTypeInsert["b_sampling_date"],
  soilAnalysisData?: Partial<schema.soilAnalysisTypeInsert> & SoilSamplingGeometries,
  a_depth_upper: schema.soilSamplingTypeInsert["a_depth_upper"] = 0,
): Promise<schema.soilAnalysisTypeSelect["a_id"]> {
  const { b_sampling_geometry, b_sampling_geometry_zone, ...analysisData } = soilAnalysisData ?? {}
  try {
    await checkPermission(fdm, "field", "write", b_id, principal_id, "addSoilAnalysis")

    const geometries = normalizeSamplingGeometries({
      b_sampling_geometry,
      b_sampling_geometry_zone,
    })

    // Validate depth values are numbers
    if (Number.isNaN(a_depth_lower)) {
      throw new Error("a_depth_lower must be a valid number")
    }
    if (Number.isNaN(a_depth_upper)) {
      throw new Error("a_depth_upper must be a valid number")
    }

    // Validate if a_depth_lower is beneath a_depth_upper
    if (a_depth_lower && a_depth_lower <= a_depth_upper) {
      throw new Error("a_depth_lower must be greater than a_depth_upper")
    }

    return await fdm.transaction(async (tx) => {
      const a_id = createId()
      const b_id_sampling = createId()

      // Insert soil analysis data
      await tx.insert(schema.soilAnalysis).values({
        a_id: a_id,
        a_date: a_date,
        a_source: a_source,
        ...analysisData,
      })

      // Insert soil sampling data
      await tx.insert(schema.soilSampling).values({
        b_id_sampling: b_id_sampling,
        b_id: b_id,
        a_id: a_id,
        a_depth_upper: a_depth_upper,
        a_depth_lower: a_depth_lower,
        b_sampling_date: b_sampling_date,
        b_sampling_geometry: geometries.b_sampling_geometry ?? null,
        b_sampling_geometry_zone: geometries.b_sampling_geometry_zone ?? null,
      })

      return a_id
    })
  } catch (err) {
    throw handleError(err, "Exception for addSoilAnalysis", {
      a_date,
      a_source,
      b_id,
      a_depth_upper,
      a_depth_lower,
      b_sampling_date,
      b_sampling_geometry_type: b_sampling_geometry?.type,
      b_sampling_geometry_zone_type: b_sampling_geometry_zone?.type,
    })
  }
}

/**
 * Updates an existing soil analysis record and its related soil sampling record.
 *
 * This function first verifies whether the principal has write permission for the specified soil
 * analysis record. It then executes a transaction to update the soil analysis entry with the provided
 * changes. The sampling date (`b_sampling_date`) and lower sampling depth (`a_depth_lower`) are
 * stored on the soil sampling record and can be updated through the same call. The update timestamp
 * of the sampling record is always refreshed.
 *
 * The sampling geometries (`b_sampling_geometry` and `b_sampling_geometry_zone`) are stored on the
 * soil sampling record as well.
 *
 * Fields that are omitted or `undefined` are left unchanged. Pass `null` for a nullable field
 * (for example a BCS score such as `a_ss_bcs`) to clear its value.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - Identifier of the principal performing the update.
 * @param a_id - The unique identifier of the soil analysis record to update.
 * @param soilAnalysisData - Object containing the fields to update; supports partial updates.
 * @throws {Error} If the database transaction fails, the permission check does not pass, or
 *   `a_depth_lower` is not greater than the existing upper depth.
 */
export async function updateSoilAnalysis(
  fdm: FdmType,
  principal_id: PrincipalId,
  a_id: schema.soilAnalysisTypeSelect["a_id"],
  soilAnalysisData: Partial<schema.soilAnalysisTypeInsert> &
    Partial<Pick<schema.soilSamplingTypeInsert, "b_sampling_date" | "a_depth_lower">> &
    SoilSamplingGeometries,
): Promise<void> {
  const {
    b_sampling_date,
    a_depth_lower,
    b_sampling_geometry,
    b_sampling_geometry_zone,
    ...analysisData
  } = soilAnalysisData
  try {
    await checkPermission(fdm, "soil_analysis", "write", a_id, principal_id, "updateSoilAnalysis")

    const geometries = normalizeSamplingGeometries({
      b_sampling_geometry,
      b_sampling_geometry_zone,
    })

    if (a_depth_lower != null && Number.isNaN(a_depth_lower)) {
      throw new Error("a_depth_lower must be a valid number")
    }

    return await fdm.transaction(async (tx) => {
      const updated = new Date()

      if (a_depth_lower !== undefined || b_sampling_date !== undefined) {
        const [sampling] = await tx
          .select({ a_depth_upper: schema.soilSampling.a_depth_upper })
          .from(schema.soilSampling)
          .where(eq(schema.soilSampling.a_id, a_id))
          .limit(1)
        if (!sampling) {
          throw new Error("Soil sampling not found for soil analysis")
        }
        if (a_depth_lower != null && a_depth_lower <= sampling.a_depth_upper) {
          throw new Error("a_depth_lower must be greater than a_depth_upper")
        }
      }

      await tx
        .update(schema.soilAnalysis)
        .set({ updated: updated, ...analysisData })
        .where(eq(schema.soilAnalysis.a_id, a_id))

      await tx
        .update(schema.soilSampling)
        .set({
          updated: updated,
          ...(b_sampling_date !== undefined ? { b_sampling_date } : {}),
          ...(a_depth_lower !== undefined ? { a_depth_lower } : {}),
          ...(geometries.b_sampling_geometry !== undefined
            ? { b_sampling_geometry: geometries.b_sampling_geometry }
            : {}),
          ...(geometries.b_sampling_geometry_zone !== undefined
            ? { b_sampling_geometry_zone: geometries.b_sampling_geometry_zone }
            : {}),
        })
        .where(eq(schema.soilSampling.a_id, a_id))
    })
  } catch (err) {
    throw handleError(err, "Exception for updateSoilAnalysis", {
      a_id,
      ...analysisData,
      b_sampling_date,
      a_depth_lower,
      b_sampling_geometry_type: b_sampling_geometry?.type,
      b_sampling_geometry_zone_type: b_sampling_geometry_zone?.type,
    })
  }
}

/**
 * Removes a soil analysis record and its associated sampling data.
 *
 * Verifies that the principal has write permissions, then executes a transaction to delete
 * the corresponding entries from both the soil sampling and soil analysis tables.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The ID of the principal performing the removal.
 * @param a_id - The ID of the soil analysis record to remove.
 *
 * @throws {Error} If the operation fails due to permission issues or database errors.
 */
export async function removeSoilAnalysis(
  fdm: FdmType,
  principal_id: PrincipalId,
  a_id: schema.soilAnalysisTypeSelect["a_id"],
): Promise<void> {
  try {
    await checkPermission(fdm, "soil_analysis", "write", a_id, principal_id, "removeSoilAnalysis")
    return await fdm.transaction(async (tx) => {
      await tx.delete(schema.soilSampling).where(eq(schema.soilSampling.a_id, a_id))

      await tx.delete(schema.soilAnalysis).where(eq(schema.soilAnalysis.a_id, a_id))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeSoilAnalysis", { a_id })
  }
}

/**
 * Retrieves the soil analysis record for a specified analysis.
 *
 * This function validates that the requesting principal has the necessary read permissions for the soil analysis before querying for soil analysis data based on the id.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The unique ID of the principal requesting the soil analysis.
 * @param a_id - The identifier of the analysis.
 * @returns The soil analysis record for the field
 * @throws {Error} If an error occurs during permission verification or data retrieval.
 */
export async function getSoilAnalysis(
  fdm: FdmType,
  principal_id: PrincipalId,
  a_id: schema.soilAnalysisTypeSelect["a_id"],
): Promise<SoilAnalysis> {
  try {
    await checkPermission(fdm, "soil_analysis", "read", a_id, principal_id, "getSoilAnalysis")
    const soilAnalysis = await fdm
      .select({
        a_id: schema.soilAnalysis.a_id,
        a_date: schema.soilAnalysis.a_date,
        a_source: schema.soilAnalysis.a_source,
        a_file_path: schema.soilAnalysis.a_file_path,
        a_al_ox: schema.soilAnalysis.a_al_ox,
        a_c_of: schema.soilAnalysis.a_c_of,
        a_ca_co: schema.soilAnalysis.a_ca_co,
        a_ca_co_po: schema.soilAnalysis.a_ca_co_po,
        a_caco3_if: schema.soilAnalysis.a_caco3_if,
        a_cec_co: schema.soilAnalysis.a_cec_co,
        a_clay_mi: schema.soilAnalysis.a_clay_mi,
        a_cn_fr: schema.soilAnalysis.a_cn_fr,
        a_com_fr: schema.soilAnalysis.a_com_fr,
        a_cu_cc: schema.soilAnalysis.a_cu_cc,
        a_density_sa: schema.soilAnalysis.a_density_sa,
        a_fe_ox: schema.soilAnalysis.a_fe_ox,
        a_k_cc: schema.soilAnalysis.a_k_cc,
        a_k_co: schema.soilAnalysis.a_k_co,
        a_k_co_po: schema.soilAnalysis.a_k_co_po,
        a_mg_cc: schema.soilAnalysis.a_mg_cc,
        a_mg_co: schema.soilAnalysis.a_mg_co,
        a_mg_co_po: schema.soilAnalysis.a_mg_co_po,
        a_n_pmn: schema.soilAnalysis.a_n_pmn,
        a_n_rt: schema.soilAnalysis.a_n_rt,
        a_nh4_cc: schema.soilAnalysis.a_nh4_cc,
        a_nmin_cc: schema.soilAnalysis.a_nmin_cc,
        a_no3_cc: schema.soilAnalysis.a_no3_cc,
        a_p_al: schema.soilAnalysis.a_p_al,
        a_p_cc: schema.soilAnalysis.a_p_cc,
        a_p_ox: schema.soilAnalysis.a_p_ox,
        a_p_rt: schema.soilAnalysis.a_p_rt,
        a_p_sg: schema.soilAnalysis.a_p_sg,
        a_p_wa: schema.soilAnalysis.a_p_wa,
        a_ph_cc: schema.soilAnalysis.a_ph_cc,
        a_s_rt: schema.soilAnalysis.a_s_rt,
        a_sand_mi: schema.soilAnalysis.a_sand_mi,
        a_silt_mi: schema.soilAnalysis.a_silt_mi,
        a_som_loi: schema.soilAnalysis.a_som_loi,
        a_zn_cc: schema.soilAnalysis.a_zn_cc,
        b_gwl_class: schema.soilAnalysis.b_gwl_class,
        b_soiltype_agr: schema.soilAnalysis.b_soiltype_agr,
        a_ss_bcs: schema.soilAnalysis.a_ss_bcs,
        a_sc_bcs: schema.soilAnalysis.a_sc_bcs,
        a_rd_bcs: schema.soilAnalysis.a_rd_bcs,
        a_ew_bcs: schema.soilAnalysis.a_ew_bcs,
        a_cc_bcs: schema.soilAnalysis.a_cc_bcs,
        a_gs_bcs: schema.soilAnalysis.a_gs_bcs,
        a_p_bcs: schema.soilAnalysis.a_p_bcs,
        a_c_bcs: schema.soilAnalysis.a_c_bcs,
        a_rt_bcs: schema.soilAnalysis.a_rt_bcs,
        b_id_sampling: schema.soilSampling.b_id_sampling,
        b_id: schema.soilSampling.b_id,
        a_depth_upper: schema.soilSampling.a_depth_upper,
        a_depth_lower: schema.soilSampling.a_depth_lower,
        b_sampling_date: schema.soilSampling.b_sampling_date,
        b_sampling_geometry: schema.soilSampling.b_sampling_geometry,
        b_sampling_geometry_zone: schema.soilSampling.b_sampling_geometry_zone,
      })
      .from(schema.soilAnalysis)
      .leftJoin(schema.soilSampling, eq(schema.soilAnalysis.a_id, schema.soilSampling.a_id))
      .where(eq(schema.soilAnalysis.a_id, a_id))

    return soilAnalysis[0] as SoilAnalysis
  } catch (err) {
    throw handleError(err, "Exception for getSoilAnalysis", { a_id })
  }
}

/**
 * Retrieves all soil analysis records for a specified field, sorted by sampling date in descending order.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal requesting the data.
 * @param b_id - The identifier of the field.
 * @param timeframe - Optional timeframe to filter the soil analyses.
 * @returns An array of soil analysis records with corresponding soil sampling details. Returns an empty array if no records are found.
 *
 * @throws {Error} If the principal lacks read permissions for the field or if the database query fails.
 */
export async function getSoilAnalyses(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: schema.soilSamplingTypeSelect["b_id"],
  timeframe?: Timeframe,
): Promise<SoilAnalysis[]> {
  try {
    await checkPermission(fdm, "field", "read", b_id, principal_id, "getSoilAnalyses")

    let whereClause: SQL | undefined
    if (timeframe?.start && timeframe.end) {
      whereClause = and(
        eq(schema.soilSampling.b_id, b_id),
        or(
          gte(schema.soilSampling.b_sampling_date, timeframe.start),
          isNull(schema.soilSampling.b_sampling_date),
        ),
        or(
          lte(schema.soilSampling.b_sampling_date, timeframe.end),
          isNull(schema.soilSampling.b_sampling_date),
        ),
      )
    } else if (timeframe?.start) {
      whereClause = and(
        eq(schema.soilSampling.b_id, b_id),
        or(
          gte(schema.soilSampling.b_sampling_date, timeframe.start),
          isNull(schema.soilSampling.b_sampling_date),
        ),
      )
    } else if (timeframe?.end) {
      whereClause = and(
        eq(schema.soilSampling.b_id, b_id),
        or(
          lte(schema.soilSampling.b_sampling_date, timeframe.end),
          isNull(schema.soilSampling.b_sampling_date),
        ),
      )
    } else {
      whereClause = eq(schema.soilSampling.b_id, b_id)
    }

    const soilAnalyses = await fdm
      .select({
        a_id: schema.soilAnalysis.a_id,
        a_date: schema.soilAnalysis.a_date,
        a_source: schema.soilAnalysis.a_source,
        a_file_path: schema.soilAnalysis.a_file_path,
        a_al_ox: schema.soilAnalysis.a_al_ox,
        a_c_of: schema.soilAnalysis.a_c_of,
        a_ca_co: schema.soilAnalysis.a_ca_co,
        a_ca_co_po: schema.soilAnalysis.a_ca_co_po,
        a_caco3_if: schema.soilAnalysis.a_caco3_if,
        a_cec_co: schema.soilAnalysis.a_cec_co,
        a_clay_mi: schema.soilAnalysis.a_clay_mi,
        a_cn_fr: schema.soilAnalysis.a_cn_fr,
        a_com_fr: schema.soilAnalysis.a_com_fr,
        a_cu_cc: schema.soilAnalysis.a_cu_cc,
        a_density_sa: schema.soilAnalysis.a_density_sa,
        a_fe_ox: schema.soilAnalysis.a_fe_ox,
        a_k_cc: schema.soilAnalysis.a_k_cc,
        a_k_co: schema.soilAnalysis.a_k_co,
        a_k_co_po: schema.soilAnalysis.a_k_co_po,
        a_mg_cc: schema.soilAnalysis.a_mg_cc,
        a_mg_co: schema.soilAnalysis.a_mg_co,
        a_mg_co_po: schema.soilAnalysis.a_mg_co_po,
        a_n_pmn: schema.soilAnalysis.a_n_pmn,
        a_n_rt: schema.soilAnalysis.a_n_rt,
        a_nh4_cc: schema.soilAnalysis.a_nh4_cc,
        a_nmin_cc: schema.soilAnalysis.a_nmin_cc,
        a_no3_cc: schema.soilAnalysis.a_no3_cc,
        a_p_al: schema.soilAnalysis.a_p_al,
        a_p_cc: schema.soilAnalysis.a_p_cc,
        a_p_ox: schema.soilAnalysis.a_p_ox,
        a_p_rt: schema.soilAnalysis.a_p_rt,
        a_p_sg: schema.soilAnalysis.a_p_sg,
        a_p_wa: schema.soilAnalysis.a_p_wa,
        a_ph_cc: schema.soilAnalysis.a_ph_cc,
        a_s_rt: schema.soilAnalysis.a_s_rt,
        a_sand_mi: schema.soilAnalysis.a_sand_mi,
        a_silt_mi: schema.soilAnalysis.a_silt_mi,
        a_som_loi: schema.soilAnalysis.a_som_loi,
        a_zn_cc: schema.soilAnalysis.a_zn_cc,
        b_gwl_class: schema.soilAnalysis.b_gwl_class,
        b_soiltype_agr: schema.soilAnalysis.b_soiltype_agr,
        a_ss_bcs: schema.soilAnalysis.a_ss_bcs,
        a_sc_bcs: schema.soilAnalysis.a_sc_bcs,
        a_rd_bcs: schema.soilAnalysis.a_rd_bcs,
        a_ew_bcs: schema.soilAnalysis.a_ew_bcs,
        a_cc_bcs: schema.soilAnalysis.a_cc_bcs,
        a_gs_bcs: schema.soilAnalysis.a_gs_bcs,
        a_p_bcs: schema.soilAnalysis.a_p_bcs,
        a_c_bcs: schema.soilAnalysis.a_c_bcs,
        a_rt_bcs: schema.soilAnalysis.a_rt_bcs,
        b_id_sampling: schema.soilSampling.b_id_sampling,
        b_id: schema.soilSampling.b_id,
        a_depth_upper: schema.soilSampling.a_depth_upper,
        a_depth_lower: schema.soilSampling.a_depth_lower,
        b_sampling_date: schema.soilSampling.b_sampling_date,
        b_sampling_geometry: schema.soilSampling.b_sampling_geometry,
        b_sampling_geometry_zone: schema.soilSampling.b_sampling_geometry_zone,
      })
      .from(schema.soilAnalysis)
      .innerJoin(schema.soilSampling, eq(schema.soilAnalysis.a_id, schema.soilSampling.a_id))
      .where(whereClause)
      .orderBy(
        // Drizzle does not support NULL LAST argument yet
        sql`${schema.soilSampling.b_sampling_date} DESC NULLS LAST`,
      )

    return soilAnalyses
  } catch (err) {
    throw handleError(err, "Exception for getSoilAnalyses", { b_id })
  }
}

/**
 * Retrieves all soil analyses for every field on a farm.
 *
 * Instead of issuing one query per field, this function joins through
 * `fieldAcquiring` so that all soil analyses for the farm are fetched at once.
 * A single farm-level permission check is performed instead of one per field.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param timeframe Optional timeframe to filter soil analyses.
 * @returns A Promise resolving to a Map keyed by field ID (`b_id`), with arrays of {@link SoilAnalysis} as values.
 * @alpha
 */
export async function getSoilAnalysesForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  timeframe?: Timeframe,
): Promise<Map<string, SoilAnalysis[]>> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getSoilAnalysesForFarm")

    let whereClause: SQL | undefined
    if (timeframe?.start && timeframe.end) {
      whereClause = and(
        eq(schema.fieldAcquiring.b_id_farm, b_id_farm),
        or(
          gte(schema.soilSampling.b_sampling_date, timeframe.start),
          isNull(schema.soilSampling.b_sampling_date),
        ),
        or(
          lte(schema.soilSampling.b_sampling_date, timeframe.end),
          isNull(schema.soilSampling.b_sampling_date),
        ),
      )
    } else if (timeframe?.start) {
      whereClause = and(
        eq(schema.fieldAcquiring.b_id_farm, b_id_farm),
        or(
          gte(schema.soilSampling.b_sampling_date, timeframe.start),
          isNull(schema.soilSampling.b_sampling_date),
        ),
      )
    } else if (timeframe?.end) {
      whereClause = and(
        eq(schema.fieldAcquiring.b_id_farm, b_id_farm),
        or(
          lte(schema.soilSampling.b_sampling_date, timeframe.end),
          isNull(schema.soilSampling.b_sampling_date),
        ),
      )
    } else {
      whereClause = eq(schema.fieldAcquiring.b_id_farm, b_id_farm)
    }

    const rows = await fdm
      .select({
        a_id: schema.soilAnalysis.a_id,
        a_date: schema.soilAnalysis.a_date,
        a_source: schema.soilAnalysis.a_source,
        a_file_path: schema.soilAnalysis.a_file_path,
        a_al_ox: schema.soilAnalysis.a_al_ox,
        a_c_of: schema.soilAnalysis.a_c_of,
        a_ca_co: schema.soilAnalysis.a_ca_co,
        a_ca_co_po: schema.soilAnalysis.a_ca_co_po,
        a_caco3_if: schema.soilAnalysis.a_caco3_if,
        a_cec_co: schema.soilAnalysis.a_cec_co,
        a_clay_mi: schema.soilAnalysis.a_clay_mi,
        a_cn_fr: schema.soilAnalysis.a_cn_fr,
        a_com_fr: schema.soilAnalysis.a_com_fr,
        a_cu_cc: schema.soilAnalysis.a_cu_cc,
        a_density_sa: schema.soilAnalysis.a_density_sa,
        a_fe_ox: schema.soilAnalysis.a_fe_ox,
        a_k_cc: schema.soilAnalysis.a_k_cc,
        a_k_co: schema.soilAnalysis.a_k_co,
        a_k_co_po: schema.soilAnalysis.a_k_co_po,
        a_mg_cc: schema.soilAnalysis.a_mg_cc,
        a_mg_co: schema.soilAnalysis.a_mg_co,
        a_mg_co_po: schema.soilAnalysis.a_mg_co_po,
        a_n_pmn: schema.soilAnalysis.a_n_pmn,
        a_n_rt: schema.soilAnalysis.a_n_rt,
        a_nh4_cc: schema.soilAnalysis.a_nh4_cc,
        a_nmin_cc: schema.soilAnalysis.a_nmin_cc,
        a_no3_cc: schema.soilAnalysis.a_no3_cc,
        a_p_al: schema.soilAnalysis.a_p_al,
        a_p_cc: schema.soilAnalysis.a_p_cc,
        a_p_ox: schema.soilAnalysis.a_p_ox,
        a_p_rt: schema.soilAnalysis.a_p_rt,
        a_p_sg: schema.soilAnalysis.a_p_sg,
        a_p_wa: schema.soilAnalysis.a_p_wa,
        a_ph_cc: schema.soilAnalysis.a_ph_cc,
        a_s_rt: schema.soilAnalysis.a_s_rt,
        a_sand_mi: schema.soilAnalysis.a_sand_mi,
        a_silt_mi: schema.soilAnalysis.a_silt_mi,
        a_som_loi: schema.soilAnalysis.a_som_loi,
        a_zn_cc: schema.soilAnalysis.a_zn_cc,
        b_gwl_class: schema.soilAnalysis.b_gwl_class,
        b_soiltype_agr: schema.soilAnalysis.b_soiltype_agr,
        a_ss_bcs: schema.soilAnalysis.a_ss_bcs,
        a_sc_bcs: schema.soilAnalysis.a_sc_bcs,
        a_rd_bcs: schema.soilAnalysis.a_rd_bcs,
        a_ew_bcs: schema.soilAnalysis.a_ew_bcs,
        a_cc_bcs: schema.soilAnalysis.a_cc_bcs,
        a_gs_bcs: schema.soilAnalysis.a_gs_bcs,
        a_p_bcs: schema.soilAnalysis.a_p_bcs,
        a_c_bcs: schema.soilAnalysis.a_c_bcs,
        a_rt_bcs: schema.soilAnalysis.a_rt_bcs,
        b_id_sampling: schema.soilSampling.b_id_sampling,
        a_depth_upper: schema.soilSampling.a_depth_upper,
        a_depth_lower: schema.soilSampling.a_depth_lower,
        b_sampling_date: schema.soilSampling.b_sampling_date,
        b_sampling_geometry: schema.soilSampling.b_sampling_geometry,
        b_sampling_geometry_zone: schema.soilSampling.b_sampling_geometry_zone,
        b_id: schema.soilSampling.b_id,
      })
      .from(schema.soilAnalysis)
      .innerJoin(schema.soilSampling, eq(schema.soilAnalysis.a_id, schema.soilSampling.a_id))
      .innerJoin(schema.fieldAcquiring, eq(schema.fieldAcquiring.b_id, schema.soilSampling.b_id))
      .where(whereClause)
      .orderBy(sql`${schema.soilSampling.b_sampling_date} DESC NULLS LAST`)

    const result = new Map<string, SoilAnalysis[]>()
    for (const row of rows) {
      if (!row.b_id) continue
      const soilAnalysis: SoilAnalysis = {
        a_id: row.a_id,
        a_date: row.a_date,
        a_source: row.a_source,
        a_file_path: row.a_file_path,
        a_al_ox: row.a_al_ox,
        a_c_of: row.a_c_of,
        a_ca_co: row.a_ca_co,
        a_ca_co_po: row.a_ca_co_po,
        a_caco3_if: row.a_caco3_if,
        a_cec_co: row.a_cec_co,
        a_clay_mi: row.a_clay_mi,
        a_cn_fr: row.a_cn_fr,
        a_com_fr: row.a_com_fr,
        a_cu_cc: row.a_cu_cc,
        a_density_sa: row.a_density_sa,
        a_fe_ox: row.a_fe_ox,
        a_k_cc: row.a_k_cc,
        a_k_co: row.a_k_co,
        a_k_co_po: row.a_k_co_po,
        a_mg_cc: row.a_mg_cc,
        a_mg_co: row.a_mg_co,
        a_mg_co_po: row.a_mg_co_po,
        a_n_pmn: row.a_n_pmn,
        a_n_rt: row.a_n_rt,
        a_nh4_cc: row.a_nh4_cc,
        a_nmin_cc: row.a_nmin_cc,
        a_no3_cc: row.a_no3_cc,
        a_p_al: row.a_p_al,
        a_p_cc: row.a_p_cc,
        a_p_ox: row.a_p_ox,
        a_p_rt: row.a_p_rt,
        a_p_sg: row.a_p_sg,
        a_p_wa: row.a_p_wa,
        a_ph_cc: row.a_ph_cc,
        a_s_rt: row.a_s_rt,
        a_sand_mi: row.a_sand_mi,
        a_silt_mi: row.a_silt_mi,
        a_som_loi: row.a_som_loi,
        a_zn_cc: row.a_zn_cc,
        b_gwl_class: row.b_gwl_class,
        b_soiltype_agr: row.b_soiltype_agr,
        a_ss_bcs: row.a_ss_bcs,
        a_sc_bcs: row.a_sc_bcs,
        a_rd_bcs: row.a_rd_bcs,
        a_ew_bcs: row.a_ew_bcs,
        a_cc_bcs: row.a_cc_bcs,
        a_gs_bcs: row.a_gs_bcs,
        a_p_bcs: row.a_p_bcs,
        a_c_bcs: row.a_c_bcs,
        a_rt_bcs: row.a_rt_bcs,
        b_id_sampling: row.b_id_sampling,
        b_id: row.b_id,
        a_depth_upper: row.a_depth_upper,
        a_depth_lower: row.a_depth_lower,
        b_sampling_date: row.b_sampling_date,
        b_sampling_geometry: row.b_sampling_geometry,
        b_sampling_geometry_zone: row.b_sampling_geometry_zone,
      }
      const existing = result.get(row.b_id)
      if (existing) {
        existing.push(soilAnalysis)
      } else {
        result.set(row.b_id, [soilAnalysis])
      }
    }
    return result
  } catch (err) {
    throw handleError(err, "Exception for getSoilAnalysesForFarm", {
      b_id_farm,
    })
  }
}

/**
 * Columns of the soil analysis and soil sampling records that are needed to derive the current soil data.
 */
const currentSoilDataColumns = {
  a_id: schema.soilAnalysis.a_id,
  a_source: schema.soilAnalysis.a_source,
  a_al_ox: schema.soilAnalysis.a_al_ox,
  a_c_of: schema.soilAnalysis.a_c_of,
  a_ca_co: schema.soilAnalysis.a_ca_co,
  a_ca_co_po: schema.soilAnalysis.a_ca_co_po,
  a_caco3_if: schema.soilAnalysis.a_caco3_if,
  a_cec_co: schema.soilAnalysis.a_cec_co,
  a_clay_mi: schema.soilAnalysis.a_clay_mi,
  a_cn_fr: schema.soilAnalysis.a_cn_fr,
  a_com_fr: schema.soilAnalysis.a_com_fr,
  a_cu_cc: schema.soilAnalysis.a_cu_cc,
  a_density_sa: schema.soilAnalysis.a_density_sa,
  a_fe_ox: schema.soilAnalysis.a_fe_ox,
  a_k_cc: schema.soilAnalysis.a_k_cc,
  a_k_co: schema.soilAnalysis.a_k_co,
  a_k_co_po: schema.soilAnalysis.a_k_co_po,
  a_mg_cc: schema.soilAnalysis.a_mg_cc,
  a_mg_co: schema.soilAnalysis.a_mg_co,
  a_mg_co_po: schema.soilAnalysis.a_mg_co_po,
  a_n_pmn: schema.soilAnalysis.a_n_pmn,
  a_n_rt: schema.soilAnalysis.a_n_rt,
  a_nh4_cc: schema.soilAnalysis.a_nh4_cc,
  a_nmin_cc: schema.soilAnalysis.a_nmin_cc,
  a_no3_cc: schema.soilAnalysis.a_no3_cc,
  a_p_al: schema.soilAnalysis.a_p_al,
  a_p_cc: schema.soilAnalysis.a_p_cc,
  a_p_ox: schema.soilAnalysis.a_p_ox,
  a_p_rt: schema.soilAnalysis.a_p_rt,
  a_p_sg: schema.soilAnalysis.a_p_sg,
  a_p_wa: schema.soilAnalysis.a_p_wa,
  a_ph_cc: schema.soilAnalysis.a_ph_cc,
  a_s_rt: schema.soilAnalysis.a_s_rt,
  a_sand_mi: schema.soilAnalysis.a_sand_mi,
  a_silt_mi: schema.soilAnalysis.a_silt_mi,
  a_som_loi: schema.soilAnalysis.a_som_loi,
  a_zn_cc: schema.soilAnalysis.a_zn_cc,
  b_gwl_class: schema.soilAnalysis.b_gwl_class,
  b_soiltype_agr: schema.soilAnalysis.b_soiltype_agr,
  b_sampling_date: schema.soilSampling.b_sampling_date,
  a_depth_upper: schema.soilSampling.a_depth_upper,
  a_depth_lower: schema.soilSampling.a_depth_lower,
  has_zone: sql<boolean>`${schema.soilSampling.b_sampling_geometry_zone} IS NOT NULL`,
}

type CurrentSoilDataRow = {
  a_id: string
  a_source: AggregationAnalysis["a_source"]
  b_sampling_date: Date | null
  a_depth_upper: number
  a_depth_lower: number | null
  has_zone: boolean
} & Record<string, unknown>

/**
 * Converts query rows to the input of the aggregation.
 */
function toAggregationAnalyses(rows: CurrentSoilDataRow[]): AggregationAnalysis[] {
  return rows.map((row) => ({
    a_id: row.a_id,
    a_source: row.a_source,
    b_sampling_date: row.b_sampling_date,
    a_depth_upper: row.a_depth_upper,
    a_depth_lower: row.a_depth_lower,
    has_zone: row.has_zone === true,
    values: row as Partial<Record<SoilParameters, unknown>>,
  }))
}

/**
 * SQL expression for a sampling zone clipped to the field boundary. Without a field geometry the
 * zone is used as is.
 *
 * @param zone - The sampling zone column.
 * @param fieldGeometry - The field geometry column of the same field.
 */
function clippedZone(zone: AnyColumn, fieldGeometry: AnyColumn): SQL {
  return sql`CASE WHEN ${fieldGeometry} IS NULL THEN ST_MakeValid(${zone})
    ELSE ST_Intersection(ST_MakeValid(${zone}), ST_MakeValid(${fieldGeometry})) END`
}

/**
 * SQL expression for the area (m²) of a geometry, calculated on the spheroid.
 */
function geographyArea(geometry: SQL): SQL<number> {
  return sql<number>`ST_Area((${geometry})::geography)`.mapWith(Number)
}

/**
 * Retrieves the field areas, clipped zone areas and pairwise zone intersections for the given fields.
 *
 * @param fdm - The FDM instance.
 * @param b_ids - The fields that have at least one analysis with a sampling zone.
 * @returns The zone areas per field.
 */
async function getZoneAreas(fdm: FdmType, b_ids: string[]): Promise<Map<string, ZoneAreas>> {
  const result = new Map<string, ZoneAreas>()
  if (b_ids.length === 0) return result

  const fieldRows = await fdm
    .select({
      b_id: schema.fields.b_id,
      b_area: sql<
        number | null
      >`ST_Area(ST_MakeValid(${schema.fields.b_geometry})::geography)`.mapWith((value) =>
        value === null ? null : Number(value),
      ),
    })
    .from(schema.fields)
    .where(inArray(schema.fields.b_id, b_ids))

  // Every pair of zones on the same field, including each zone with itself for its own area
  const pairSampling = alias(schema.soilSampling, "pair_sampling")
  const zone = clippedZone(schema.soilSampling.b_sampling_geometry_zone, schema.fields.b_geometry)
  const pairZone = clippedZone(pairSampling.b_sampling_geometry_zone, schema.fields.b_geometry)
  const pairRows = await fdm
    .select({
      b_id: schema.soilSampling.b_id,
      a_id_1: schema.soilSampling.a_id,
      a_id_2: pairSampling.a_id,
      area: geographyArea(
        sql`CASE WHEN ${schema.soilSampling.a_id} = ${pairSampling.a_id} THEN ${zone}
          ELSE ST_Intersection(${zone}, ${pairZone}) END`,
      ),
    })
    .from(schema.soilSampling)
    .innerJoin(schema.fields, eq(schema.fields.b_id, schema.soilSampling.b_id))
    .innerJoin(
      pairSampling,
      and(
        eq(pairSampling.b_id, schema.soilSampling.b_id),
        lte(schema.soilSampling.a_id, pairSampling.a_id),
      ),
    )
    .where(
      and(
        inArray(schema.soilSampling.b_id, b_ids),
        isNotNull(schema.soilSampling.b_sampling_geometry_zone),
        isNotNull(pairSampling.b_sampling_geometry_zone),
        or(
          eq(schema.soilSampling.a_id, pairSampling.a_id),
          sql`ST_Intersects(${zone}, ${pairZone})`,
        ),
      ),
    )

  const intersections = new Map<string, Map<string, number>>()
  for (const field of fieldRows) {
    intersections.set(field.b_id, new Map())
  }
  const zoneAreas = new Map<string, Map<string, number>>()
  for (const row of pairRows) {
    const area = Number(row.area ?? 0)
    if (row.a_id_1 === row.a_id_2) {
      const areas = zoneAreas.get(row.b_id) ?? new Map<string, number>()
      areas.set(row.a_id_1, area)
      zoneAreas.set(row.b_id, areas)
    } else {
      const pairs = intersections.get(row.b_id) ?? new Map<string, number>()
      // Store both orders: the SQL pair order follows the database collation, not JavaScript's
      pairs.set(`${row.a_id_1}|${row.a_id_2}`, area)
      pairs.set(`${row.a_id_2}|${row.a_id_1}`, area)
      intersections.set(row.b_id, pairs)
    }
  }

  for (const field of fieldRows) {
    const pairs = intersections.get(field.b_id) ?? new Map<string, number>()
    const zone_area = zoneAreas.get(field.b_id) ?? new Map<string, number>()
    result.set(field.b_id, {
      field_area: field.b_area,
      zone_area,
      intersection: (a_id_1, a_id_2) => {
        if (a_id_1 === a_id_2) return zone_area.get(a_id_1) ?? 0
        return pairs.get(`${a_id_1}|${a_id_2}`) ?? 0
      },
    })
  }
  return result
}

/**
 * Derives the current soil data for one or more fields from their analyses.
 *
 * Fields without sampling zones need no geometry queries: each parameter then takes the value of
 * the most recent analysis that has one. For fields with sampling zones, the zone areas are
 * retrieved and the contributing zones are combined by area (see {@link selectContributingAnalyses}
 * and {@link aggregateParameter}).
 *
 * @param fdm - The FDM instance.
 * @param analysesByField - The analyses per field, ordered by `b_sampling_date` descending (nulls last).
 * @returns The current soil data per field.
 */
async function deriveCurrentSoilData(
  fdm: FdmType,
  analysesByField: Map<string, AggregationAnalysis[]>,
): Promise<Map<string, CurrentSoilData>> {
  const zonedFields = [...analysesByField]
    .filter(([, analyses]) => analyses.some((analysis) => analysis.has_zone))
    .map(([b_id]) => b_id)
  const areasByField = await getZoneAreas(fdm, zonedFields)

  // Select the contributing analyses and collect the zones whose effective area needs an exact calculation
  const selections = new Map<string, Map<SoilParameters, AggregationAnalysis[]>>()
  const differenceRequests = new Map<string, { b_id: string; a_id: string; newer: string[] }>()
  for (const [b_id, analyses] of analysesByField) {
    const areas = areasByField.get(b_id)
    const perParameter = new Map<SoilParameters, AggregationAnalysis[]>()
    for (const parameter of SOIL_PARAMETERS) {
      const selected = selectContributingAnalyses(parameter, analyses, areas)
      if (selected.length === 0) continue
      perParameter.set(parameter, selected)
      if (areas && selected.length > 1 && hasOverlappingZones(selected, areas)) {
        selected.forEach((analysis, i) => {
          const newer = selected.slice(0, i).map((x) => x.a_id)
          differenceRequests.set(differenceKey(b_id, analysis.a_id, newer), {
            b_id,
            a_id: analysis.a_id,
            newer,
          })
        })
      }
    }
    selections.set(b_id, perParameter)
  }

  const differenceAreas = await getEffectiveZoneAreas(fdm, [...differenceRequests.values()])

  const result = new Map<string, CurrentSoilData>()
  for (const [b_id, perParameter] of selections) {
    const areas = areasByField.get(b_id)
    const currentSoilData: CurrentSoilDataItem[] = []
    for (const [parameter, selected] of perParameter) {
      const effectiveArea = new Map<string, number>()
      selected.forEach((analysis, i) => {
        const newer = selected.slice(0, i).map((x) => x.a_id)
        const exact = differenceAreas.get(differenceKey(b_id, analysis.a_id, newer))
        effectiveArea.set(analysis.a_id, exact ?? areas?.zone_area.get(analysis.a_id) ?? 0)
      })
      const item = aggregateParameter(parameter, selected, effectiveArea, areas?.field_area ?? null)
      if (item) currentSoilData.push(item)
    }
    result.set(b_id, currentSoilData)
  }
  return result
}

function differenceKey(b_id: string, a_id: string, newer: string[]): string {
  return `${b_id}|${a_id}|${newer.join(",")}`
}

/**
 * Calculates the area of each requested zone that is not covered by the given newer zones.
 * Requests without newer zones are skipped: their effective area is the clipped zone area.
 *
 * @param fdm - The FDM instance.
 * @param requests - The zones and, per zone, the newer zones to subtract.
 * @returns The effective area (m²) per request, keyed by {@link differenceKey}.
 */
async function getEffectiveZoneAreas(
  fdm: FdmType,
  requests: { b_id: string; a_id: string; newer: string[] }[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (requests.length === 0) return result

  // Group the zones that share the same newer zones, so that each group needs one query
  const groups = new Map<string, { b_id: string; newer: string[]; a_ids: string[] }>()
  for (const request of requests) {
    if (request.newer.length === 0) continue
    const key = `${request.b_id}|${request.newer.join(",")}`
    const group = groups.get(key) ?? { b_id: request.b_id, newer: request.newer, a_ids: [] }
    group.a_ids.push(request.a_id)
    groups.set(key, group)
  }

  const newerSampling = alias(schema.soilSampling, "newer_sampling")
  await Promise.all(
    [...groups.values()].map(async ({ b_id, newer, a_ids }) => {
      // Union of the newer zones; it refers to the field of the outer query
      const newerZones = fdm
        .select({
          geom: sql`ST_Union(${clippedZone(newerSampling.b_sampling_geometry_zone, schema.fields.b_geometry)})`,
        })
        .from(newerSampling)
        .where(and(eq(newerSampling.b_id, b_id), inArray(newerSampling.a_id, newer)))

      const rows = await fdm
        .select({
          a_id: schema.soilSampling.a_id,
          area: geographyArea(
            sql`ST_Difference(
              ${clippedZone(schema.soilSampling.b_sampling_geometry_zone, schema.fields.b_geometry)},
              COALESCE((${newerZones}), 'SRID=4326;GEOMETRYCOLLECTION EMPTY'::geometry)
            )`,
          ),
        })
        .from(schema.soilSampling)
        .innerJoin(schema.fields, eq(schema.fields.b_id, schema.soilSampling.b_id))
        .where(
          and(
            eq(schema.soilSampling.b_id, b_id),
            inArray(schema.soilSampling.a_id, a_ids),
            isNotNull(schema.soilSampling.b_sampling_geometry_zone),
          ),
        )

      for (const row of rows) {
        result.set(differenceKey(b_id, row.a_id, newer), row.area)
      }
    }),
  )
  return result
}

/**
 * Validates the sampling geometries and normalises a `Polygon` zone to a `MultiPolygon`. An empty
 * MultiPoint or zone is stored as `null`: a zone without area must not count as a sampling zone.
 *
 * @param geometries - The sampling geometries as provided by the caller.
 * @returns The geometries to store. `undefined` means "leave unchanged".
 * @throws {Error} If a geometry has an unexpected type or invalid WGS84 coordinates.
 */
function normalizeSamplingGeometries(geometries: SoilSamplingGeometries): {
  b_sampling_geometry: GeoJSON.MultiPoint | null | undefined
  b_sampling_geometry_zone: GeoJSON.MultiPolygon | null | undefined
} {
  const { b_sampling_geometry_zone } = geometries
  let { b_sampling_geometry } = geometries

  const assertPositions = (positions: unknown[], name: string) => {
    for (const position of positions) {
      if (!Array.isArray(position) || position.length < 2) {
        throw new Error(`${name} contains an invalid position`)
      }
      const [lon, lat] = position as number[]
      if (
        !Number.isFinite(lon) ||
        !Number.isFinite(lat) ||
        lon < -180 ||
        lon > 180 ||
        lat < -90 ||
        lat > 90
      ) {
        throw new Error(`${name} must have WGS84 coordinates`)
      }
    }
  }

  if (b_sampling_geometry) {
    if (
      b_sampling_geometry.type !== "MultiPoint" ||
      !Array.isArray(b_sampling_geometry.coordinates)
    ) {
      throw new Error("b_sampling_geometry must be a MultiPoint")
    }
    assertPositions(b_sampling_geometry.coordinates, "b_sampling_geometry")
    // No sample points is the same as unknown sample points
    if (b_sampling_geometry.coordinates.length === 0) b_sampling_geometry = null
  }

  let zone: GeoJSON.MultiPolygon | null | undefined = b_sampling_geometry_zone as null | undefined
  if (b_sampling_geometry_zone) {
    if (
      (b_sampling_geometry_zone.type !== "Polygon" &&
        b_sampling_geometry_zone.type !== "MultiPolygon") ||
      !Array.isArray(b_sampling_geometry_zone.coordinates)
    ) {
      throw new Error("b_sampling_geometry_zone must be a Polygon or MultiPolygon")
    }
    zone =
      b_sampling_geometry_zone.type === "Polygon"
        ? { type: "MultiPolygon", coordinates: [b_sampling_geometry_zone.coordinates] }
        : b_sampling_geometry_zone
    for (const polygon of zone.coordinates) {
      if (!Array.isArray(polygon) || polygon.length === 0) {
        throw new Error("b_sampling_geometry_zone contains an invalid polygon")
      }
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4) {
          throw new Error("b_sampling_geometry_zone contains an invalid ring")
        }
        assertPositions(ring, "b_sampling_geometry_zone")
      }
    }
    // An empty zone represents no area; storing it would let it replace whole-field data, so it is
    // treated as no zone (the whole field)
    if (zone.coordinates.length === 0) zone = null
  }

  return { b_sampling_geometry, b_sampling_geometry_zone: zone }
}

/**
 * Builds the filter for the current soil data: analyses sampled after `timeframe.end` are excluded.
 */
function currentSoilDataFilter(base: SQL, timeframe?: Timeframe): SQL | undefined {
  if (!timeframe?.end) return base
  return and(
    base,
    or(
      lte(schema.soilSampling.b_sampling_date, timeframe.end),
      isNull(schema.soilSampling.b_sampling_date),
    ),
  )
}

/**
 * Retrieves the current value of each soil parameter for a specified field.
 *
 * For each parameter, the most recent analysis with a value decides:
 *
 * - If it represents the whole field (no sampling zone), its value is used.
 * - If it represents a sampling zone, the zone analyses sampled within one calendar month of it are
 *   combined. Older whole-field analyses are then ignored. Within a zone the most recent value is
 *   used; across zones numeric parameters take the area-weighted mean and categorical parameters
 *   the value with the largest area. When the zones cover less than 95% of the field,
 *   `has_coverage_warning` is set.
 *
 * Each item lists the contributing analyses in `sources`; `is_aggregated` is `true` when the value
 * combines several zones. For fields without sampling zones each item has exactly one source.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal requesting the data.
 * @param b_id - The identifier of the field.
 * @param timeframe - Optional timeframe to filter the soil analyses. Only analyses after `timeframe.end` are excluded.
 * @returns The current soil data: one item per parameter that has a value. Returns an empty array if no records are found.
 *
 * @throws {Error} If the principal lacks read permissions for the field or if the database query fails.
 */
export async function getCurrentSoilData(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: schema.soilSamplingTypeSelect["b_id"],
  timeframe?: Timeframe,
): Promise<CurrentSoilData | []> {
  try {
    await checkPermission(fdm, "field", "read", b_id, principal_id, "getCurrentSoilData")

    const rows = await fdm
      .select(currentSoilDataColumns)
      .from(schema.soilAnalysis)
      .innerJoin(schema.soilSampling, eq(schema.soilAnalysis.a_id, schema.soilSampling.a_id))
      .where(currentSoilDataFilter(eq(schema.soilSampling.b_id, b_id), timeframe))
      .orderBy(
        // Drizzle does not support NULL LAST argument yet
        sql`${schema.soilSampling.b_sampling_date} DESC NULLS LAST`,
      )

    if (rows.length === 0) return []

    const result = await deriveCurrentSoilData(
      fdm,
      new Map([[b_id, toAggregationAnalyses(rows as CurrentSoilDataRow[])]]),
    )
    return result.get(b_id) ?? []
  } catch (err) {
    throw handleError(err, "Exception for getCurrentSoilData", { b_id })
  }
}

/**
 * Retrieves the current soil data for every field on a farm.
 *
 * The values are derived in the same way as in `getCurrentSoilData`.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id - The identifier of the principal performing the operation.
 * @param b_id_farm - The identifier of the farm.
 * @param timeframe - Optional timeframe to exclude analyses with a sampling date after `timeframe.end`.
 * @returns A Map where each key is a field ID (`b_id`) and each value is the current soil data for that field.
 */
export async function getCurrentSoilDataForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  timeframe?: Timeframe,
): Promise<Map<string, CurrentSoilData>> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getCurrentSoilDataForFarm")

    const rows = await fdm
      .select({ ...currentSoilDataColumns, b_id: schema.fieldAcquiring.b_id })
      .from(schema.soilAnalysis)
      .innerJoin(schema.soilSampling, eq(schema.soilAnalysis.a_id, schema.soilSampling.a_id))
      .innerJoin(schema.fieldAcquiring, eq(schema.soilSampling.b_id, schema.fieldAcquiring.b_id))
      .where(currentSoilDataFilter(eq(schema.fieldAcquiring.b_id_farm, b_id_farm), timeframe))
      .orderBy(
        schema.fieldAcquiring.b_id,
        sql`${schema.soilSampling.b_sampling_date} DESC NULLS LAST`,
      )

    const rowsByField = new Map<string, CurrentSoilDataRow[]>()
    for (const row of rows) {
      const existing = rowsByField.get(row.b_id)
      if (existing) {
        existing.push(row as CurrentSoilDataRow)
      } else {
        rowsByField.set(row.b_id, [row as CurrentSoilDataRow])
      }
    }

    const analysesByField = new Map<string, AggregationAnalysis[]>()
    for (const [b_id, fieldRows] of rowsByField) {
      analysesByField.set(b_id, toAggregationAnalyses(fieldRows))
    }
    return await deriveCurrentSoilData(fdm, analysesByField)
  } catch (err) {
    throw handleError(err, "Exception for getCurrentSoilDataForFarm", {
      b_id_farm,
    })
  }
}

/**
 * Retrieves the current soil data per sampling zone for a specified field.
 *
 * Analyses are grouped into zones when their sampling zones overlap strongly (intersection over
 * union of at least 90%). Analyses without a sampling zone form the whole-field zone. Each zone holds
 * the values that contribute to the field-level result of `getCurrentSoilData`, so zones that
 * no longer contribute (for example, because a newer analysis replaced them) are left out.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal requesting the data.
 * @param b_id - The identifier of the field.
 * @param timeframe - Optional timeframe to filter the soil analyses. Only analyses after `timeframe.end` are excluded.
 * @returns The zones with their geometry (clipped to the field), area and current soil data. The zone with the most recent analysis comes first.
 *
 * @throws {Error} If the principal lacks read permissions for the field or if the database query fails.
 */
export async function getCurrentSoilDataPerZone(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: schema.soilSamplingTypeSelect["b_id"],
  timeframe?: Timeframe,
): Promise<SoilZone[]> {
  try {
    await checkPermission(fdm, "field", "read", b_id, principal_id, "getCurrentSoilDataPerZone")

    const rows = await fdm
      .select(currentSoilDataColumns)
      .from(schema.soilAnalysis)
      .innerJoin(schema.soilSampling, eq(schema.soilAnalysis.a_id, schema.soilSampling.a_id))
      .where(currentSoilDataFilter(eq(schema.soilSampling.b_id, b_id), timeframe))
      .orderBy(sql`${schema.soilSampling.b_sampling_date} DESC NULLS LAST`)
    if (rows.length === 0) return []

    const analyses = toAggregationAnalyses(rows as CurrentSoilDataRow[])
    const currentSoilData =
      (await deriveCurrentSoilData(fdm, new Map([[b_id, analyses]]))).get(b_id) ?? []

    const hasZones = analyses.some((analysis) => analysis.has_zone)
    const areas = hasZones ? (await getZoneAreas(fdm, [b_id])).get(b_id) : undefined
    const fieldArea =
      areas?.field_area ??
      (
        await fdm
          .select({
            b_area: sql<number | null>`ST_Area(${schema.fields.b_geometry}::geography)`.mapWith(
              (value) => (value === null ? null : Number(value)),
            ),
          })
          .from(schema.fields)
          .where(eq(schema.fields.b_id, b_id))
      )[0]?.b_area ??
      null

    const clusters = areas ? clusterZones(analyses, areas) : [analyses]

    // Assign every contributing source to its zone
    const zones = clusters.map((members) => ({
      members,
      data: [] as CurrentSoilData,
    }))
    for (const item of currentSoilData) {
      for (const source of item.sources) {
        const zone = zones.find((z) => z.members.some((member) => member.a_id === source.a_id))
        if (!zone) continue
        zone.data.push({
          parameter: item.parameter,
          value: source.value,
          is_aggregated: false,
          coverage: null,
          has_coverage_warning: false,
          sources: [{ ...source, area_fraction: 1 }],
        })
      }
    }
    const activeZones = zones.filter((zone) => zone.data.length > 0)

    // Retrieve the clipped geometry of the zones with a sampling zone
    const zoneIds = activeZones
      .filter((zone) => zone.members[0].has_zone)
      .map((zone) => zone.members[0].a_id)
    const geometries = new Map<string, GeoJSON.MultiPolygon | null>()
    if (zoneIds.length > 0) {
      const geometryRows = await fdm
        .select({
          a_id: schema.soilSampling.a_id,
          // Keep only the polygon parts of the clipped zone
          geometry: sql<
            string | null
          >`ST_AsGeoJSON(ST_Multi(ST_CollectionExtract(${clippedZone(schema.soilSampling.b_sampling_geometry_zone, schema.fields.b_geometry)}, 3)))`,
        })
        .from(schema.soilSampling)
        .innerJoin(schema.fields, eq(schema.fields.b_id, schema.soilSampling.b_id))
        .where(
          and(
            eq(schema.soilSampling.b_id, b_id),
            inArray(schema.soilSampling.a_id, zoneIds),
            isNotNull(schema.soilSampling.b_sampling_geometry_zone),
          ),
        )
      for (const row of geometryRows) {
        geometries.set(
          row.a_id,
          row.geometry ? (JSON.parse(row.geometry) as GeoJSON.MultiPolygon) : null,
        )
      }
    }

    return activeZones.map((zone) => {
      const first = zone.members[0]
      const area = first.has_zone ? (areas?.zone_area.get(first.a_id) ?? null) : fieldArea
      return {
        b_sampling_geometry_zone: first.has_zone ? (geometries.get(first.a_id) ?? null) : null,
        b_area: area === null ? null : Math.round((area / 10000) * 100) / 100,
        a_ids: zone.members.map((member) => member.a_id),
        data: zone.data,
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for getCurrentSoilDataPerZone", { b_id })
  }
}

/**
 * Retrieves a description of the available soil parameters.
 *
 * This function returns an array of objects, each describing a soil parameter.
 * Each description includes the parameter's name, unit, type (numeric or enum),
 * a human-readable name, a detailed description, and optional constraints like
 * minimum and maximum values or a list of valid options for enum types.
 *
 * @param locale - The locale for which to retrieve the descriptions. Currently only 'NL-nl' is supported.
 * @returns An array of SoilParameterDescriptionItem objects.
 * @throws {Error} If an unsupported locale is provided.
 */
export function getSoilParametersDescription(locale = "NL-nl"): SoilParameterDescription {
  if (locale !== "NL-nl") throw new Error("Unsupported locale")
  const soilParameterDescription: SoilParameterDescription = [
    {
      parameter: "a_source",
      unit: "",
      name: "Laboratorium",
      type: "enum",
      description: "Laboratorium dat de analyse heeft gedaan",
      options: schema.soilAnalysisSourceOptions,
    },
    {
      parameter: "a_id",
      unit: "",
      name: "ID",
      type: "text",
      description: "Analyse ID",
    },
    {
      parameter: "b_sampling_date",
      unit: "",
      name: "Datum",
      type: "date",
      description: "Datum van monstername",
    },
    {
      parameter: "a_depth_upper",
      unit: "cm",
      name: "Bemonsterde laag (bovenkant)",
      type: "numeric",
      description: "Diepte vanaf waar is bemonsterd",
    },
    {
      parameter: "a_depth_lower",
      unit: "cm",
      name: "Bemonsterde laag (onderkant)",
      type: "numeric",
      description: "Diepte tot waar is bemonsterd",
    },
    {
      parameter: "a_al_ox",
      unit: "mmol Al/kg",
      name: "Al-ox",
      type: "numeric",
      description: "Aluminium geëxtraheerd met oxalaat",
    },
    {
      parameter: "a_c_of",
      unit: "g C/kg",
      name: "C-organisch",
      type: "numeric",
      description: "Organisch koolstofgehalte",
    },
    {
      parameter: "a_ca_co",
      unit: "mmol+/kg",
      name: "Ca-uitwisselbaar",
      type: "numeric",
      description: "Calcium, uitwisselbaar (CEC-gebonden)",
    },
    {
      parameter: "a_ca_co_po",
      unit: "%",
      name: "Ca-bezetting",
      type: "numeric",
      description: "Calcium bezettingsgraad",
    },
    {
      parameter: "a_caco3_if",
      unit: "%",
      name: "Koolzure kalk",
      type: "numeric",
      description: "Koolzure kalk",
    },
    {
      parameter: "a_cec_co",
      unit: "mmol+/kg",
      name: "Klei-humus",
      type: "numeric",
      description: "CEC",
    },
    {
      parameter: "a_clay_mi",
      unit: "%",
      name: "Klei (<2 μm)",
      type: "numeric",
      description: "Kleigehalte",
    },
    {
      parameter: "a_cn_fr",
      unit: "-",
      name: "C/N-ratio",
      type: "numeric",
      description: "Koolstof / Stikstof ratio",
    },
    {
      parameter: "a_com_fr",
      unit: "-",
      name: "C/OS-ratio",
      type: "numeric",
      description: "Koolstof / Organische stof ratio",
    },
    {
      parameter: "a_cu_cc",
      unit: "µg Cu/kg",
      name: "Cu-plantbeschikbaar",
      type: "numeric",
      description: "Koper, plantbeschikbaar",
    },
    {
      parameter: "a_density_sa",
      unit: "g/cm³",
      name: "Dichtheid",
      type: "numeric",
      description: "Bulkdichtheid",
    },
    {
      parameter: "a_fe_ox",
      unit: "mmol Fe/kg",
      name: "Fe-ox",
      type: "numeric",
      description: "IJzer geëxtraheerd met oxalaat",
    },
    {
      parameter: "a_k_cc",
      unit: "mg K/kg",
      name: "K-plantbeschikbaar",
      type: "numeric",
      description: "Kalium, plantbeschikbaar",
    },
    {
      parameter: "a_k_co",
      unit: "mmol+/kg",
      name: "K-uitwisselbaar",
      type: "numeric",
      description: "Kalium, uitwisselbaar (CEC-gebonden)",
    },
    {
      parameter: "a_k_co_po",
      unit: "%",
      name: "K-bezetting",
      type: "numeric",
      description: "Kalium bezettingsgraad",
    },
    {
      parameter: "a_mg_cc",
      unit: "mg Mg/kg",
      name: "Mg-plantbeschikbaar",
      type: "numeric",
      description: "Magnesium, plantbeschikbaar",
    },
    {
      parameter: "a_mg_co",
      unit: "mmol+/kg",
      name: "Mg-uitwisselbaar",
      type: "numeric",
      description: "Magnesium, uitwisselbaar (CEC-gebonden)",
    },
    {
      parameter: "a_mg_co_po",
      unit: "%",
      name: "Mg-bezetting",
      type: "numeric",
      description: "Magnesium bezettingsgraad",
    },
    {
      parameter: "a_n_pmn",
      unit: "mg N/kg",
      name: "Microbiële activiteit",
      type: "numeric",
      description: "Microbiële activiteit",
    },
    {
      parameter: "a_n_rt",
      unit: "mg N/kg",
      name: "N-totale bodemvoorraad",
      type: "numeric",
      description: "Stikstof, totale bodemvoorraad",
    },
    {
      parameter: "a_nh4_cc",
      unit: "mg N/l",
      name: "Ammonium-N",
      type: "numeric",
      description: "Ammonium (NH4-N)",
    },
    {
      parameter: "a_nmin_cc",
      unit: "kg N/ha",
      name: "N-voorraad",
      type: "numeric",
      description: "Beschikbare stikstofvoorraad",
    },
    {
      parameter: "a_no3_cc",
      unit: "mg N/l",
      name: "Nitraat-N",
      type: "numeric",
      description: "Nitraat (NO3-N)",
    },
    {
      parameter: "a_p_al",
      unit: "mg P2O5/100 g",
      name: "P-Al",
      type: "numeric",
      description: "Totaal fosfaatgehalte",
    },
    {
      parameter: "a_p_cc",
      unit: "mg P/kg",
      name: "P-plantbeschikbaar",
      type: "numeric",
      description: "Fosfor, plantbeschikbaar",
    },
    {
      parameter: "a_p_ox",
      unit: "mmol P/kg",
      name: "P-ox",
      type: "numeric",
      description: "Fosfor geëxtraheerd met oxalaat",
    },
    {
      parameter: "a_p_rt",
      unit: "g P/kg",
      name: "P-bodemvoorraad",
      type: "numeric",
      description: "Fosfor, totale bodemvoorraad",
    },
    {
      parameter: "a_p_sg",
      unit: "%",
      name: "FVG",
      type: "numeric",
      description: "Fosforverzadigingsgraad",
    },
    {
      parameter: "a_p_wa",
      unit: "mg P2O5/l",
      name: "Pw-getal",
      type: "numeric",
      description: "Fosfaat geëxtraheerd met water",
    },
    {
      parameter: "a_ph_cc",
      unit: "-",
      name: "Zuurgraad (pH)",
      type: "numeric",
      description: "Zuurgraad gemeten met CaCl2-extractie",
    },
    {
      parameter: "a_s_rt",
      unit: "mg S/kg",
      name: "S-totale bodemvoorraad",
      type: "numeric",
      description: "Zwavel, totale bodemvoorraad",
    },
    {
      parameter: "a_sand_mi",
      unit: "%",
      name: "Zand (>50 μm)",
      type: "numeric",
      description: "Zandgehalte",
    },
    {
      parameter: "a_silt_mi",
      unit: "%",
      name: "Silt (2-50 μm)",
      type: "numeric",
      description: "Siltgehalte",
    },
    {
      parameter: "a_som_loi",
      unit: "%",
      name: "OS",
      type: "numeric",
      description: "Organische stof",
    },
    {
      parameter: "a_zn_cc",
      unit: "µg Zn/kg",
      name: "Zn-plantbeschikbaar",
      type: "numeric",
      description: "Zink, plantbeschikbaar",
    },
    {
      parameter: "d_n_supply_base",
      unit: "kg N/ha",
      name: "NLV",
      type: "numeric",
      description: "Jaarlijkse stikstofmineralisatie uit organische stof in de bouwvoor (0-30 cm)",
    },
    {
      parameter: "b_gwl_class",
      unit: "",
      name: "GWT",
      type: "enum",
      description: "Grondwatertrap",
      options: schema.gwlClassesOptions,
    },
    {
      parameter: "b_soiltype_agr",
      unit: "",
      name: "Bodemtype",
      type: "enum",
      description: "Agrarisch bodemtype",
      options: schema.soilTypesOptions,
    },
  ]

  return soilParameterDescription
}

const SOIL_PARAMETERS: SoilParameters[] = [
  "a_al_ox",
  "a_c_of",
  "a_ca_co",
  "a_ca_co_po",
  "a_caco3_if",
  "a_cec_co",
  "a_clay_mi",
  "a_cn_fr",
  "a_com_fr",
  "a_cu_cc",
  "a_density_sa",
  "a_fe_ox",
  "a_k_cc",
  "a_k_co",
  "a_k_co_po",
  "a_mg_cc",
  "a_mg_co",
  "a_mg_co_po",
  "a_n_pmn",
  "a_n_rt",
  "a_nh4_cc",
  "a_nmin_cc",
  "a_no3_cc",
  "a_p_al",
  "a_p_cc",
  "a_p_ox",
  "a_p_rt",
  "a_p_sg",
  "a_p_wa",
  "a_ph_cc",
  "a_s_rt",
  "a_sand_mi",
  "a_silt_mi",
  "a_som_loi",
  "a_zn_cc",
  "d_n_supply_base",
  "b_gwl_class",
  "b_soiltype_agr",
]
