import { getSoilParametersDescription } from "@nmi-agro/fdm-core"

export function getSoilParametersForSoilAnalysisType(
    soilAnalysisType: "standard" | "all" | "nmin" | "derogation",
) {
    let soilParameters = []
    if (soilAnalysisType === "standard") {
        soilParameters = [
            "a_source",
            "b_sampling_date",
            "a_depth_lower",
            "a_n_rt",
            "a_s_rt",
            "a_p_cc",
            "a_p_al",
            "a_p_wa",
            "a_k_cc",
            "a_k_co",
            "a_ca_co",
            "a_mg_cc",
            "a_mg_co",
            "a_zn_cc",
            "a_cu_cc",
            "a_ph_cc",
            "a_c_of",
            "a_som_loi",
            "a_caco3_if",
            "a_clay_mi",
            "a_silt_mi",
            "a_sand_mi",
            "a_cec_co",
            "a_n_pmn",
            "a_density_sa",
            "b_soiltype_agr",
        ]
    } else if (soilAnalysisType === "all") {
        soilParameters = [
            "a_al_ox",
            "a_c_of",
            "a_ca_co",
            "a_ca_co_po",
            "a_caco3_if",
            "a_cec_co",
            "a_clay_mi",
            "a_cn_fr",
            "a_com_fr",
            "a_cu_cc",
            "a_density_sa",
            "a_fe_ox",
            "a_k_cc",
            "a_k_co",
            "a_k_co_po",
            "a_mg_cc",
            "a_mg_co",
            "a_mg_co_po",
            "a_n_pmn",
            "a_n_rt",
            "a_nh4_cc",
            "a_nmin_cc",
            "a_no3_cc",
            "a_p_al",
            "a_p_cc",
            "a_p_ox",
            "a_p_rt",
            "a_p_sg",
            "a_p_wa",
            "a_ph_cc",
            "a_s_rt",
            "a_sand_mi",
            "a_silt_mi",
            "a_som_loi",
            "a_zn_cc",
            "b_gwl_class",
            "b_soiltype_agr",
        ]
    } else if (soilAnalysisType === "nmin") {
        soilParameters = [
            "a_source",
            "b_sampling_date",
            "a_depth_upper",
            "a_depth_lower",
            "a_no3_cc",
            "a_nh4_cc",
            "a_nmin_cc",
        ]
    } else if (soilAnalysisType === "derogation") {
        soilParameters = [
            "a_source",
            "b_sampling_date",
            "a_depth_lower",
            "a_n_rt",
            "a_cn_fr",
            "a_p_cc",
            "a_p_wa",
            "a_p_al",
            "a_c_of",
            "a_som_loi",
            "a_clay_mi",
            "a_density_sa",
        ]
    } else {
        throw new Error(
            `Unsupported soil analysis type: ${soilAnalysisType}. Supported types: standard, all, nmin, derogation`,
        )
    }

    // Get soil parameter descriptions
    let soilParameterDescription = getSoilParametersDescription("NL-nl")

    // Filter soilParameterDescription based on selected soil parameters
    soilParameterDescription = soilParameterDescription.filter(
        (item: { parameter: string }) =>
            soilParameters.includes(item.parameter),
    )

    // Order soilParameterDescription based on selected soil parameters
    soilParameterDescription.sort(
        (a: { parameter: string }, b: { parameter: string }) => {
            return (
                soilParameters.indexOf(a.parameter) -
                soilParameters.indexOf(b.parameter)
            )
        },
    )

    return soilParameterDescription
}
