/**
 * A library to interact with the Farm Data Model using PostgreSQL as backend
 *
 * @remarks
 * The `fdm` defines the {@link createFdmServer} and {@link FdmServerType} to store, retrieve and update the Farm Data Model
 *
 * Created by Nutriënten Management Instituut (www.nmi-agro.nl)
 * Source code available at https://github.com/nmi-agro/fdm
 * In case you find a bug, please report at https://github.com/nmi-agro/fdm/issues
 *
 * @public
 * @packageDocumentation
 */

/** {@inheritDoc createFdmServer} */
import type { MultiPolygon, Polygon } from "geojson"
import * as fdmSchema from "./db/schema"

export type { FdmAuth } from "./authentication"
// export { createFdmLocal } from './fdm-local'
export { createDisplayUsername, createFdmAuth, updateUserProfile } from "./authentication"
export { checkPermission, withAuditContext, writeAuditEntry } from "./authorization"
export type { AuditContext, PrincipalId } from "./authorization.types"
export {
  getCachedCalculation,
  setCachedCalculation,
  setCalculationError,
  withCalculationCache,
} from "./calculator"
export {
  disableCultivationCatalogue,
  disableFertilizerCatalogue,
  disableMeasureCatalogue,
  enableCultivationCatalogue,
  enableFertilizerCatalogue,
  enableMeasureCatalogue,
  getEnabledCultivationCatalogues,
  getEnabledCultivationCataloguesForFarms,
  getEnabledFertilizerCatalogues,
  getEnabledFertilizerCataloguesForFarms,
  getEnabledMeasureCatalogues,
  isCultivationCatalogueEnabled,
  isFertilizerCatalogueEnabled,
  isMeasureCatalogueEnabled,
  syncCatalogues,
  syncMeasuresCatalogueArray,
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
export type { Cultivation, CultivationCatalogue, CultivationPlan } from "./cultivation.types"
export {
  acquiringMethodOptions,
  herdCategoryOptions,
  animalSexOptions,
  animalSpeciesOptions,
  annotationTypeOptions,
  arrivingMethodOptions,
  bcsIndicatorOptions,
  feedOriginOptions,
  feedTypeOptions,
  grazingTypeOptions,
  gwlClassesOptions,
  leavingMethodOptions,
  soilTypesOptions,
  visualImageTypeOptions,
} from "./db/schema"
export { rateLimit } from "./db/schema-authn"
export type { invitationTypeInsert, invitationTypeSelect } from "./db/schema-authz"
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
  BaseFertilizerApplication,
  Fertilizer,
  FertilizerApplication,
  FertilizerCatalogue,
  FertilizerParameterDescription,
  FertilizerParameterDescriptionItem,
  FertilizerParameters,
  FertilizerType,
} from "./fertilizer.types"
export type { AppAmountUnit } from "./fertilizer-application-unit-conversion"
export { fromKgPerHa, toKgPerHa } from "./fertilizer-application-unit-conversion"
export {
  addField,
  determineIfFieldIsBuffer,
  getField,
  getFields,
  listAvailableAcquiringMethods,
  removeField,
  updateField,
} from "./field"
export type { Field } from "./field.types"
export type FieldGeometry = Polygon | MultiPolygon
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
export {
  addMeasure,
  getMeasure,
  getMeasures,
  getMeasuresForFarm,
  getMeasuresFromCatalogue,
  removeMeasure,
  updateMeasure,
} from "./measure"
export type { Measure, MeasureCatalogue } from "./measure.types"
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
export { getPrincipal, getPrincipals, lookupPrincipal } from "./principal"
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
export {
  addSoilImage,
  addSoilImageAnnotation,
  getSoilImages,
  removeSoilImage,
  removeSoilImageAnnotation,
  updateSoilImageAnnotation,
} from "./soil-image"
export type {
  AddSoilImageAnnotationInput,
  AddSoilImageInput,
  SoilImage,
  SoilImageAnnotation,
  UpdateSoilImageAnnotationInput,
} from "./soil-image.types"
export type { Timeframe } from "./timeframe"
export { addHerd, getHerd, getHerdsForFarm, removeHerd, updateHerd } from "./herd"
export type { Herd } from "./herd.types"
export {
  addAnimal,
  addAnimalsToHerd,
  assignAnimalToHerd,
  createHerdWithAnimals,
  getAnimal,
  getAnimalsForFarm,
  getAnimalsForHerd,
  getCensusForFarm,
  removeAnimal,
  removeAnimalAssigning,
  removeAnimals,
  updateAnimal,
  updateAnimalAssigning,
} from "./animal"
export type { Animal, HerdCensus } from "./animal.types"
export {
  addBarn,
  addHousing,
  getBarn,
  getBarnsForFarm,
  getHousingForHerd,
  removeBarn,
  updateBarn,
} from "./barn"
export type { Barn, Housing } from "./barn.types"
export {
  addMilkDelivery,
  addMilkingAnimal,
  addMilkingHerd,
  addMilkTank,
  getMilkDelivery,
  getMilkDeliveriesForFarm,
  getMilkingAnimal,
  getMilkingHerd,
  getMilkProductionForHerd,
  getMilkTank,
  getMilkTanksForFarm,
  removeMilkDelivery,
  removeMilkingAnimal,
  removeMilkingHerd,
  removeMilkTank,
  updateMilkDelivery,
  updateMilkingAnimal,
  updateMilkingHerd,
  updateMilkTank,
} from "./milk"
export type { MilkDelivery, Milking, MilkingAnimal, MilkTank } from "./milk.types"
export { addFeedBatch, addFeedingAnimal, addFeedingHerd, getFeedBatchesForFarm } from "./feed"
export type { FeedBatch, Feeding, FeedingAnimal } from "./feed.types"
export {
  addExcreting,
  addManureDisposing,
  addManurePit,
  getExcreting,
  getManureDisposalsForFarm,
  getManureDisposing,
  getManurePit,
  getManurePitsForFarm,
  removeExcreting,
  removeManureDisposing,
  removeManurePit,
  updateExcreting,
  updateManureDisposing,
  updateManurePit,
} from "./manure"
export type { Excreting, ManureDelivery, ManurePit } from "./manure.types"
export {
  addGrazing,
  getGrazing,
  getGrazingForFarm,
  getGrazingForField,
  getGrazingForHerd,
  removeGrazing,
  updateGrazing,
} from "./grazing"
export type { Grazing } from "./grazing.types"
export { fdmSchema }
