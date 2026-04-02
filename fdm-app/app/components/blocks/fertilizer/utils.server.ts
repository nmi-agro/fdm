import {
    type Fertilizer,
    getFertilizerParametersDescription,
} from "@nmi-agro/fdm-core"

/**
 * Retrieves RVO label and type mappings used across fertilizer forms and summaries.
 * Centralizes the assembly of RVO metadata from the parameter descriptions and available fertilizers.
 *
 * @param fertilizers - Optional array of fertilizers to build the RVO-to-Type mapping for dynamic badge colors.
 * @returns An object containing:
 *   - `rvoLabels`: A record mapping RVO codes to their descriptive labels (in Dutch).
 *   - `rvoToType`: A record mapping RVO codes to fertilizer types (manure, compost, etc.).
 */
export async function getRvoMappings(fertilizers: Partial<Fertilizer>[] = []) {
    const fertilizerParameterDescription =
        await getFertilizerParametersDescription("NL-nl")
    const p_type_rvo_options =
        fertilizerParameterDescription.find((x) => x.parameter === "p_type_rvo")
            ?.options ?? []

    const rvoLabels = Object.fromEntries(
        p_type_rvo_options.map((opt) => [String(opt.value), opt.label]),
    )

    const rvoToType: Record<string, string> = {}
    for (const f of fertilizers) {
        if (f.p_type_rvo && f.p_type) {
            rvoToType[f.p_type_rvo] = f.p_type
        }
    }

    return { rvoLabels, rvoToType }
}
