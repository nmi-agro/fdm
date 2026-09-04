import type {
  CatalogueAnimalCategories,
  CatalogueFeed,
  CatalogueFertilizer,
  CatalogueFertilizerItem,
  CatalogueMeasure,
} from "@nmi-agro/fdm-data"
import {
  getAnimalCategoriesCatalogue,
  getCultivationCatalogue,
  getFeedCatalogue,
  getFertilizersCatalogue,
  getMeasuresCatalogue,
  hashAnimalCategory,
  hashCultivation,
  hashFeed,
  hashFertilizer,
  hashMeasure,
} from "@nmi-agro/fdm-data"
import { and, eq, inArray } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type { AppAmountUnit } from "./fertilizer-application-unit-conversion"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"

/**
 * Gets all enabled fertilizer catalogues for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @returns A Promise that resolves to an array of enabled fertilizer catalogue sources.
 * @throws If retrieving the catalogues fails.
 */
export async function getEnabledFertilizerCatalogues(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<string[]> {
  try {
    await checkPermission(
      fdm,
      "farm",
      "read",
      b_id_farm,
      principal_id,
      "getEnabledFertilizerCatalogues",
    )
    const result = await fdm
      .select({
        p_source: schema.fertilizerCatalogueEnabling.p_source,
      })
      .from(schema.fertilizerCatalogueEnabling)
      .where(eq(schema.fertilizerCatalogueEnabling.b_id_farm, b_id_farm))

    return result.map((row: { p_source: string }) => row.p_source)
  } catch (err) {
    throw handleError(err, "Exception for getEnabledFertilizerCatalogues", {
      principal_id,
      b_id_farm,
    })
  }
}

export async function getEnabledFeedCatalogues(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<string[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getEnabledFeedCatalogues")
    const result = await fdm
      .select({ f_source: schema.feedCatalogueEnabling.f_source })
      .from(schema.feedCatalogueEnabling)
      .where(eq(schema.feedCatalogueEnabling.b_id_farm, b_id_farm))
    return result.map((row) => row.f_source)
  } catch (err) {
    throw handleError(err, "Exception for getEnabledFeedCatalogues", {
      principal_id,
      b_id_farm,
    })
  }
}

/**
 * Gets all enabled cultivation catalogues for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @returns A Promise that resolves to an array of enabled cultivation catalogue sources.
 * @throws If retrieving the catalogues fails.
 */
export async function getEnabledCultivationCatalogues(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<string[]> {
  try {
    await checkPermission(
      fdm,
      "farm",
      "read",
      b_id_farm,
      principal_id,
      "getEnabledCultivationCatalogues",
    )
    const result = await fdm
      .select({
        b_lu_source: schema.cultivationCatalogueSelecting.b_lu_source,
      })
      .from(schema.cultivationCatalogueSelecting)
      .where(eq(schema.cultivationCatalogueSelecting.b_id_farm, b_id_farm))

    return result.map((row: { b_lu_source: string }) => row.b_lu_source)
  } catch (err) {
    throw handleError(err, "Exception for getEnabledCultivationCatalogues", {
      principal_id,
      b_id_farm,
    })
  }
}

/**
 * Gets all enabled fertilizer catalogues for multiple farms.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param farmIds The IDs of the farms.
 * @returns A Promise that resolves to a record mapping each farm ID to an array of its enabled fertilizer catalogue sources.
 * @throws If retrieving the catalogues fails.
 */
export async function getEnabledFertilizerCataloguesForFarms(
  fdm: FdmType,
  principal_id: PrincipalId,
  farmIds: schema.farmsTypeSelect["b_id_farm"][],
): Promise<Record<string, string[]>> {
  try {
    await Promise.all(
      farmIds.map((b_id_farm) =>
        checkPermission(
          fdm,
          "farm",
          "read",
          b_id_farm,
          principal_id,
          "getEnabledFertilizerCataloguesForFarms",
        ),
      ),
    )
    const rows = await fdm
      .select({
        b_id_farm: schema.fertilizerCatalogueEnabling.b_id_farm,
        p_source: schema.fertilizerCatalogueEnabling.p_source,
      })
      .from(schema.fertilizerCatalogueEnabling)
      .where(inArray(schema.fertilizerCatalogueEnabling.b_id_farm, farmIds))

    const result: Record<string, string[]> = Object.fromEntries(
      farmIds.map((id) => [id, [] as string[]]),
    )
    for (const row of rows) {
      result[row.b_id_farm].push(row.p_source)
    }
    return result
  } catch (err) {
    throw handleError(err, "Exception for getEnabledFertilizerCataloguesForFarms", {
      principal_id,
      farmIds,
    })
  }
}

/**
 * Gets all enabled cultivation catalogues for multiple farms.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param farmIds The IDs of the farms.
 * @returns A Promise that resolves to a record mapping each farm ID to an array of its enabled cultivation catalogue sources.
 * @throws If retrieving the catalogues fails.
 */
export async function getEnabledCultivationCataloguesForFarms(
  fdm: FdmType,
  principal_id: PrincipalId,
  farmIds: schema.farmsTypeSelect["b_id_farm"][],
): Promise<Record<string, string[]>> {
  try {
    await Promise.all(
      farmIds.map((b_id_farm) =>
        checkPermission(
          fdm,
          "farm",
          "read",
          b_id_farm,
          principal_id,
          "getEnabledCultivationCataloguesForFarms",
        ),
      ),
    )
    const rows = await fdm
      .select({
        b_id_farm: schema.cultivationCatalogueSelecting.b_id_farm,
        b_lu_source: schema.cultivationCatalogueSelecting.b_lu_source,
      })
      .from(schema.cultivationCatalogueSelecting)
      .where(inArray(schema.cultivationCatalogueSelecting.b_id_farm, farmIds))

    const result: Record<string, string[]> = Object.fromEntries(
      farmIds.map((id) => [id, [] as string[]]),
    )
    for (const row of rows) {
      result[row.b_id_farm].push(row.b_lu_source)
    }
    return result
  } catch (err) {
    throw handleError(err, "Exception for getEnabledCultivationCataloguesForFarms", {
      principal_id,
      farmIds,
    })
  }
}

/**
 * Enables a fertilizer catalogue for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param p_source The source/name of the fertilizer catalogue to enable.
 * @returns A Promise that resolves when the catalogue has been enabled.
 * @throws If enabling the catalogue fails.
 */
export async function enableFertilizerCatalogue(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  p_source: string,
): Promise<void> {
  try {
    await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      principal_id,
      "enableFertilizerCatalogue",
    )
    await fdm.insert(schema.fertilizerCatalogueEnabling).values({
      b_id_farm,
      p_source,
    })
  } catch (err) {
    throw handleError(err, "Exception for enableFertilizerCatalogue", {
      principal_id,
      b_id_farm,
      p_source,
    })
  }
}

export async function enableFeedCatalogue(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  f_source: string,
): Promise<void> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "enableFeedCatalogue")
    await fdm.insert(schema.feedCatalogueEnabling).values({ b_id_farm, f_source })
  } catch (err) {
    throw handleError(err, "Exception for enableFeedCatalogue", {
      principal_id,
      b_id_farm,
      f_source,
    })
  }
}

/**
 * Enables a cultivation catalogue for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param b_lu_source The source/name of the cultivation catalogue to enable.
 * @returns A Promise that resolves when the catalogue has been enabled.
 * @throws If enabling the catalogue fails.
 */
export async function enableCultivationCatalogue(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  b_lu_source: string,
): Promise<void> {
  try {
    await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      principal_id,
      "enableCultivationCatalogue",
    )
    await fdm.insert(schema.cultivationCatalogueSelecting).values({
      b_id_farm,
      b_lu_source,
    })
  } catch (err) {
    throw handleError(err, "Exception for enableCultivationCatalogue", {
      principal_id,
      b_id_farm,
      b_lu_source,
    })
  }
}

/**
 * Disables a fertilizer catalogue for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param p_source The source/name of the fertilizer catalogue to disable.
 * @returns A Promise that resolves when the catalogue has been disabled.
 * @throws If disabling the catalogue fails.
 */
export async function disableFertilizerCatalogue(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  p_source: string,
): Promise<void> {
  try {
    await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      principal_id,
      "disableFertilizerCatalogue",
    )
    await fdm
      .delete(schema.fertilizerCatalogueEnabling)
      .where(
        and(
          eq(schema.fertilizerCatalogueEnabling.b_id_farm, b_id_farm),
          eq(schema.fertilizerCatalogueEnabling.p_source, p_source),
        ),
      )
  } catch (err) {
    throw handleError(err, "Exception for disableFertilizerCatalogue", {
      principal_id,
      b_id_farm,
      p_source,
    })
  }
}

export async function disableFeedCatalogue(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  f_source: string,
): Promise<void> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "disableFeedCatalogue")
    await fdm
      .delete(schema.feedCatalogueEnabling)
      .where(
        and(
          eq(schema.feedCatalogueEnabling.b_id_farm, b_id_farm),
          eq(schema.feedCatalogueEnabling.f_source, f_source),
        ),
      )
  } catch (err) {
    throw handleError(err, "Exception for disableFeedCatalogue", {
      principal_id,
      b_id_farm,
      f_source,
    })
  }
}

/**
 * Disables a cultivation catalogue for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param b_lu_source The source/name of the cultivation catalogue to disable.
 * @returns A Promise that resolves when the catalogue has been disabled.
 * @throws If disabling the catalogue fails.
 */
export async function disableCultivationCatalogue(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  b_lu_source: string,
): Promise<void> {
  try {
    await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      principal_id,
      "disableCultivationCatalogue",
    )
    await fdm
      .delete(schema.cultivationCatalogueSelecting)
      .where(
        and(
          eq(schema.cultivationCatalogueSelecting.b_id_farm, b_id_farm),
          eq(schema.cultivationCatalogueSelecting.b_lu_source, b_lu_source),
        ),
      )
  } catch (err) {
    throw handleError(err, "Exception for disableCultivationCatalogue", {
      principal_id,
      b_id_farm,
      b_lu_source,
    })
  }
}

/**
 * Checks if a fertilizer catalogue is enabled for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param p_source The source/name of the fertilizer catalogue to check.
 * @returns A Promise that resolves to true if the catalogue is enabled, false otherwise.
 * @throws If checking the catalogue status fails.
 */
export async function isFertilizerCatalogueEnabled(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  p_source: string,
): Promise<boolean> {
  try {
    await checkPermission(
      fdm,
      "farm",
      "read",
      b_id_farm,
      principal_id,
      "isFertilizerCatalogueEnabled",
    )
    const result = await fdm
      .select({
        b_id_farm: schema.fertilizerCatalogueEnabling.b_id_farm,
        p_source: schema.fertilizerCatalogueEnabling.p_source,
      })
      .from(schema.fertilizerCatalogueEnabling)
      .where(
        and(
          eq(schema.fertilizerCatalogueEnabling.b_id_farm, b_id_farm),
          eq(schema.fertilizerCatalogueEnabling.p_source, p_source),
        ),
      )

    return result.length > 0
  } catch (err) {
    throw handleError(err, "Exception for isFertilizerCatalogueEnabled", {
      principal_id,
      b_id_farm,
      p_source,
    })
  }
}

export async function isFeedCatalogueEnabled(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  f_source: string,
): Promise<boolean> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "isFeedCatalogueEnabled")
    const result = await fdm
      .select({ b_id_farm: schema.feedCatalogueEnabling.b_id_farm })
      .from(schema.feedCatalogueEnabling)
      .where(
        and(
          eq(schema.feedCatalogueEnabling.b_id_farm, b_id_farm),
          eq(schema.feedCatalogueEnabling.f_source, f_source),
        ),
      )
    return result.length > 0
  } catch (err) {
    throw handleError(err, "Exception for isFeedCatalogueEnabled", {
      principal_id,
      b_id_farm,
      f_source,
    })
  }
}

/**
 * Checks if a cultivation catalogue is enabled for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param b_lu_source The source/name of the cultivation catalogue to check.
 * @returns A Promise that resolves to true if the catalogue is enabled, false otherwise.
 * @throws If checking the catalogue status fails.
 */
export async function isCultivationCatalogueEnabled(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  b_lu_source: string,
): Promise<boolean> {
  try {
    await checkPermission(
      fdm,
      "farm",
      "read",
      b_id_farm,
      principal_id,
      "isCultivationCatalogueEnabled",
    )
    const result = await fdm
      .select({
        b_id_farm: schema.cultivationCatalogueSelecting.b_id_farm,
        b_lu_source: schema.cultivationCatalogueSelecting.b_lu_source,
      })
      .from(schema.cultivationCatalogueSelecting)
      .where(
        and(
          eq(schema.cultivationCatalogueSelecting.b_id_farm, b_id_farm),
          eq(schema.cultivationCatalogueSelecting.b_lu_source, b_lu_source),
        ),
      )

    return result.length > 0
  } catch (err) {
    throw handleError(err, "Exception for isCultivationCatalogueEnabled", {
      principal_id,
      b_id_farm,
      b_lu_source,
    })
  }
}

/**
 * Gets all enabled animal-category catalogues for a farm.
 */
export async function getEnabledAnimalCategoryCatalogues(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<string[]> {
  try {
    await checkPermission(
      fdm,
      "farm",
      "read",
      b_id_farm,
      principal_id,
      "getEnabledAnimalCategoryCatalogues",
    )
    const result = await fdm
      .select({ l_category_source: schema.animalCategoryCatalogueSelecting.l_category_source })
      .from(schema.animalCategoryCatalogueSelecting)
      .where(eq(schema.animalCategoryCatalogueSelecting.b_id_farm, b_id_farm))

    return result.map((row) => row.l_category_source)
  } catch (err) {
    throw handleError(err, "Exception for getEnabledAnimalCategoryCatalogues", {
      principal_id,
      b_id_farm,
    })
  }
}

/**
 * Enables an animal-category catalogue for a farm.
 */
export async function enableAnimalCategoryCatalogue(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  l_category_source: string,
): Promise<void> {
  try {
    await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      principal_id,
      "enableAnimalCategoryCatalogue",
    )
    await fdm.insert(schema.animalCategoryCatalogueSelecting).values({
      b_id_farm,
      l_category_source,
    })
  } catch (err) {
    throw handleError(err, "Exception for enableAnimalCategoryCatalogue", {
      principal_id,
      b_id_farm,
      l_category_source,
    })
  }
}

/**
 * Disables an animal-category catalogue for a farm.
 */
export async function disableAnimalCategoryCatalogue(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  l_category_source: string,
): Promise<void> {
  try {
    await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      principal_id,
      "disableAnimalCategoryCatalogue",
    )
    await fdm
      .delete(schema.animalCategoryCatalogueSelecting)
      .where(
        and(
          eq(schema.animalCategoryCatalogueSelecting.b_id_farm, b_id_farm),
          eq(schema.animalCategoryCatalogueSelecting.l_category_source, l_category_source),
        ),
      )
  } catch (err) {
    throw handleError(err, "Exception for disableAnimalCategoryCatalogue", {
      principal_id,
      b_id_farm,
      l_category_source,
    })
  }
}

/**
 * Checks whether an animal-category catalogue is enabled for a farm.
 */
export async function isAnimalCategoryCatalogueEnabled(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  l_category_source: string,
): Promise<boolean> {
  try {
    await checkPermission(
      fdm,
      "farm",
      "read",
      b_id_farm,
      principal_id,
      "isAnimalCategoryCatalogueEnabled",
    )
    const result = await fdm
      .select({ b_id_farm: schema.animalCategoryCatalogueSelecting.b_id_farm })
      .from(schema.animalCategoryCatalogueSelecting)
      .where(
        and(
          eq(schema.animalCategoryCatalogueSelecting.b_id_farm, b_id_farm),
          eq(schema.animalCategoryCatalogueSelecting.l_category_source, l_category_source),
        ),
      )

    return result.length > 0
  } catch (err) {
    throw handleError(err, "Exception for isAnimalCategoryCatalogueEnabled", {
      principal_id,
      b_id_farm,
      l_category_source,
    })
  }
}

/**
 * Gets all enabled measure catalogues for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @returns A Promise that resolves to an array of enabled measure catalogue sources.
 * @throws If retrieving the catalogues fails.
 */
export async function getEnabledMeasureCatalogues(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<string[]> {
  try {
    await checkPermission(
      fdm,
      "farm",
      "read",
      b_id_farm,
      principal_id,
      "getEnabledMeasureCatalogues",
    )
    const result = await fdm
      .select({
        m_source: schema.measureCatalogueEnabling.m_source,
      })
      .from(schema.measureCatalogueEnabling)
      .where(eq(schema.measureCatalogueEnabling.b_id_farm, b_id_farm))

    return result.map((row) => row.m_source)
  } catch (err) {
    throw handleError(err, "Exception for getEnabledMeasureCatalogues", {
      principal_id,
      b_id_farm,
    })
  }
}

/**
 * Enables a measure catalogue for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param m_source The source/name of the measure catalogue to enable.
 * @returns A Promise that resolves when the catalogue has been enabled.
 * @throws If enabling the catalogue fails.
 */
export async function enableMeasureCatalogue(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  m_source: string,
): Promise<void> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "enableMeasureCatalogue")
    await fdm.insert(schema.measureCatalogueEnabling).values({
      b_id_farm,
      m_source,
    })
  } catch (err) {
    throw handleError(err, "Exception for enableMeasureCatalogue", {
      principal_id,
      b_id_farm,
      m_source,
    })
  }
}

/**
 * Disables a measure catalogue for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param m_source The source/name of the measure catalogue to disable.
 * @returns A Promise that resolves when the catalogue has been disabled.
 * @throws If disabling the catalogue fails.
 */
export async function disableMeasureCatalogue(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  m_source: string,
): Promise<void> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "disableMeasureCatalogue")
    await fdm
      .delete(schema.measureCatalogueEnabling)
      .where(
        and(
          eq(schema.measureCatalogueEnabling.b_id_farm, b_id_farm),
          eq(schema.measureCatalogueEnabling.m_source, m_source),
        ),
      )
  } catch (err) {
    throw handleError(err, "Exception for disableMeasureCatalogue", {
      principal_id,
      b_id_farm,
      m_source,
    })
  }
}

/**
 * Checks if a measure catalogue is enabled for a farm.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param m_source The source/name of the measure catalogue to check.
 * @returns A Promise that resolves to true if the catalogue is enabled, false otherwise.
 * @throws If checking the catalogue status fails.
 */
export async function isMeasureCatalogueEnabled(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  m_source: string,
): Promise<boolean> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "isMeasureCatalogueEnabled")
    const result = await fdm
      .select({
        b_id_farm: schema.measureCatalogueEnabling.b_id_farm,
        m_source: schema.measureCatalogueEnabling.m_source,
      })
      .from(schema.measureCatalogueEnabling)
      .where(
        and(
          eq(schema.measureCatalogueEnabling.b_id_farm, b_id_farm),
          eq(schema.measureCatalogueEnabling.m_source, m_source),
        ),
      )

    return result.length > 0
  } catch (err) {
    throw handleError(err, "Exception for isMeasureCatalogueEnabled", {
      principal_id,
      b_id_farm,
      m_source,
    })
  }
}

/**
 * Synchronizes the animal-category, fertilizer, cultivation, and optionally
 * measures catalogues in the FDM database.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param options Optional configuration. Provide `nmiApiKey` to also sync the measures catalogue from the NMI API.
 * @returns A promise that resolves when the synchronization is complete.
 */
export async function syncCatalogues(
  fdm: FdmType,
  options?: { nmiApiKey?: string },
): Promise<void> {
  await syncAnimalCategoryCatalogue(fdm)
  await ensureAnimalCategoryCatalogueSelection(fdm)
  await syncFertilizerCatalogue(fdm)
  await syncFeedCatalogue(fdm)
  await syncCultivationCatalogue(fdm)
  if (options?.nmiApiKey) {
    await syncMeasuresCatalogue(fdm, options.nmiApiKey)
  }
}

async function syncFeedCatalogue(fdm: FdmType): Promise<void> {
  return syncFeedCatalogueArray(fdm, await getFeedCatalogue("nmi"))
}

export async function syncFeedCatalogueArray(
  fdm: FdmType,
  catalogue: CatalogueFeed,
): Promise<void> {
  await fdm.transaction(async (tx) => {
    try {
      for (const catalogueItem of catalogue) {
        const item = { ...catalogueItem, hash: await hashFeed(catalogueItem) }
        const existing = await tx
          .select({ hash: schema.feedsCatalogue.hash })
          .from(schema.feedsCatalogue)
          .where(eq(schema.feedsCatalogue.f_id_catalogue, item.f_id_catalogue))
          .limit(1)

        if (existing.length === 0) {
          await tx.insert(schema.feedsCatalogue).values(item)
        } else if (
          existing[0].hash === null ||
          existing[0].hash === undefined ||
          existing[0].hash !== item.hash
        ) {
          await tx
            .update(schema.feedsCatalogue)
            .set({ ...item, updated: new Date() })
            .where(eq(schema.feedsCatalogue.f_id_catalogue, item.f_id_catalogue))
        }
      }
    } catch (error) {
      throw handleError(error, "Exception for syncFeedCatalogue")
    }
  })
}

async function ensureAnimalCategoryCatalogueSelection(fdm: FdmType): Promise<void> {
  await fdm.transaction(async (tx) => {
    try {
      const farms = await tx.select({ b_id_farm: schema.farms.b_id_farm }).from(schema.farms)
      for (const farm of farms) {
        await tx
          .insert(schema.animalCategoryCatalogueSelecting)
          .values({ b_id_farm: farm.b_id_farm, l_category_source: "rvo" })
          .onConflictDoNothing()
      }
    } catch (error) {
      throw handleError(error, "Exception for ensureAnimalCategoryCatalogueSelection")
    }
  })
}

async function syncAnimalCategoryCatalogue(fdm: FdmType): Promise<void> {
  const catalogue = await getAnimalCategoriesCatalogue("rvo")
  await syncAnimalCategoryCatalogueArray(fdm, catalogue)
}

export async function syncAnimalCategoryCatalogueArray(
  fdm: FdmType,
  catalogue: CatalogueAnimalCategories,
): Promise<void> {
  await fdm.transaction(async (tx) => {
    try {
      for (const catalogueItem of catalogue) {
        const hash = await hashAnimalCategory(catalogueItem)
        const item = { ...catalogueItem, hash }
        const existing = await tx
          .select({ hash: schema.animalCategoriesCatalogue.hash })
          .from(schema.animalCategoriesCatalogue)
          .where(eq(schema.animalCategoriesCatalogue.l_id_category, item.l_id_category))
          .limit(1)

        if (existing.length === 0) {
          await tx.insert(schema.animalCategoriesCatalogue).values(item)
        } else if (
          existing[0].hash === null ||
          existing[0].hash === undefined ||
          existing[0].hash !== item.hash
        ) {
          await tx
            .update(schema.animalCategoriesCatalogue)
            .set({ ...item, updated: new Date() })
            .where(eq(schema.animalCategoriesCatalogue.l_id_category, item.l_id_category))
        }
      }
    } catch (error) {
      throw handleError(error, "Exception for syncAnimalCategoryCatalogue")
    }
  })
}

async function syncFertilizerCatalogue(fdm: FdmType) {
  const srmCatalogue = await getFertilizersCatalogue("srm")
  const baatCatalogue = await getFertilizersCatalogue("baat")
  const fertilizersCatalogue = [...srmCatalogue, ...baatCatalogue]

  return syncFertilizerCatalogueArray(fdm, fertilizersCatalogue)
}

export async function syncFertilizerCatalogueArray(
  fdm: FdmType,
  fertilizersCatalogue: CatalogueFertilizer,
) {
  await fdm.transaction(async (tx) => {
    try {
      for (const catalogueItem of fertilizersCatalogue) {
        const item = await extendCatalogueFertilizer(catalogueItem)
        const existing = await tx
          .select({ hash: schema.fertilizersCatalogue.hash })
          .from(schema.fertilizersCatalogue)
          .where(eq(schema.fertilizersCatalogue.p_id_catalogue, item.p_id_catalogue))
          .limit(1)
        if (existing.length === 0) {
          //add the item if does not exist
          await tx.insert(schema.fertilizersCatalogue).values(item)

          // Automatically acquire this newly introduced catalogue product for every
          // farm that already has this catalogue source enabled. Without this,
          // only farms created *after* the product was added would ever see it
          // (new farms bulk-acquire the full enabled catalogue at creation time),
          // while existing farms would never get it without manual action.
          const farmsWithCatalogueEnabled = await tx
            .selectDistinct({ b_id_farm: schema.fertilizerCatalogueEnabling.b_id_farm })
            .from(schema.fertilizerCatalogueEnabling)
            .where(eq(schema.fertilizerCatalogueEnabling.p_source, item.p_source))

          for (const farm of farmsWithCatalogueEnabled) {
            const p_id = createId()
            await tx.insert(schema.fertilizers).values({ p_id })
            await tx.insert(schema.fertilizerAcquiring).values({
              b_id_farm: farm.b_id_farm,
              p_id,
              p_acquiring_amount: null,
              p_acquiring_date: null,
            })
            await tx.insert(schema.fertilizerPicking).values({
              p_id,
              p_id_catalogue: item.p_id_catalogue,
              p_picking_date: new Date(),
            })
          }
        } else {
          // update the hash if it is undefined, null or different
          if (
            existing[0].hash === null ||
            existing[0].hash === undefined ||
            existing[0].hash !== item.hash
          ) {
            await tx
              .update(schema.fertilizersCatalogue)
              .set({ ...item, updated: new Date() })
              .where(eq(schema.fertilizersCatalogue.p_id_catalogue, item.p_id_catalogue))
          }
        }
      }
    } catch (error) {
      throw handleError(error, "Exception for syncFertilizerCatalogue")
    }
  })
}

/**
 * Extends a catalogue fertilizer with computed properties and its up-to-date hash
 *
 * @param catalogueFertilizer fertilizer out of the catalogue
 * @returns a fertilizer object, ready for fertilizers_catalogue table insertion/update
 */
async function extendCatalogueFertilizer(catalogueFertilizer: CatalogueFertilizerItem) {
  const fertWithComputedProps = {
    ...catalogueFertilizer,
    p_app_amount_unit: (catalogueFertilizer.p_app_amount_unit ?? "kg/ha") as AppAmountUnit,
  }
  return {
    ...fertWithComputedProps,
    hash: await hashFertilizer(fertWithComputedProps),
  }
}

async function syncCultivationCatalogue(fdm: FdmType) {
  const brpCatalogue = await getCultivationCatalogue("brp")

  await fdm.transaction(async (tx) => {
    try {
      for (const item of brpCatalogue) {
        const hash = await hashCultivation(item)
        const existing = await tx
          .select({ hash: schema.cultivationsCatalogue.hash })
          .from(schema.cultivationsCatalogue)
          .where(eq(schema.cultivationsCatalogue.b_lu_catalogue, item.b_lu_catalogue))
          .limit(1)
        if (existing.length === 0) {
          //add the item if does not exist
          await tx.insert(schema.cultivationsCatalogue).values({
            ...item,
            hash: hash,
          })
        } else {
          // update the hash if it is undefined, null or different
          if (
            existing[0].hash === null ||
            existing[0].hash === undefined ||
            existing[0].hash !== hash
          ) {
            await tx
              .update(schema.cultivationsCatalogue)
              .set({ ...item, hash: hash, updated: new Date() })
              .where(eq(schema.cultivationsCatalogue.b_lu_catalogue, item.b_lu_catalogue))
          }
        }
      }
    } catch (error) {
      throw handleError(error, "Exception for syncCultivationCatalogue")
    }
  })
}

async function syncMeasuresCatalogue(fdm: FdmType, nmiApiKey: string): Promise<void> {
  const measures = await getMeasuresCatalogue("bln", nmiApiKey)
  return syncMeasuresCatalogueArray(fdm, measures)
}

/**
 * Synchronizes the measures catalogue with the provided array of catalogue items.
 *
 * Public so that tests and custom data injection can call it directly without a live API key.
 * Mirrors {@link syncFertilizerCatalogueArray}.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param measures Array of catalogue items (in pandex naming convention from fdm-data).
 */
export async function syncMeasuresCatalogueArray(
  fdm: FdmType,
  measures: CatalogueMeasure,
): Promise<void> {
  await fdm.transaction(async (tx) => {
    try {
      for (const catalogueItem of measures) {
        const hash = await hashMeasure(catalogueItem)
        const item = { ...catalogueItem, hash }
        const existing = await tx
          .select({ hash: schema.measuresCatalogue.hash })
          .from(schema.measuresCatalogue)
          .where(eq(schema.measuresCatalogue.m_id, item.m_id))
          .limit(1)
        if (existing.length === 0) {
          await tx.insert(schema.measuresCatalogue).values(item)
        } else {
          if (
            existing[0].hash === null ||
            existing[0].hash === undefined ||
            existing[0].hash !== item.hash
          ) {
            await tx
              .update(schema.measuresCatalogue)
              .set({ ...item, updated: new Date() })
              .where(eq(schema.measuresCatalogue.m_id, item.m_id))
          }
        }
      }
    } catch (error) {
      throw handleError(error, "Exception for syncMeasuresCatalogue")
    }
  })
}
