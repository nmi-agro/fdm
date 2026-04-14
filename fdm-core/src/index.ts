/**
 * A library to interact with the Farm Data Model using PostgreSQL as backend
 *
 * @remarks
 * The `fdm` defines the {@link fdmLocal} and {@link fdmServer} class to store, retrieve and update the Farm Data Model
 *
 * Created by Nutriënten Management Instituut (www.nmi-agro.nl)
 * Source code available at https://github.com/nmi-agro/fdm
 * In case you find a bug, please report at https://github.com/nmi-agro/fdm/issues
 *
 * @public
 * @packageDocumentation
 */

/** {@inheritDoc fdmServer} */
import * as fdmSchema from "./db/schema"

export type { FdmAuth } from "./authentication"
// export { createFdmLocal } from './fdm-local'
export {
    createDisplayUsername,
    createFdmAuth,
    updateUserProfile,
} from "./authentication"
export { checkPermission } from "./authorization"
export type { PrincipalId } from "./authorization.types"
export {
    getCachedCalculation,
    setCachedCalculation,
    setCalculationError,
    withCalculationCache,
} from "./calculator"
export {
    disableCultivationCatalogue,
    disableFertilizerCatalogue,
    enableCultivationCatalogue,
    enableFertilizerCatalogue,
    getEnabledCultivationCatalogues,
    getEnabledCultivationCataloguesForFarms,
    getEnabledFertilizerCatalogues,
    getEnabledFertilizerCataloguesForFarms,
    isCultivationCatalogueEnabled,
    isFertilizerCatalogueEnabled,
    syncCatalogues,
} from "./catalogues"
export {
    addCultivation,
    addCultivationToCatalogue,
    getCultivation,
    getCultivationPlan,
    getCultivations,
    getCultivationsForFarm,
    getCultivationsFromCatalogue,
    getCultivationsFromCatalogues,
    getDefaultDatesOfCultivation,
    removeCultivation,
    updateCultivation,
} from "./cultivation"
export type {
    Cultivation,
    CultivationCatalogue,
    CultivationPlan,
} from "./cultivation.types"
export {
    acquiringMethodOptions,
    gwlClassesOptions,
    soilTypesOptions,
} from "./db/schema"
export type {
    invitationTypeInsert,
    invitationTypeSelect,
} from "./db/schema-authz"
export {
    addDerogation,
    isDerogationGrantedForYear,
    listDerogations,
    removeDerogation,
} from "./derogation"
export {
    addFarm,
    cancelInvitationForFarm,
    getFarm,
    getFarms,
    grantRoleToFarm,
    isAllowedToDeleteFarm,
    isAllowedToShareFarm,
    listPendingInvitationsForFarm,
    listPendingInvitationsForUser,
    listPrincipalsForFarm,
    removeFarm,
    revokePrincipalFromFarm,
    updateFarm,
    updateRoleOfInvitationForFarm,
    updateRoleOfPrincipalAtFarm,
} from "./farm"
export type { FdmType } from "./fdm.types"
export { createFdmServer } from "./fdm-server"
export type { FdmServerType } from "./fdm-server.types"
export {
    addFertilizer,
    addFertilizerApplication,
    addFertilizerToCatalogue,
    getFertilizer,
    getFertilizerApplication,
    getFertilizerApplications,
    getFertilizerApplicationsForFarm,
    getFertilizerParametersDescription,
    getFertilizers,
    getFertilizersFromCatalogue,
    getFertilizersFromCatalogues,
    removeFertilizer,
    removeFertilizerApplication,
    updateFertilizerApplication,
    updateFertilizerFromCatalogue,
} from "./fertilizer"
export type {
    Fertilizer,
    FertilizerApplication,
    FertilizerCatalogue,
    FertilizerParameterDescription,
    FertilizerParameterDescriptionItem,
    FertilizerParameters,
} from "./fertilizer.types"
export {
    addField,
    getField,
    getFields,
    listAvailableAcquiringMethods,
    removeField,
    updateField,
} from "./field"
export type { Field } from "./field.types"
export {
    getGrazingIntention,
    getGrazingIntentions,
    removeGrazingIntention,
    setGrazingIntention,
} from "./grazing_intention"
export {
    addHarvest,
    getDefaultsForHarvestParameters,
    getHarvest,
    getHarvestableTypeOfCultivation,
    getHarvests,
    getHarvestsForFarm,
    getParametersForHarvestCat,
    removeHarvest,
    updateHarvest,
} from "./harvest"
export type {
    Harvest,
    Harvestable,
    HarvestableAnalysis,
    HarvestParameters,
    HarvestParametersDefault,
} from "./harvest.types"
export {
    acceptInvitation,
    autoAcceptInvitationsForNewUser,
    createInvitation,
    declineInvitation,
    listPendingInvitationsForPrincipal,
    MAX_INVITATIONS_PENDING_PER_TARGET,
    MAX_INVITATIONS_PER_INVITER_PER_HOUR,
} from "./invitation"
export { runMigration } from "./migrate"
export {
    addOrganicCertification,
    getOrganicCertification,
    isOrganicCertificationValid,
    isValidSkalNumber,
    isValidTracesNumber,
    listOrganicCertifications,
    removeOrganicCertification,
} from "./organic"
export type { OrganicCertification } from "./organic.types"
export { lookupPrincipal } from "./principal"
export {
    addSoilAnalysis,
    getCurrentSoilData,
    getCurrentSoilDataForFarm,
    getSoilAnalyses,
    getSoilAnalysesForFarm,
    getSoilAnalysis,
    getSoilParametersDescription,
    removeSoilAnalysis,
    updateSoilAnalysis,
} from "./soil"
export type {
    CurrentSoilData,
    SoilAnalysis,
    SoilParameterDescription,
    SoilParameters,
} from "./soil.types"
export type { Timeframe } from "./timeframe.d"
export type { AppAmountUnit } from "./unit-conversion"
export { fromKgPerHa, toKgPerHa } from "./unit-conversion"
export { fdmSchema }
