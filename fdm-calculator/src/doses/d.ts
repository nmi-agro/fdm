/**
 * Represents the nutrient doses in kilograms per hectare (kg/ha).
 *
 * @property p_app_id - The unique identifier for the fertilizer application.
 * @property p_dose_n - The dose of nitrogen (N) in kg/ha.
 * @property p_dose_nw - The dose of workable nitrogen (N) in kg/ha, adjusted by the nitrogen workability coefficient (p_n_wc).
 * @property p_dose_p - The dose of phosphate (P2O5) in kg/ha.
 * @property p_dose_k - The dose of potassium (K2O) in kg/ha.
 * @property p_dose_eoc - The dose of effective organic carbon (EOC) in kg/ha.
 * @property p_dose_s - The dose of sulfur (SO3) in kg/ha.
 * @property p_dose_mg - The dose of magnesium (MgO) in kg/ha.
 * @property p_dose_ca - The dose of calcium (CaO) in kg/ha.
 * @property p_dose_na - The dose of sodium (Na2O) in kg/ha.
 * @property p_dose_cu - The dose of copper (Cu) in kg/ha.
 * @property p_dose_zn - The dose of zinc (Zn) in kg/ha.
 * @property p_dose_co - The dose of cobalt (Co) in kg/ha.
 * @property p_dose_mn - The dose of manganese (Mn) in kg/ha.
 * @property p_dose_mo - The dose of molybdenum (Mo) in kg/ha.
 * @property p_dose_b - The dose of boron (B) in kg/ha.
 */
export interface DoseProperties {
  p_app_id?: string
  p_dose_n: number
  p_dose_nw: number
  p_dose_p: number
  p_dose_k: number
  p_dose_eoc: number
  p_dose_s: number
  p_dose_mg: number
  p_dose_ca: number
  p_dose_na: number
  p_dose_cu: number
  p_dose_zn: number
  p_dose_co: number
  p_dose_mn: number
  p_dose_mo: number
  p_dose_b: number
}

export interface Dose extends DoseProperties {
  [key: string]: string | number | undefined
}

export type NumericDoseKeys = Exclude<keyof DoseProperties, "p_app_id">
