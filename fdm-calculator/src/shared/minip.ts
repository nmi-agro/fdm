import Decimal from "decimal.js"

/** Ratio between dissimilated and assimilated carbon by micro-organisms (-). */
const MINIP_DISSIMILATION_ASSIMILATION_RATIO = new Decimal(2)

/** C/N ratio of micro-organisms (-). */
const MINIP_CN_MICRO = new Decimal(10)

/**
 * Parameters for the MINIP model to calculate nitrogen mineralization from soil organic matter.
 */
export interface MinipParams {
  /** The organic carbon stock of the soil layer (kg C / ha) */
  c_stock: Decimal.Value
  /** The carbon to nitrogen ratio of the soil organic matter (-) */
  a_cn_fr: Decimal.Value
  /** The initial (apparent) age of the soil organic matter (years) */
  age: Decimal.Value
  /** The average temperature during the period (°C) */
  temperature: Decimal.Value
  /** The length of the period (years) */
  time: Decimal.Value
}

/**
 * Calculates the temperature correction factor of the MINIP model.
 *
 * @param temperature - The average temperature (°C).
 * @returns The temperature correction factor (-).
 * @throws Throws an error if the temperature is above 27 °C.
 */
export function calculateMinipTemperatureFactor(temperature: Decimal.Value): Decimal {
  const t = new Decimal(temperature)
  if (t.gt(27)) {
    throw new Error("Average yearly temperature is too high")
  }
  if (t.gt(9)) {
    return new Decimal(2).pow(t.minus(9).dividedBy(9))
  }
  if (t.gt(-1)) {
    return t.times(0.1)
  }
  return new Decimal(0)
}

/**
 * Calculates the nitrogen mineralization from soil organic matter with the MINIP model.
 *
 * The decomposition of soil organic carbon over the period follows the model of Janssen:
 * `C_diss = C_stock * (1 - exp(4.7 * ((age + f_T * time)^-0.6 - age^-0.6)))`, where `f_T` is the
 * temperature correction factor. Micro-organisms assimilate half as much carbon as they dissimilate,
 * so the mineralized nitrogen is `(C_diss + C_ass) / CN - C_ass / CN_micro`.
 *
 * @param params - The carbon stock, C/N ratio and model parameters.
 * @returns The nitrogen mineralized over the period (kg N / ha).
 * @throws Throws an error if the temperature is above 27 °C.
 */
export function calculateMinipNitrogenMineralization({
  c_stock,
  a_cn_fr,
  age,
  temperature,
  time,
}: MinipParams): Decimal {
  const ageDecimal = new Decimal(age)
  const temperatureFactor = calculateMinipTemperatureFactor(temperature)

  // Fraction of the organic carbon that is decomposed during the period
  const exponent = new Decimal(4.7).times(
    ageDecimal.add(temperatureFactor.times(time)).pow(-0.6).minus(ageDecimal.pow(-0.6)),
  )
  const cDiss = new Decimal(c_stock).times(new Decimal(1).minus(exponent.exp()))
  const cAss = cDiss.dividedBy(MINIP_DISSIMILATION_ASSIMILATION_RATIO)

  return cDiss.add(cAss).dividedBy(a_cn_fr).minus(cAss.dividedBy(MINIP_CN_MICRO))
}
