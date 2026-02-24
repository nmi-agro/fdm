import type * as schema from "@nmi-agro/fdm-core"
import type {
    Cultivation,
    Fertilizer,
    FertilizerApplication,
    Field,
} from "@nmi-agro/fdm-core"
import type { RegionKey } from "../value/types"

export type Table11Mestcodes = {
    p_type_rvo: schema.fertilizersCatalogueTypeSelect["p_type_rvo"]
    p_type_nitratesdirective: boolean
    p_n_rt?: number
    p_p_rt?: number
}[]

export type Table9 = {
    description: string
    p_type_rvo: schema.fertilizersCatalogueTypeSelect["p_type_rvo"][]
    onFarmProduced?: boolean
    subTypes?: {
        description: string
        b_grazing_intention?: boolean
        grondsoortCode?: RegionKey[]
        applicationPeriod?: "1 september t/m 31 januari" | "hele jaar"
        isBouwland?: boolean
        p_n_wcl: number
    }[]
    p_n_wcl?: number
}[]

export type WorkingCoefficientDetails = {
    p_n_wcl: number
    description: string
    subTypeDescription?: string
}

export type NL2026NormsFillingInput = {
    cultivations: Cultivation[]
    applications: FertilizerApplication[]
    fertilizers: Fertilizer[]
    has_organic_certification: boolean
    has_grazing_intention: boolean
    fosfaatgebruiksnorm: number
    b_centroid: Field["b_centroid"]
}
