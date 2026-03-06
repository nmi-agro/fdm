import Decimal from "decimal.js"

/**
 * Parameters for calculating the change in water storage based on change in Soil Organic Matter (SOM).
 */
export interface WaterSupplyBySomParams {
    /** The clay content of the soil (%) */
    a_clay_mi: number
    /** The sand content of the soil (%) */
    a_sand_mi: number
    /** The silt content of the soil (%) */
    a_silt_mi: number
    /** The current organic matter content of the soil (%) */
    a_som_loi: number
    /** The maximum achievable organic matter content of the soil (%) */
    b_som_potential: number
}

/**
 * Calculates the change in water holding capacity for a topsoil based on change in SOM.
 *
 * This function uses the continuous pedotransfer functions (PTFs) of Wösten et al. (1999)
 * to estimate the increase in water storage (in mm) for a 30 cm depth layer given a change
 * from an initial SOM content to a maximum achievable SOM content.
 *
 * References:
 * Wösten et al. (2001) Pedotransfer functions: bridging the gap between available basic soil data
 * and missing hydraulic characteristics. Journal of Hydrology 251, p123.
 *
 * @param params The soil texture and SOM parameters.
 * @returns The change in water supply in mm for a 30 cm depth layer.
 */
export function calculateWaterSupplyBySom({
    a_clay_mi,
    a_sand_mi,
    a_silt_mi,
    a_som_loi,
    b_som_potential,
}: WaterSupplyBySomParams): number {
    const mineral = a_clay_mi + a_sand_mi + a_silt_mi
    if (mineral === 0) {
        return 0
    }

    // Express soil texture as fraction of total mineral part
    const normalizedClay = (a_clay_mi * 100) / mineral
    const normalizedSilt = (a_silt_mi * 100) / mineral

    /**
     * Internal function to calculate water holding capacity (WHC) for a given SOM content.
     */
    const calculateWhc = (
        a_som_loi: number,
        a_clay_mi: number,
        a_silt_mi: number,
    ): Decimal => {
        const som = new Decimal(Math.max(a_som_loi, 1e-6))
        const clayPct = new Decimal(Math.max(a_clay_mi, 1e-6))
        const siltPct = new Decimal(Math.max(a_silt_mi, 1e-6))

        // Estimate density based on SOM and clay content
        // Dichtheid_zand = 1 / (0.02525 * SOM + 0.6541)
        const densitySand = new Decimal(1).div(som.times(0.02525).add(0.6541))

        // Dichtheid_klei based on a 4th order polynomial of SOM
        const densityClay = new Decimal(0.00000067)
            .times(som.pow(4))
            .sub(new Decimal(0.00007792).times(som.pow(3)))
            .add(new Decimal(0.00314712).times(som.pow(2)))
            .sub(new Decimal(0.06039523).times(som))
            .add(1.33932206)

        // Pklei_fr = min(1, A_CLAY_MI / 25)
        const pClayFr = Decimal.min(1, clayPct.div(25))

        // Density is a weighted average of sand and clay density components
        const density = pClayFr
            .times(densityClay)
            .add(new Decimal(1).sub(pClayFr).times(densitySand))

        // Saturated water content (thetaS) using Wösten 1999 PTF
        // Note: '1' is used as a flag for topsoil in the original formula
        const thetaS = new Decimal(0.7919)
            .add(clayPct.times(0.001691))
            .sub(density.times(0.29619))
            .sub(siltPct.pow(2).times(0.000001491))
            .add(som.pow(2).times(0.0000821))
            .add(new Decimal(0.02427).div(clayPct))
            .add(new Decimal(0.01113).div(siltPct))
            .add(siltPct.ln().times(0.01472))
            .sub(som.times(clayPct).times(0.0000733))
            .sub(density.times(clayPct).times(0.000619))
            .sub(density.times(som).times(0.001183))
            .sub(siltPct.times(0.0001664).times(1)) // * 1 for topsoil

        // Van Genuchten alpha parameter (alfa)
        const alpha = new Decimal(-14.96)
            .add(clayPct.times(0.03135))
            .add(siltPct.times(0.0351))
            .add(som.times(0.646))
            .add(density.times(15.29))
            .sub(new Decimal(0.192).times(1)) // * 1 for topsoil
            .sub(density.pow(2).times(4.671))
            .sub(clayPct.pow(2).times(0.000781))
            .sub(som.pow(2).times(0.00687))
            .add(new Decimal(0.0449).div(som))
            .add(siltPct.ln().times(0.0663))
            .add(som.ln().times(0.1482))
            .sub(density.times(siltPct).times(0.04546))
            .sub(density.times(som).times(0.4852))
            .add(clayPct.times(0.00673).times(1)) // * 1 for topsoil
            .exp()

        // Van Genuchten n parameter
        const n = new Decimal(1).add(
            new Decimal(-25.23)
                .sub(clayPct.times(0.02195))
                .add(siltPct.times(0.0074))
                .sub(som.times(0.194))
                .add(density.times(45.5))
                .sub(density.pow(2).times(7.24))
                .add(clayPct.pow(2).times(0.0003658))
                .add(som.pow(2).times(0.002885))
                .sub(new Decimal(12.81).div(density))
                .sub(new Decimal(0.1524).div(siltPct))
                .sub(new Decimal(0.01958).div(som))
                .sub(siltPct.ln().times(0.2876))
                .sub(som.ln().times(0.0709))
                .sub(density.ln().times(44.6))
                .sub(density.times(clayPct).times(0.02264))
                .add(density.times(som).times(0.0896))
                .add(clayPct.times(0.00718).times(1)) // * 1 for topsoil
                .exp(),
        )

        // Water content at pF 0 (h = -1 cm)
        // whc = 0.01 + (thetaS - 0.01) / (1 + (alpha * |h|)^n)^(1 - 1/n)
        // where |h| = 10^0 = 1
        const m = new Decimal(1).sub(new Decimal(1).div(n))
        const whc = new Decimal(0.01).add(
            thetaS.sub(0.01).div(new Decimal(1).add(alpha.pow(n)).pow(m)),
        )

        // Convert from m3/m3 to mm for a 30 cm (300 mm) depth layer
        return whc.times(300)
    }

    const whcStart = calculateWhc(a_som_loi, normalizedClay, normalizedSilt)
    const whcMax = calculateWhc(b_som_potential, normalizedClay, normalizedSilt)

    return whcMax.sub(whcStart).toNumber()
}
