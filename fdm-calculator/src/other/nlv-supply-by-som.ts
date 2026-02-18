import Decimal from "decimal.js"

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
 * Calculates the change in NLV by a change in SOM.
 *
 * This function calculates the change in Nitrogen Supplying Capacity (Stikstof Leverend Vermogen, NLV)
 * resulting from an increase in Soil Organic Matter (SOM) using the MINIP model logic.
 * It estimates the nitrogen mineralization potential for a 30 cm soil layer.
 *
 * @param params The soil texture, CN ratio, and SOM parameters.
 * @returns The change in NLV (in kg N / ha).
 */
export function calculateNlvSupplyBySom({
    a_clay_mi,
    a_cn_fr,
    a_som_loi,
    b_som_potential,
}: NlvSupplyBySomParams): number {
    // Settings (from MINIP model)
    const paramA = new Decimal(20) // Age of organic matter
    const paramB = new Decimal(2).pow(new Decimal(14.1).sub(9).div(9)) // Temperature correction
    const paramCnMicro = new Decimal(10) // CN ratio of micro organisms
    const paramT = new Decimal(5).div(12) // 5 months a year
    const paramDissMicro = new Decimal(2) // Dissimilation : assimilation ratio of micro organisms

    const clayPct = new Decimal(a_clay_mi)
    const cnFr = new Decimal(a_cn_fr)

    /**
     * Internal function to calculate NLV for a given SOM content.
     */
    const calculateNlv = (a_som_loi: number): Decimal => {
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
        const density = pClayFr
            .times(densityClay)
            .add(new Decimal(1).sub(pClayFr).times(densitySand))

        // Step 2: Estimate Soil Organic Carbon (SOC) stock for 30 cm soil (kg / ha)
        // B_C_ST03 = 0.5 * (SOM / 100) * (100 * 100) * 0.3 * density * 1000
        const socStock = new Decimal(0.5)
            .times(som.div(100))
            .times(10000)
            .times(0.3)
            .times(density)
            .times(1000)

        // Step 3: Estimate NLV
        // c.diss = SOC * (1 - exp(4.7 * ((param.a + param.b * param.t)^-0.6 - param.a^-0.6)))
        const exponent = new Decimal(4.7).times(
            paramA.add(paramB.times(paramT)).pow(-0.6).sub(paramA.pow(-0.6)),
        )
        const cDiss = socStock.times(new Decimal(1).sub(exponent.exp()))
        const cAss = cDiss.div(paramDissMicro)

        // nlv = ((c.diss + c.ass) / A_CN_FR) - (c.ass / param.cn.micro)
        return cDiss.add(cAss).div(cnFr).sub(cAss.div(paramCnMicro))
    }

    const nlvStart = calculateNlv(a_som_loi)
    const nlvEnd = calculateNlv(b_som_potential)

    return nlvEnd.sub(nlvStart).toNumber()
}
