import type * as authZSchema from "./db/schema-authz"

export type FarmVerification = authZSchema.farmVerificationTypeSelect
export type FarmVerificationMethod = "rvo_eherkenning" | "eherkenning_saml"
export type FarmVerificationResult = "verified" | "not_verified"

export interface AddFarmVerificationInput {
  verification_method: FarmVerificationMethod
  verification_result: FarmVerificationResult
  b_businessid_farm: string
}
