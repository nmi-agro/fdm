import type { fdmSchema } from "@nmi-agro/fdm-core"
import { Decimal } from "decimal.js"

/**
 * Calculates the organic carbon content of soil based on the loss on ignition (LOI) value,
 * which represents the percentage of organic matter in the soil.
 *
 * The calculation applies a standard conversion factor to estimate the organic carbon content
 * from the organic matter content. The result is clamped within a reasonable range for soil
 * organic carbon content (0.1 to 600 g C / kg soil) to ensure realistic values.
 * @param a_som_loi - The soil organic matter content as a percentage (%).
 */
export function calculateOrganicCarbon(
    a_som_loi: fdmSchema.soilAnalysisTypeSelect["a_som_loi"],
): fdmSchema.soilAnalysisTypeSelect["a_c_of"] {
    if (a_som_loi === null || a_som_loi === undefined) {
        return null
    }

    let a_c_of = new Decimal(a_som_loi).times(0.5).times(10)

    if (a_c_of.gt(new Decimal(600))) {
        a_c_of = new Decimal(600)
    }
    if (a_c_of.lt(new Decimal(0.1))) {
        a_c_of = new Decimal(0.1)
    }

    return a_c_of.toNumber()
}

/**
 * Calculates the organic matter content of soil based on its organic carbon content.
 *
 * This function converts organic carbon content to organic matter content using a conversion
 * factor. The result is constrained within a plausible range for soil organic matter content
 * (0.5 to 75 %) to maintain accuracy.
 * @param a_c_of - The organic carbon content of the soil (g C / kg soil).
 */
export function calculateOrganicMatter(
    a_c_of: fdmSchema.soilAnalysisTypeSelect["a_c_of"],
): fdmSchema.soilAnalysisTypeSelect["a_som_loi"] {
    if (a_c_of === null || a_c_of === undefined) {
        return null
    }

    let a_som_loi = new Decimal(a_c_of).dividedBy(10).dividedBy(0.5)

    if (a_som_loi.gt(new Decimal(75))) {
        a_som_loi = new Decimal(75)
    }
    if (a_som_loi.lt(new Decimal(0.5))) {
        a_som_loi = new Decimal(0.5)
    }

    return a_som_loi.toNumber()
}

/**
 * Calculates the carbon-nitrogen ratio (C/N ratio) of soil based on its organic carbon content
 * and total nitrogen content.
 *
 * The C/N ratio is an important indicator of soil health and decomposition rates. It is
 * calculated by dividing the organic carbon content by the total nitrogen content. The result
 * is clamped within a typical range for agricultural soils (5 to 40) to ensure realistic values.
 * @param a_c_of - The organic carbon content of the soil (g C / kg soil).
 * @param a_n_rt - The total nitrogen content of the soil (mg N / kg soil).
 */
export function calculateCarbonNitrogenRatio(
    a_c_of: fdmSchema.soilAnalysisTypeSelect["a_c_of"],
    a_n_rt: fdmSchema.soilAnalysisTypeSelect["a_n_rt"],
): fdmSchema.soilAnalysisTypeSelect["a_cn_fr"] {
    if (a_c_of === null || a_c_of === undefined || !a_n_rt) {
        return null
    }

    let a_cn_fr = new Decimal(a_c_of).dividedBy(
        new Decimal(a_n_rt).dividedBy(1000),
    )

    if (a_cn_fr.gt(new Decimal(40))) {
        a_cn_fr = new Decimal(40)
    }
    if (a_cn_fr.lt(new Decimal(5))) {
        a_cn_fr = new Decimal(5)
    }

    return a_cn_fr.toNumber()
}

/**
 * Calculates the bulk density of soil based on its organic matter content and soil type.
 *
 * Bulk density is a measure of soil mass per unit volume and is influenced by both the
 * mineral and organic components of the soil. The calculation uses different formulas
 * depending on whether the soil is sandy (including loess) or not, reflecting the different
 * structural properties of these soil types. The result is clamped within a plausible range
 * for agricultural soils (0.5 to 3 kg / m³) to maintain accuracy.
 * @param a_som_loi - The soil organic matter content as a percentage (%).
 * @param b_soiltype_agr - The agricultural soil type classification.
 */
export function calculateBulkDensity(
    a_som_loi: fdmSchema.soilAnalysisTypeSelect["a_som_loi"],
    b_soiltype_agr: fdmSchema.soilAnalysisTypeSelect["b_soiltype_agr"],
): fdmSchema.soilAnalysisTypeSelect["a_density_sa"] {
    if (a_som_loi === null || a_som_loi === undefined || !b_soiltype_agr) {
        return null
    }

    let a_density_sa = new Decimal(0)
    if (["dekzand", "dalgrond", "duinzand", "loess"].includes(b_soiltype_agr)) {
        a_density_sa = new Decimal(1).dividedBy(
            new Decimal(a_som_loi).times(0.02525).plus(0.6541),
        )
    } else {
        const a = new Decimal(a_som_loi).pow(4).times(0.00000067)
        const b = new Decimal(a_som_loi).pow(3).times(0.00007792)
        const c = new Decimal(a_som_loi).pow(2).times(0.00314712)
        const d = new Decimal(a_som_loi).times(0.06039523)
        a_density_sa = a.minus(b).add(c).minus(d).add(1.33932206)
    }

    if (a_density_sa.gt(new Decimal(3))) {
        a_density_sa = new Decimal(3)
    }
    if (a_density_sa.lt(new Decimal(0.5))) {
        a_density_sa = new Decimal(0.5)
    }

    return a_density_sa.toNumber()
}
