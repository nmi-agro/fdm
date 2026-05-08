/** @module */

import type { FdmAuth, FdmType } from "@nmi-agro/fdm-core"
import {
    addCultivation,
    addDerogation,
    addFarm,
    addFertilizer,
    addFertilizerApplication,
    addField,
    addHarvest,
    addMeasure,
    addOrganicCertification,
    addSoilAnalysis,
    getCultivation,
    getCultivations,
    getCultivationsForFarm,
    getCurrentSoilData,
    getFarm,
    getFarms,
    getFertilizer,
    getFertilizerApplication,
    getFertilizerApplications,
    getFertilizers,
    getFertilizersFromCatalogue,
    getField,
    getFields,
    getGrazingIntentions,
    getHarvest,
    getHarvests,
    getMeasure,
    getMeasures,
    getOrganicCertification,
    getSoilAnalysis,
    getSoilAnalyses,
    getSoilAnalysesForFarm,
    listDerogations,
    listOrganicCertifications,
    removeCultivation,
    removeDerogation,
    removeFarm,
    removeFertilizer,
    removeFertilizerApplication,
    removeField,
    removeGrazingIntention,
    removeHarvest,
    removeMeasure,
    removeOrganicCertification,
    removeSoilAnalysis,
    setGrazingIntention,
    updateCultivation,
    updateFarm,
    updateFertilizerApplication,
    updateField,
    updateHarvest,
    updateMeasure,
    updateSoilAnalysis,
} from "@nmi-agro/fdm-core"
import { buildApp } from "./app"

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
    // Fields
    getFields: typeof getFields
    getField: typeof getField
    addField: typeof addField
    updateField: typeof updateField
    removeField: typeof removeField
    // Cultivations
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
    getMeasures: typeof getMeasures
    getMeasure: typeof getMeasure
    addMeasure: typeof addMeasure
    updateMeasure: typeof updateMeasure
    removeMeasure: typeof removeMeasure
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
    getSoilAnalysis: typeof getSoilAnalysis
    addSoilAnalysis: typeof addSoilAnalysis
    updateSoilAnalysis: typeof updateSoilAnalysis
    removeSoilAnalysis: typeof removeSoilAnalysis
}

const defaultServices: FdmApiServices = {
    getFarms,
    getFarm,
    addFarm,
    updateFarm,
    removeFarm,
    getFields,
    getField,
    addField,
    updateField,
    removeField,
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
    getFertilizerApplications,
    getFertilizerApplication,
    addFertilizerApplication,
    updateFertilizerApplication,
    removeFertilizerApplication,
    getMeasures,
    getMeasure,
    addMeasure,
    updateMeasure,
    removeMeasure,
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
    getSoilAnalysis,
    addSoilAnalysis,
    updateSoilAnalysis,
    removeSoilAnalysis,
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
    return buildApp(fdm, auth, config, { ...defaultServices, ...services })
}

export type { ApiPrincipalContext, ApiEnv } from "./types"
