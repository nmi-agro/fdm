import Decimal from "decimal.js"
import { calculateMinipNitrogenMineralization } from "../shared/minip"

/**
 * Parameters for calculating the Nitrogen Supplying Capacity (Stikstof Leverend Vermogen, NLV / d_n_supply_base) of a soil.
 */
export interface NlvParams {
  /** The clay content of the soil (%) */
  a_clay_mi: number
  /** The carbon to nitrogen ratio of the soil organic matter */
  a_cn_fr: number
  /** The organic matter content of the soil (%) */
  a_som_loi: number
}

/**
 * Parameters for calculating the change in Nitrogen Supplying Capacity (Stikstof Leverend Vermogen, NLV) based on change in Soil Organic Matter (SOM).
 */
export interface NlvSupplyBySomParams {
  /** The clay content of the soil (%) */
  a_clay_mi: number
  /** The carbon to nitrogen ratio of the soil organic matter */
  a_cn_fr: number
  /** The current organic matter content of the soil (%) */
  a_som_loi: number
  /** The maximum achievable organic matter content of the soil (%) */
  b_som_potential: number
}

/**
 * Calculates the Nitrogen Supplying Capacity (Stikstof Leverend Vermogen, NLV / d_n_supply_base) for a soil sample or field.
 *
 * This function calculates the base Nitrogen Supplying Capacity using the MINIP model logic.
 * It estimates the nitrogen mineralization potential for a 30 cm soil layer based on clay content,
 * C-to-N ratio, and soil organic matter.
 *
 * @param params The soil texture, CN ratio, and SOM parameters.
 * @returns The absolute NLV (in kg N / ha / year).
 */
export function calculateNlv({ a_clay_mi, a_cn_fr, a_som_loi }: NlvParams): number {
  const clayPct = new Decimal(a_clay_mi)
  const cnFr = new Decimal(a_cn_fr)
  const som = new Decimal(a_som_loi)

  // Step 1: Estimate density (g/cm3)
  const densitySand = new Decimal(1).div(som.times(0.02525).add(0.6541))

  const densityClay = new Decimal(0.00000067)
    .times(som.pow(4))
    .sub(new Decimal(0.00007792).times(som.pow(3)))
    .add(new Decimal(0.00314712).times(som.pow(2)))
    .sub(new Decimal(0.06039523).times(som))
    .add(1.33932206)

  const pClayFr = Decimal.min(1, clayPct.div(25))
  const density = pClayFr.times(densityClay).add(new Decimal(1).sub(pClayFr).times(densitySand))

  // Step 2: Estimate Soil Organic Carbon (SOC) stock for 30 cm soil (kg / ha)
  // B_C_ST03 = 0.5 * (SOM / 100) * (100 * 100) * 0.3 * density * 1000
  const socStock = new Decimal(0.5)
    .times(som.div(100))
    .times(10000)
    .times(0.3)
    .times(density)
    .times(1000)

  // Step 3: Estimate NLV with MINIP for the growing season of 5 months at 14.1 °C, for organic
  // matter with an age of 20 years
  return calculateMinipNitrogenMineralization({
    c_stock: socStock,
    a_cn_fr: cnFr,
    age: 20,
    temperature: 14.1,
    time: new Decimal(5).div(12),
  }).toNumber()
}

/**
 * Calculates the change in NLV by a change in SOM.
 *
 * This function calculates the change in Nitrogen Supplying Capacity (Stikstof Leverend Vermogen, NLV)
 * resulting from an increase in Soil Organic Matter (SOM) using the MINIP model logic.
 * It estimates the nitrogen mineralization potential for a 30 cm soil layer and assumes that the C-to-N ratio remains constant with increasing SOM.
 *
 * @param params The soil texture, CN ratio, and SOM parameters.
 * @returns The change in NLV (in kg N / ha).
 */
export function calculateNlvSupplyIncreaseBySomPotential({
  a_clay_mi,
  a_cn_fr,
  a_som_loi,
  b_som_potential,
}: NlvSupplyBySomParams): number {
  const nlvStart = new Decimal(calculateNlv({ a_clay_mi, a_cn_fr, a_som_loi }))
  const nlvEnd = new Decimal(calculateNlv({ a_clay_mi, a_cn_fr, a_som_loi: b_som_potential }))

  return nlvEnd.sub(nlvStart).toNumber()
}
