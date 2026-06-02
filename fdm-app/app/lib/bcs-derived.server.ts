import type { FdmType } from "@nmi-agro/fdm-core"
import { getCultivations, getSoilAnalyses } from "@nmi-agro/fdm-core"
import {
    type BcsLabContext,
    type OmSoiltypeN,
    deriveCropPlanFractions,
} from "@nmi-agro/fdm-calculator"
import { isBcsAnalysis } from "~/lib/bcs"

export interface DerivedBcsContext {
    labContext: BcsLabContext | null
    labAnalysisDate: Date | null
}

type SoiltypeAgr =
    | "dekzand"
    | "dalgrond"
    | "duinzand"
    | "loess"
    | "maasklei"
    | "moerige_klei"
    | "rivierklei"
    | "veen"
    | "zeeklei"

function mapOmSoilType(soiltype: string | null | undefined): OmSoiltypeN | null {
    switch (soiltype) {
        case "dekzand":
        case "dalgrond":
        case "duinzand":
            return "zand"
        case "zeeklei":
        case "rivierklei":
        case "maasklei":
        case "moerige_klei":
            return "klei"
        case "loess":
            return "loess"
        case "veen":
            return "veen"
        default:
            return null
    }
}

export async function deriveBcsScores(
    fdm: FdmType,
    principal_id: string,
    b_id: string,
    bcsDate: Date,
): Promise<DerivedBcsContext> {
    const soilAnalyses = await getSoilAnalyses(fdm, principal_id, b_id)
    const candidate = soilAnalyses.find((analysis) => {
        if (isBcsAnalysis(analysis)) return false
        const analysisDate = analysis.b_sampling_date ?? analysis.a_date
        if (!analysisDate) return false
        return new Date(analysisDate) <= bcsDate
    })

    if (!candidate) {
        return { labContext: null, labAnalysisDate: null }
    }

    let cultivations: Awaited<ReturnType<typeof getCultivations>> = []
    try {
        cultivations = await getCultivations(fdm, principal_id, b_id)
    } catch {
        cultivations = []
    }

    const cropPlan = deriveCropPlanFractions(cultivations, bcsDate.getFullYear())
    const soiltype = candidate.b_soiltype_agr as SoiltypeAgr | null | undefined
    const omSoilType = mapOmSoilType(soiltype)

    const labContext: BcsLabContext = {
        a_ph_cc: candidate.a_ph_cc ?? null,
        a_som_loi: candidate.a_som_loi ?? null,
        b_soiltype_agr: soiltype ?? null,
        a_clay_mi: candidate.a_clay_mi ?? null,
        d_cp_starch: cropPlan.d_cp_starch,
        d_cp_potato: cropPlan.d_cp_potato,
        d_cp_sugarbeet: cropPlan.d_cp_sugarbeet,
        d_cp_grass: cropPlan.d_cp_grass,
        d_cp_mais: cropPlan.d_cp_mais,
        b_lu_is_clover: cropPlan.b_lu_is_clover,
        om_crop_category: cropPlan.om_crop_category,
        om_soiltype_n: omSoilType ?? undefined,
    }

    return {
        labContext,
        labAnalysisDate: candidate.b_sampling_date ?? candidate.a_date ?? null,
    }
}
