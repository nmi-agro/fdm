/**
 * The result object returned by the `getNL{*}DierlijkeMestGebruiksNorm` function,
 * containing the determined animal manure nitrogen usage norm and its source.
 */
export interface DierlijkeMestGebruiksnormResult {
  /**
   * The determined usage standard for nitrogen from animal manure in kg N per hectare.
   */
  normValue: number
  /**
   * A descriptive string indicating which rule or category was applied to determine the norm.
   * Examples: "Standaard", "Derogatie - NV Gebied", "Derogatie - Buiten NV Gebied".
   */
  normSource: string
}

/**
 * Represents the phosphate usage norm values for a specific phosphate class,
 * differentiated by grassland and arable land.
 */
export interface FosfaatNorm {
  grasland: number
  bouwland: number
}

/**
 * The result object returned by the `getNL{*}FosfaatGebruiksNorm` function,
 * containing the determined phosphate usage norm and the corresponding phosphate class.
 */
export interface FosfaatGebruiksnormResult {
  /**
   * The determined phosphate usage standard in kg P2O5 per hectare.
   */
  normValue: number
  /**
   * The cultivation and phosphate class ('Arm', 'Laag', 'Neutraal', 'Ruim', 'Hoog')
   * that was determined from the soil analysis values and used to derive the norm.
   */
  normSource: string
}

/**
 * The result object returned by the `getNL{*}StikstofGebruiksNorm` function,
 * containing the calculated norm value and the name of the cultivation used for the calculation.
 */
export interface GebruiksnormResult {
  /**
   * The determined nitrogen usage standard in kg N per hectare.
   */
  normValue: number
  /**
   * The cultivation name according to RVO's "Tabel 2 Stikstof landbouwgrond"
   * that was used to determine the legal limit.
   */
  normSource: string
}

export type NormFilling = {
  normFilling: number
  applicationFilling: {
    p_app_id: string
    normFilling: number
    normFillingDetails?: string
  }[]
}
