import { z } from "zod"

/*
 * Shared, described field schemas.
 *
 * Every field that appears in more than one request or response schema is defined here once, so
 * its OpenAPI description (meaning, unit and value range) stays the same everywhere it is used.
 * Units follow the FDM parameter conventions; ranges are the typical valid range of the parameter.
 */

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

/** Identifier of a farm. */
export const FarmIdSchema = z.string().describe("Unique identifier of the farm.")
/** Identifier of a field. */
export const FieldIdSchema = z.string().describe("Unique identifier of the field.")
/** Identifier of a cultivation. */
export const CultivationIdSchema = z
  .string()
  .describe("Unique identifier of the cultivation on a field.")
/** Identifier of a harvest event. */
export const HarvestIdSchema = z.string().describe("Unique identifier of the harvest event.")
/** Identifier of a fertilizer (product) available on a farm. */
export const FertilizerIdSchema = z
  .string()
  .describe("Unique identifier of the fertilizer product on the farm.")
/** Identifier of a fertilizer application. */
export const FertilizerApplicationIdSchema = z
  .string()
  .describe("Unique identifier of the fertilizer application.")
/** Identifier of a measure applied on a field. */
export const MeasureIdSchema = z
  .string()
  .describe("Unique identifier of the measure as applied on a field.")
/** Identifier of an organic certification. */
export const OrganicCertificationIdSchema = z
  .string()
  .describe("Unique identifier of the organic certification.")
/** Identifier of a derogation. */
export const DerogationIdSchema = z.string().describe("Unique identifier of the derogation.")
/** Identifier of a soil analysis. */
export const SoilAnalysisIdSchema = z.string().describe("Unique identifier of the soil analysis.")
/** Identifier of a farm group. */
export const FarmGroupIdSchema = z.string().describe("Unique identifier of the farm group.")
/** Identifier of an organization. */
export const OrganizationIdSchema = z.string().describe("Unique identifier of the organization.")

// ---------------------------------------------------------------------------
// Soil analysis parameters
// ---------------------------------------------------------------------------

/**
 * Soil analysis parameters with their unit and typical range. Each key is the parameter code.
 */
export const soilParameterDescriptions = {
  a_al_ox: "Aluminium extractable with oxalate (mmol Al/kg). Typical range 0.1–1000.",
  a_c_of: "Organic carbon content (g C/kg). Typical range 0.1–600.",
  a_ca_co:
    "Exchangeable calcium, extracted with cobalt hexamine (mmol+/kg). Typical range 0.1–500.",
  a_ca_co_po: "Calcium occupation of the cation exchange capacity (%). Typical range 1–100.",
  a_caco3_if: "Carbonated lime content (%). Typical range 0.1–50.",
  a_cec_co: "Cation exchange capacity (mmol+/kg). Typical range 1–1000.",
  a_clay_mi: "Clay content (%). Typical range 0.1–75.",
  a_cn_fr: "Carbon to nitrogen ratio (ratio, unitless). Typical range 5–40.",
  a_com_fr: "Carbon fraction of the organic matter (fraction, 0–1). Typical range 0.3–0.8.",
  a_cu_cc: "Plant-available copper (µg Cu/kg). Typical range 0.1–50000.",
  a_density_sa: "Dry bulk density (g/cm³). Typical range 0.5–3.",
  a_fe_ox: "Iron extractable with oxalate (mmol Fe/kg). Typical range 0.1–1000.",
  a_k_cc: "Plant-available potassium (mg K/kg). Typical range 1–600.",
  a_k_co:
    "Exchangeable potassium, extracted with cobalt hexamine (mmol+/kg). Typical range 0.1–150.",
  a_k_co_po: "Potassium occupation of the cation exchange capacity (%). Typical range 0.1–50.",
  a_mg_cc: "Plant-available magnesium (mg Mg/kg). Typical range 1–1100.",
  a_mg_co:
    "Exchangeable magnesium, extracted with cobalt hexamine (mmol+/kg). Typical range 0.1–150.",
  a_mg_co_po: "Magnesium occupation of the cation exchange capacity (%). Typical range 0.1–50.",
  a_n_pmn:
    "Microbial activity as potentially mineralizable nitrogen (mg N/kg). Typical range 1–500.",
  a_n_rt: "Total nitrogen content (mg N/kg). Typical range 1–30000.",
  a_nh4_cc:
    "Plant-available ammonium-N, determined with a 0.01 M CaCl2 extraction (mg N/l). Typical range 0–100.",
  a_nmin_cc:
    "Plant-available mineral nitrogen in the sampled layer (kg N/ha). Typical range 0–500.",
  a_no3_cc:
    "Plant-available nitrate-N, determined with a 0.01 M CaCl2 extraction (mg N/l). Typical range 0–100.",
  a_p_al: "Phosphate extractable with ammonium lactate, P-AL (mg P2O5/100 g). Typical range 1–250.",
  a_p_cc: "Plant-available phosphorus, extracted with CaCl2 (mg P/kg). Typical range 0.1–100.",
  a_p_ox: "Phosphorus extractable with oxalate (mmol P/kg). Typical range 0.1–100.",
  a_p_rt: "Total phosphorus content (g P/kg). Typical range 0.01–10.",
  a_p_sg: "Phosphate saturation degree (%). Typical range 0.1–100.",
  a_p_wa: "Phosphate in water extraction, Pw (mg P2O5/l). Typical range 1–250.",
  a_ph_cc: "Acidity (pH) measured in CaCl2 (unitless). Typical range 3–10.",
  a_s_rt: "Total sulfur content (mg S/kg). Typical range 1–10000.",
  a_sand_mi: "Sand content (%). Typical range 0.1–100.",
  a_silt_mi: "Silt content (%). Typical range 0.1–100.",
  a_som_loi:
    "Soil organic matter content, determined by loss on ignition (%). Typical range 0.5–75.",
  a_zn_cc: "Plant-available zinc (µg Zn/kg). Typical range 5–50000.",
  b_gwl_class: "Groundwater class (Dutch 'grondwatertrap'), for example 'II' or 'VIII'.",
  b_soiltype_agr: "Agricultural soil type, for example 'dekzand', 'zeeklei' or 'veen'.",
} as const

type SoilParameterCode = keyof typeof soilParameterDescriptions
type CategoricalSoilParameterCode = "b_gwl_class" | "b_soiltype_agr"
type NumericSoilParameterCode = Exclude<SoilParameterCode, CategoricalSoilParameterCode>

/** Soil parameters that hold a category instead of a number. */
const categoricalSoilParameters = new Set<SoilParameterCode>(["b_gwl_class", "b_soiltype_agr"])

/** Soil parameter fields that are nullable, as returned in responses. */
type NullableSoilParameterShape = {
  [K in NumericSoilParameterCode]: z.ZodNullable<z.ZodNumber>
} & { [K in CategoricalSoilParameterCode]: z.ZodNullable<z.ZodString> }

/** Soil parameter fields that are nullable and may be omitted, as accepted in requests. */
type OptionalSoilParameterShape = {
  [K in NumericSoilParameterCode]: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
} & { [K in CategoricalSoilParameterCode]: z.ZodOptional<z.ZodNullable<z.ZodString>> }

/**
 * Builds an object shape with one described schema per soil parameter.
 *
 * @param mode - `"nullable"` for response fields, `"optional"` for request fields that are
 *   nullable and may be omitted.
 * @returns A Zod shape keyed by soil parameter code.
 */
export function soilParameterShape(mode: "nullable"): NullableSoilParameterShape
export function soilParameterShape(mode: "optional"): OptionalSoilParameterShape
export function soilParameterShape(
  mode: "nullable" | "optional",
): NullableSoilParameterShape | OptionalSoilParameterShape {
  return Object.fromEntries(
    Object.entries(soilParameterDescriptions).map(([code, description]) => {
      const base = categoricalSoilParameters.has(code as SoilParameterCode)
        ? z.string().nullable()
        : z.number().nullable()
      return [code, (mode === "optional" ? base.optional() : base).describe(description)]
    }),
  ) as NullableSoilParameterShape | OptionalSoilParameterShape
}

// ---------------------------------------------------------------------------
// Harvest analysis
// ---------------------------------------------------------------------------

/** Harvest analysis parameters with their unit and typical range. */
export const harvestAnalysisDescriptions = {
  b_lu_yield: "Dry matter yield of the harvested product (kg DM/ha). Typical range 0–150000.",
  b_lu_yield_fresh: "Fresh matter yield of the harvested product (kg/ha). Typical range 0–150000.",
  b_lu_yield_bruto:
    "Gross fresh yield of the harvested product, including tare such as soil and stones (kg/ha).",
  b_lu_tarra: "Tare: share of the gross yield that is not product, such as soil and stones (%).",
  b_lu_dm: "Dry matter content of the harvested product (g DM/kg fresh). Range 0–1000.",
  b_lu_moist: "Moisture content of the harvested product (%).",
  b_lu_uww: "Underwater weight of potatoes (g/5 kg), a measure of their dry matter content.",
  b_lu_cp: "Crude protein content of the harvested product (g/kg DM). Typical range 0–500.",
  b_lu_n_harvestable: "Nitrogen content of the harvested product (g N/kg DM). Typical range 4–100.",
  b_lu_n_residue: "Nitrogen content of the crop residue (g N/kg DM). Typical range 3.5–100.",
  b_lu_p_harvestable:
    "Phosphate content of the harvested product (g P2O5/kg DM). Typical range 2.5–100.",
  b_lu_p_residue: "Phosphate content of the crop residue (g P2O5/kg DM). Typical range 1.9–100.",
  b_lu_k_harvestable:
    "Potassium content of the harvested product (g K2O/kg DM). Typical range 5–115.",
  b_lu_k_residue: "Potassium content of the crop residue (g K2O/kg DM). Typical range 4–170.",
} as const

type HarvestAnalysisCode = keyof typeof harvestAnalysisDescriptions

/**
 * Builds an object shape with one described numeric schema per harvest analysis parameter.
 *
 * @param modifier - Applied to every field, e.g. to make it nullable or optional.
 * @returns A Zod shape keyed by harvest analysis parameter code.
 */
export function harvestAnalysisShape<T extends z.ZodTypeAny>(
  modifier: (schema: z.ZodNumber) => T,
): Record<HarvestAnalysisCode, T> {
  return Object.fromEntries(
    Object.entries(harvestAnalysisDescriptions).map(([code, description]) => [
      code,
      modifier(z.number()).describe(description),
    ]),
  ) as Record<HarvestAnalysisCode, T>
}

// ---------------------------------------------------------------------------
// Fertilizer composition
// ---------------------------------------------------------------------------

/** Fertilizer composition parameters used in the nitrogen and organic matter balances. */
export const fertilizerCompositionDescriptions = {
  p_a: "Apparent initial age of the organic matter in the product (years, unitless).",
  p_hc: "Humification coefficient: fraction of the organic matter that remains after one year (0–1).",
  p_c_rt: "Total carbon content of the product (g C/kg). Range 0–1000.",
  p_c_of: "Organic carbon content of the product (g C/kg). Range 0–1000.",
  p_c_if: "Inorganic carbon content of the product (g C/kg). Range 0–1000.",
  p_c_fr: "Fraction of carbon in the organic matter of the product (0–1).",
  p_cn_of: "Ratio between organic carbon and organic nitrogen of the product (unitless).",
  p_n_if: "Inorganic nitrogen content of the product (g N/kg). Range 0–1000.",
  p_n_of: "Organic nitrogen content of the product (g N/kg). Range 0–1000.",
  p_ne: "Neutralising value of the product (g CaO/kg). Typical range -10–10.",
  p_ef_nh3:
    "Ammonia emission factor: fraction of the applied nitrogen that volatilises as ammonia (0–1). `null` when the default for the product type is used.",
} as const

type FertilizerCompositionCode = keyof typeof fertilizerCompositionDescriptions

/**
 * Builds an object shape with one described, nullable numeric schema per fertilizer
 * composition parameter.
 *
 * @returns A Zod shape keyed by fertilizer composition parameter code. `null` means unknown.
 */
export function fertilizerCompositionShape(): Record<
  FertilizerCompositionCode,
  z.ZodNullable<z.ZodNumber>
> {
  return Object.fromEntries(
    Object.entries(fertilizerCompositionDescriptions).map(([code, description]) => [
      code,
      z.number().nullable().describe(description),
    ]),
  ) as Record<FertilizerCompositionCode, z.ZodNullable<z.ZodNumber>>
}

/** Applied amount of a fertilizer, always expressed in kg per hectare. */
export const FertilizerAppAmountSchema = z
  .number()
  .describe("Applied amount of the product (kg/ha).")

// ---------------------------------------------------------------------------
// Cultivation
// ---------------------------------------------------------------------------

/** Code of a cultivation in the HCAT3 crop taxonomy. */
export const CultivationHcat3Schema = z
  .string()
  .nullable()
  .describe(
    "Cultivation code according to the Hierarchical Crop and Agriculture Taxonomy version 3 (HCAT3). `null` when not mapped.",
  )
/** Name of a cultivation in the HCAT3 crop taxonomy. */
export const CultivationHcat3NameSchema = z
  .string()
  .nullable()
  .describe(
    "Cultivation name according to the Hierarchical Crop and Agriculture Taxonomy version 3 (HCAT3). `null` when not mapped.",
  )
