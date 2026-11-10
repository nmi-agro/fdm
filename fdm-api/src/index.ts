/** @module */

import {
  addSoilParameterEstimatesToField,
  calculateNitrogenBalance,
  calculateOrganicMatterBalance,
  collectInputForNitrogenBalance,
  collectInputForOrganicMatterBalance,
  createFunctionsForNorms,
  extractSoilAnalysesFromPdfs,
  getDoseForField,
  getFarmIndicators,
  getFarmMeasureSummary,
  getFarmNutrientAdviceRows,
  getFieldIndicators,
  getFieldMeasureOptions,
  getNitrogenBalanceField,
  getNitrogenBalanceForFarms,
  getOrganicMatterBalanceField,
  getOrganicMatterBalanceForFarms,
} from "@nmi-agro/fdm-calculator"
import {
  acceptInvitation,
  addCultivation,
  addDerogation,
  addFarm,
  addFarmToGroup,
  addFertilizer,
  addFertilizerApplication,
  addFertilizerToCatalogue,
  addField,
  addHarvest,
  addMeasure,
  addOrganicCertification,
  addSoilAnalysis,
  addSoilImage,
  addSoilImageAnnotation,
  createFarmGroup,
  declineInvitation,
  enableCultivationCatalogue,
  enableFertilizerCatalogue,
  enableMeasureCatalogue,
  type FdmAuth,
  type FdmType,
  getCultivation,
  getCultivations,
  getCultivationsForFarm,
  getCultivationsFromCatalogue,
  getCultivationsFromCatalogues,
  getCurrentSoilData,
  getCurrentSoilDataForFarm,
  getCurrentSoilDataPerZone,
  getEnabledCultivationCatalogues,
  getEnabledFertilizerCatalogues,
  getEnabledMeasureCatalogues,
  getFarm,
  getFarmGroup,
  getFarmIdsOfOrganization,
  getFarms,
  getFertilizer,
  getFertilizerApplication,
  getFertilizerApplications,
  getFertilizerApplicationsForFarm,
  getFertilizerPlan,
  getFertilizerPlans,
  getFertilizers,
  getFertilizersFromCatalogue,
  getFertilizersFromCatalogues,
  getField,
  getFields,
  getGrazingIntentions,
  getHarvest,
  getHarvests,
  getHarvestsForFarm,
  getMeasure,
  getMeasures,
  getMeasuresForFarm,
  getMeasuresFromCatalogue,
  getOrganicCertification,
  getSoilAnalyses,
  getSoilAnalysesForFarm,
  getSoilAnalysis,
  getSoilImage,
  getSoilImageAnnotation,
  getSoilImages,
  listDerogations,
  listFarmGroups,
  listOrganicCertifications,
  listPendingInvitationsForUser,
  removeCultivation,
  removeDerogation,
  removeFarm,
  removeFarmFromGroup,
  removeFarmGroup,
  removeFarmGroupMembership,
  removeFertilizer,
  removeFertilizerApplication,
  removeField,
  removeGrazingIntention,
  removeHarvest,
  removeMeasure,
  removeOrganicCertification,
  removeSoilAnalysis,
  removeSoilImage,
  removeSoilImageAnnotation,
  renameFarmGroup,
  setGrazingIntention,
  updateCultivation,
  updateFarm,
  updateFarmGroupMembership,
  updateFertilizerApplication,
  updateFertilizerFromCatalogue,
  updateField,
  updateHarvest,
  updateMeasure,
  updateSoilAnalysis,
  updateSoilImageAnnotation,
} from "@nmi-agro/fdm-core"
import {
  createFertilizerPlanStatusChecker,
  establishFertilizerPlan,
  type ReportBranding,
  removeFertilizerPlanWithFile,
} from "@nmi-agro/fdm-reports"
import { applyRvoImport, reviewShapefileImport } from "@nmi-agro/fdm-rvo"
import { createGcsStorage, type FileStorage, isGcsConfigured } from "@nmi-agro/fdm-storage"
import { buildApp } from "./app"
import { type CountFieldsOfFarms, countFieldsOfFarms } from "./limits"

/**
 * Describes the public configuration used to mount the FDM API application.
 */
export interface FdmApiConfig {
  /** Human-readable application name exposed in the generated OpenAPI document. */
  appName: string
  /** Canonical application URL used to build absolute problem type links. */
  appUrl: string
  /**
   * Base path under which the API, OpenAPI document, and docs UI are served.
   * Defaults to `"/"` for standalone deployments (e.g. `api.yourdomain.com/docs`).
   * Set to `"/api"` when embedding in another app (e.g. `app.yourdomain.com/api/docs`).
   */
  basePath?: string
  /**
   * Allowed origins for CORS. When provided, CORS headers are added to all
   * responses. Omit when the API is served from the same origin as the app.
   */
  allowedOrigins?: string[]
  /**
   * Storage for uploaded and generated files (soil images, lab reports, fertilizer plans).
   * Defaults to Google Cloud Storage when `GCS_BUCKET_NAME` is set. When no storage is
   * available, file endpoints respond with `503 Service Unavailable`.
   */
  storage?: FileStorage
  /**
   * Name and images shown in generated reports such as the fertilizer plan. Defaults to the
   * `appName` without images.
   */
  reportBranding?: ReportBranding | (() => Promise<ReportBranding>)
}

/**
 * Defines the core data access functions used by the API routes.
 */
export interface FdmApiServices {
  // Farms
  getFarms: typeof getFarms
  getFarm: typeof getFarm
  addFarm: typeof addFarm
  updateFarm: typeof updateFarm
  removeFarm: typeof removeFarm
  // Farm groups
  listFarmGroups: typeof listFarmGroups
  getFarmGroup: typeof getFarmGroup
  createFarmGroup: typeof createFarmGroup
  renameFarmGroup: typeof renameFarmGroup
  removeFarmGroup: typeof removeFarmGroup
  addFarmToGroup: typeof addFarmToGroup
  removeFarmFromGroup: typeof removeFarmFromGroup
  updateFarmGroupMembership: typeof updateFarmGroupMembership
  removeFarmGroupMembership: typeof removeFarmGroupMembership
  // Fields
  getFields: typeof getFields
  getField: typeof getField
  addField: typeof addField
  updateField: typeof updateField
  removeField: typeof removeField
  // Cultivations
  getEnabledCultivationCatalogues: typeof getEnabledCultivationCatalogues
  enableCultivationCatalogue: typeof enableCultivationCatalogue
  getCultivationsFromCatalogues: typeof getCultivationsFromCatalogues
  getCultivations: typeof getCultivations
  getCultivationsForFarm: typeof getCultivationsForFarm
  getCultivation: typeof getCultivation
  addCultivation: typeof addCultivation
  updateCultivation: typeof updateCultivation
  removeCultivation: typeof removeCultivation
  // Harvests
  getHarvests: typeof getHarvests
  getHarvest: typeof getHarvest
  addHarvest: typeof addHarvest
  updateHarvest: typeof updateHarvest
  removeHarvest: typeof removeHarvest
  // Fertilizers
  getEnabledFertilizerCatalogues: typeof getEnabledFertilizerCatalogues
  enableFertilizerCatalogue: typeof enableFertilizerCatalogue
  getFertilizersFromCatalogues: typeof getFertilizersFromCatalogues
  getFertilizers: typeof getFertilizers
  addFertilizer: typeof addFertilizer
  getFertilizer: typeof getFertilizer
  removeFertilizer: typeof removeFertilizer
  getFertilizersFromCatalogue: typeof getFertilizersFromCatalogue
  // Fertilizer applications
  getFertilizerApplications: typeof getFertilizerApplications
  getFertilizerApplication: typeof getFertilizerApplication
  addFertilizerApplication: typeof addFertilizerApplication
  updateFertilizerApplication: typeof updateFertilizerApplication
  removeFertilizerApplication: typeof removeFertilizerApplication
  // Measures
  getEnabledMeasureCatalogues: typeof getEnabledMeasureCatalogues
  enableMeasureCatalogue: typeof enableMeasureCatalogue
  getMeasuresFromCatalogue: typeof getMeasuresFromCatalogue
  getMeasures: typeof getMeasures
  getMeasure: typeof getMeasure
  addMeasure: typeof addMeasure
  updateMeasure: typeof updateMeasure
  removeMeasure: typeof removeMeasure
  // indicators and measure options
  getFieldIndicators: typeof getFieldIndicators
  getFarmIndicators: typeof getFarmIndicators
  getFieldMeasureOptions: typeof getFieldMeasureOptions
  /** Resolves the server-side NMI API key; `undefined` when not configured. */
  getNmiApiKey: () => string | undefined
  /** Counts the fields of farms, to enforce the farm size that the API supports. */
  countFieldsOfFarms: CountFieldsOfFarms
  // Organic certifications
  listOrganicCertifications: typeof listOrganicCertifications
  addOrganicCertification: typeof addOrganicCertification
  getOrganicCertification: typeof getOrganicCertification
  removeOrganicCertification: typeof removeOrganicCertification
  // Derogations
  listDerogations: typeof listDerogations
  addDerogation: typeof addDerogation
  removeDerogation: typeof removeDerogation
  // Grazing intentions
  getGrazingIntentions: typeof getGrazingIntentions
  setGrazingIntention: typeof setGrazingIntention
  removeGrazingIntention: typeof removeGrazingIntention
  // Soil analyses
  getSoilAnalyses: typeof getSoilAnalyses
  getSoilAnalysesForFarm: typeof getSoilAnalysesForFarm
  getCurrentSoilData: typeof getCurrentSoilData
  getCurrentSoilDataPerZone: typeof getCurrentSoilDataPerZone
  getSoilAnalysis: typeof getSoilAnalysis
  addSoilAnalysis: typeof addSoilAnalysis
  updateSoilAnalysis: typeof updateSoilAnalysis
  removeSoilAnalysis: typeof removeSoilAnalysis
  // Calculations
  collectInputForNitrogenBalance: typeof collectInputForNitrogenBalance
  calculateNitrogenBalance: typeof calculateNitrogenBalance
  getNitrogenBalanceField: typeof getNitrogenBalanceField
  collectInputForOrganicMatterBalance: typeof collectInputForOrganicMatterBalance
  calculateOrganicMatterBalance: typeof calculateOrganicMatterBalance
  getOrganicMatterBalanceField: typeof getOrganicMatterBalanceField
  getDoseForField: typeof getDoseForField
  // Norms
  createFunctionsForNorms: typeof createFunctionsForNorms
  // Custom fertilizers
  addFertilizerToCatalogue: typeof addFertilizerToCatalogue
  updateFertilizerFromCatalogue: typeof updateFertilizerFromCatalogue
  // Farm-level lists
  getFertilizerApplicationsForFarm: typeof getFertilizerApplicationsForFarm
  getHarvestsForFarm: typeof getHarvestsForFarm
  getMeasuresForFarm: typeof getMeasuresForFarm
  // Current soil data per farm
  getCurrentSoilDataForFarm: typeof getCurrentSoilDataForFarm
  // Nutrient advice
  getFarmNutrientAdviceRows: typeof getFarmNutrientAdviceRows
  // Harvest parameters
  getCultivationsFromCatalogue: typeof getCultivationsFromCatalogue
  // Invitations
  listPendingInvitationsForUser: typeof listPendingInvitationsForUser
  acceptInvitation: typeof acceptInvitation
  declineInvitation: typeof declineInvitation
  // Soil images
  getSoilImages: typeof getSoilImages
  getSoilImage: typeof getSoilImage
  addSoilImage: typeof addSoilImage
  removeSoilImage: typeof removeSoilImage
  addSoilImageAnnotation: typeof addSoilImageAnnotation
  getSoilImageAnnotation: typeof getSoilImageAnnotation
  updateSoilImageAnnotation: typeof updateSoilImageAnnotation
  removeSoilImageAnnotation: typeof removeSoilImageAnnotation
  // Lab reports
  extractSoilAnalysesFromPdfs: typeof extractSoilAnalysesFromPdfs
  // Field import
  reviewShapefileImport: typeof reviewShapefileImport
  applyRvoImport: typeof applyRvoImport
  // Soil estimates
  addSoilParameterEstimatesToField: typeof addSoilParameterEstimatesToField
  // Fertilizer plans
  establishFertilizerPlan: typeof establishFertilizerPlan
  removeFertilizerPlanWithFile: typeof removeFertilizerPlanWithFile
  createFertilizerPlanStatusChecker: typeof createFertilizerPlanStatusChecker
  // Fertilizer plans (core)
  getFertilizerPlans: typeof getFertilizerPlans
  getFertilizerPlan: typeof getFertilizerPlan
  // Farm group aggregations
  getNitrogenBalanceForFarms: typeof getNitrogenBalanceForFarms
  getOrganicMatterBalanceForFarms: typeof getOrganicMatterBalanceForFarms
  getFarmMeasureSummary: typeof getFarmMeasureSummary
  // Organizations
  getFarmIdsOfOrganization: typeof getFarmIdsOfOrganization
  // Files
  /** Returns the file storage; `undefined` when no storage is configured. */
  getStorage: () => FileStorage | undefined
  /** Returns the name and images shown in generated reports. */
  getReportBranding: () => Promise<ReportBranding>
}

/**
 * The production implementations of {@link FdmApiServices}, backed by fdm-core, fdm-calculator
 * and the other FDM packages. `getReportBranding` is configured per deployment and is not included.
 * Other services that reuse the API operations, such as the MCP server, start from this object.
 */
export const defaultServices: Omit<FdmApiServices, "getReportBranding"> = {
  getFarms,
  getFarm,
  addFarm,
  updateFarm,
  removeFarm,
  listFarmGroups,
  getFarmGroup,
  createFarmGroup,
  renameFarmGroup,
  removeFarmGroup,
  addFarmToGroup,
  removeFarmFromGroup,
  updateFarmGroupMembership,
  removeFarmGroupMembership,
  getFields,
  getField,
  addField,
  updateField,
  removeField,
  getEnabledCultivationCatalogues,
  enableCultivationCatalogue,
  getCultivationsFromCatalogues,
  getCultivations,
  getCultivationsForFarm,
  getCultivation,
  addCultivation,
  updateCultivation,
  removeCultivation,
  getHarvests,
  getHarvest,
  addHarvest,
  updateHarvest,
  removeHarvest,
  getFertilizers,
  addFertilizer,
  getFertilizer,
  removeFertilizer,
  getFertilizersFromCatalogue,
  enableFertilizerCatalogue,
  getEnabledFertilizerCatalogues,
  getFertilizersFromCatalogues,
  getFertilizerApplications,
  getFertilizerApplication,
  addFertilizerApplication,
  updateFertilizerApplication,
  removeFertilizerApplication,
  getEnabledMeasureCatalogues,
  enableMeasureCatalogue,
  getMeasuresFromCatalogue,
  getMeasures,
  getMeasure,
  addMeasure,
  updateMeasure,
  removeMeasure,
  getFieldIndicators,
  getFarmIndicators,
  getFieldMeasureOptions,
  getNmiApiKey: () => process.env.NMI_API_KEY || undefined,
  countFieldsOfFarms,
  listOrganicCertifications,
  addOrganicCertification,
  getOrganicCertification,
  removeOrganicCertification,
  listDerogations,
  addDerogation,
  removeDerogation,
  getGrazingIntentions,
  setGrazingIntention,
  removeGrazingIntention,
  getSoilAnalyses,
  getSoilAnalysesForFarm,
  getCurrentSoilData,
  getCurrentSoilDataPerZone,
  getSoilAnalysis,
  addSoilAnalysis,
  updateSoilAnalysis,
  removeSoilAnalysis,
  collectInputForNitrogenBalance,
  calculateNitrogenBalance,
  getNitrogenBalanceField,
  collectInputForOrganicMatterBalance,
  calculateOrganicMatterBalance,
  getOrganicMatterBalanceField,
  getDoseForField,
  createFunctionsForNorms,
  addFertilizerToCatalogue,
  updateFertilizerFromCatalogue,
  getFertilizerApplicationsForFarm,
  getHarvestsForFarm,
  getMeasuresForFarm,
  getCurrentSoilDataForFarm,
  getFarmNutrientAdviceRows,
  getCultivationsFromCatalogue,
  listPendingInvitationsForUser,
  acceptInvitation,
  declineInvitation,
  getSoilImages,
  getSoilImage,
  addSoilImage,
  removeSoilImage,
  addSoilImageAnnotation,
  getSoilImageAnnotation,
  updateSoilImageAnnotation,
  removeSoilImageAnnotation,
  extractSoilAnalysesFromPdfs,
  reviewShapefileImport,
  applyRvoImport,
  addSoilParameterEstimatesToField,
  establishFertilizerPlan,
  removeFertilizerPlanWithFile,
  createFertilizerPlanStatusChecker,
  getFertilizerPlans,
  getFertilizerPlan,
  getNitrogenBalanceForFarms,
  getOrganicMatterBalanceForFarms,
  getFarmMeasureSummary,
  getFarmIdsOfOrganization,
  getStorage: () => (isGcsConfigured() ? defaultStorage() : undefined),
}

let gcsStorage: FileStorage | undefined
function defaultStorage(): FileStorage {
  gcsStorage ??= createGcsStorage()
  return gcsStorage
}

/**
 * Creates a fully configured Hono application for the FDM REST API.
 *
 * @param fdm - Database and service context from `@nmi-agro/fdm-core`.
 * @param auth - Authentication service used to verify incoming API keys.
 * @param config - Public API configuration such as names, URLs, and base path.
 * @param services - Optional service overrides for testing or custom data access behaviour.
 * @returns An `OpenAPIHono` application with middleware, routes, OpenAPI output, and docs UI registered.
 * @example
 * ```ts
 * const app = createFdmApi(fdm, auth, {
 *   appName: "My App",
 *   appUrl: "https://example.com",
 *   basePath: "/api",
 * })
 * ```
 */
export function createFdmApi(
  fdm: FdmType,
  auth: FdmAuth,
  config: FdmApiConfig,
  services: Partial<FdmApiServices> = {},
) {
  const branding = config.reportBranding
  const storage = config.storage
  const configServices: Pick<FdmApiServices, "getReportBranding"> & Partial<FdmApiServices> = {
    getReportBranding:
      typeof branding === "function" ? branding : async () => branding ?? { name: config.appName },
    ...(storage ? { getStorage: () => storage } : {}),
  }
  return buildApp(fdm, auth, config, { ...defaultServices, ...configServices, ...services })
}

export type { ApiEnv, ApiPrincipalContext } from "./types"
export { type ApiKeyAuthOptions, createApiKeyAuth } from "./auth"
export { ApiError, type ClassifiedError, classifyError } from "./error"
export { consumeRateLimit, RATE_LIMITS, type RateBucket, type RateLimitResult } from "./rate-limit"
export type { FileStorage } from "@nmi-agro/fdm-storage"
export type { ReportBranding } from "@nmi-agro/fdm-reports"
