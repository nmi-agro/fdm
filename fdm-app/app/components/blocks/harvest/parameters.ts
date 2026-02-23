import type { HarvestParameters } from "@nmi-agro/fdm-core"

export function getHarvestParameterLabel(param: HarvestParameters[number]) {
    switch (param) {
        case "b_lu_yield":
            return "Opbrengst (kg DS / ha)"
        case "b_lu_yield_fresh":
            return "Opbrengst (kg versproduct / ha)"
        case "b_lu_yield_bruto":
            return "Opbrengst incl. tarra (kg versproduct / ha)"
        case "b_lu_tarra":
            return "Tarra (%)"
        case "b_lu_dm":
            return "Droge stofgehalte (g DS / kg versproduct)"
        case "b_lu_moist":
            return "Vochtgehalte (%)"
        case "b_lu_uww":
            return "Onderwatergewicht (g / 5 kg)"
        case "b_lu_cp":
            return "Ruw eiwit (g RE / kg DS)"
        case "b_lu_n_harvestable":
            return "Stikstofgehalte (g N / kg DS)"
        default:
            return param
    }
}
