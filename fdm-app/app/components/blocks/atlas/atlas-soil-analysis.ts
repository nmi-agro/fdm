import type { ExpressionSpecification } from "maplibre-gl"
import type { LayerProps } from "react-map-gl"

/* ================ SHADING DEFINITIONS ================ */

function evenlySpaced(...args: string[]) {
    return args.flatMap((item, i) => [i / (args.length - 1), item])
}

const COLORBREWER_YLORBR = evenlySpaced(
    "#ffffe5",
    "#fff7bc",
    "#fee391",
    "#fec44f",
    "#fe9929",
    "#ec7014",
    "#cc4c02",
    "#8c2d04",
)

const COLORBREWER_RDBU = evenlySpaced(
    "#b2182b",
    "#d6604d",
    "#f4a582",
    "#fddbc7",
    "#d1e5f0",
    "#92c5de",
    "#4393c3",
    "#2166ac",
)

export const SHADED_SOIL_TYPES = [
    { value: "moerige_klei", label: "Moerige klei", fill: "#D37FD0" },
    { value: "rivierklei", label: "Rivierklei", fill: "#81FE00" },
    { value: "dekzand", label: "Dekzand", fill: "#FFF99" },
    { value: "zeeklei", label: "Zeeklei", fill: "#32AA00" },
    { value: "dalgrond", label: "Dalgrond", fill: "#D37FD0" },
    { value: "veen", label: "Veen", fill: "#6A1EB5" },
    { value: "loess", label: "Löss", fill: "#AA2049" },
    { value: "duinzand", label: "Duinzand", fill: "#FFDD71" },
    { value: "maasklei", label: "Maasklei", fill: "#FED31E" },
]

/** Which gradient definition to use for gradient-shaded parameters.
 *  Add items here to let the user select other parameters.
 */
export const GRADIENT_SHADED_SOIL_PARAMETERS = {
    a_al_ox: "aluminum",
    a_c_of: "carbon",
    a_ca_co: "calcium",
    a_ca_co_po: "calcium",
    a_caco3_if: "calcium",
    a_cec_co: "earth_light",
    a_clay_mi: "earth_heavy",
    a_cn_fr: "carbon_ratio",
    a_com_fr: "carbon_ratio",
    a_cu_cc: "copper",
    a_density_sa: "earth_heavy",
    a_fe_ox: "iron",
    a_k_cc: "potassium",
    a_k_co: "potassium",
    a_k_co_po: "potassium",
    a_mg_cc: "magnesium",
    a_mg_co: "magnesium",
    a_mg_co_po: "magnesium",
    a_n_pmn: "bacterium",
    a_n_rt: "nitrogen",
    a_nh4_cc: "nitrogen",
    a_nmin_cc: "nitrogen",
    a_no3_cc: "nitrogen",
    a_p_al: "phosphorus",
    a_p_cc: "phosphorus",
    a_p_ox: "phosphorus",
    a_p_rt: "phosphorus",
    a_p_sg: "phosphorus",
    a_p_wa: "phosphorus",
    a_ph_cc: "ph",
    a_s_rt: "sulfur",
    a_sand_mi: "sand_light",
    a_silt_mi: "sand_dark",
    a_som_loi: "carbon",
    a_zn_cc: "zinc",
} as const
type GradientShadedSoilParameters = keyof typeof GRADIENT_SHADED_SOIL_PARAMETERS

/** Actual gradient definitions */
export const GRADIENT_DEFINITIONS: {
    [k in (typeof GRADIENT_SHADED_SOIL_PARAMETERS)[GradientShadedSoilParameters]]: {
        gradient: (string | number)[]
        center?: number
    }
} = {
    aluminum: { gradient: COLORBREWER_YLORBR },
    bacterium: { gradient: COLORBREWER_YLORBR },
    calcium: { gradient: COLORBREWER_YLORBR },
    carbon: { gradient: COLORBREWER_YLORBR },
    carbon_ratio: { gradient: COLORBREWER_YLORBR },
    copper: { gradient: COLORBREWER_YLORBR },
    earth_heavy: { gradient: COLORBREWER_YLORBR },
    earth_light: { gradient: COLORBREWER_YLORBR },
    nitrogen: { gradient: COLORBREWER_YLORBR },
    iron: { gradient: COLORBREWER_YLORBR },
    magnesium: { gradient: COLORBREWER_YLORBR },
    phosphorus: { gradient: COLORBREWER_YLORBR },
    potassium: { gradient: COLORBREWER_YLORBR },
    ph: { gradient: COLORBREWER_RDBU, center: 7 },
    sand_dark: { gradient: COLORBREWER_YLORBR },
    sand_light: { gradient: COLORBREWER_YLORBR },
    sulfur: { gradient: COLORBREWER_YLORBR },
    zinc: { gradient: COLORBREWER_YLORBR },
}

const ENUM_SHADED_SOIL_PARAMETERS = {
    b_soiltype_agr: SHADED_SOIL_TYPES.flatMap(({ value, fill }) => [
        value,
        fill,
    ]).concat(["#777777"]),
} as const
type EnumShadedSoilParameters = keyof typeof ENUM_SHADED_SOIL_PARAMETERS

export type ShadedSoilParameters =
    | GradientShadedSoilParameters
    | EnumShadedSoilParameters

export function getShadedSoilParameters() {
    return [
        ...Object.keys(GRADIENT_SHADED_SOIL_PARAMETERS).map((parameter) => ({
            parameter,
            shading: "gradient",
        })),
        ...Object.keys(ENUM_SHADED_SOIL_PARAMETERS).map((parameter) => ({
            parameter,
            shading: "enum",
        })),
    ] as { parameter: ShadedSoilParameters; shading: "gradient" | "enum" }[]
}

export function getGradientStops(
    gradient: (string | number)[],
    min: number,
    max: number,
    center: number | undefined,
) {
    let fromMin = min
    let fromMax = max
    let toMin = 0
    let toMax = 1

    if (typeof center !== "undefined") {
        if (min <= center && max <= center) {
            toMax = 0.5
        }

        if (min >= center && max >= center) {
            toMin = 0.5
        }

        if (min <= center && max >= center) {
            const radius = Math.max(max - center, center - min)
            fromMin = center - radius
            toMin = center + radius
        }
    }

    if (Math.abs(fromMax - fromMin) < 0.001) {
        fromMax = fromMin + 0.001
    }

    if (Math.abs(toMax - toMin) < 0.001) {
        toMax = toMin + 0.001
    }

    const stops: { normalPosition: number; position: number; color: string }[] =
        []

    for (let i = 0; i < gradient.length - 1; i += 2) {
        const originalPos = gradient[i] as number
        const originalCol = gradient[i + 1] as string

        const t = (originalPos - toMin) / (toMax - toMin)
        stops.push({
            normalPosition: t,
            position: fromMin + t * (fromMax - fromMin),
            color: originalCol,
        })
    }

    return stops
}

export function getSoilAnalysisLayerStyle(
    parameter: ShadedSoilParameters,
    min: number,
    max: number,
): { paint: LayerProps["paint"]; type: "fill" } {
    // MapLibreGL expression to get the data path out of the input object (which is the feature properties)
    const dataGetter = getShadingParameterMapper(parameter).paint([
        "get",
        parameter,
    ])

    if (parameter in ENUM_SHADED_SOIL_PARAMETERS) {
        const fillColor =
            ENUM_SHADED_SOIL_PARAMETERS[parameter as EnumShadedSoilParameters]
        return {
            type: "fill",
            paint: {
                "fill-opacity": 0.8,
                "fill-color": ["match", dataGetter, ...fillColor],
            },
        }
    }

    if (parameter in GRADIENT_SHADED_SOIL_PARAMETERS) {
        const gradientName =
            GRADIENT_SHADED_SOIL_PARAMETERS[
                parameter as GradientShadedSoilParameters
            ]
        const fillColor = GRADIENT_DEFINITIONS[gradientName]
        function greyIfUndefined(
            expr: ExpressionSpecification,
        ): ["match", ...unknown[]] {
            return [
                "match",
                ["typeof", dataGetter],
                "number",
                expr,
                "string",
                expr,
                "#777777",
            ]
        }

        return {
            type: "fill",
            paint: {
                "fill-color": greyIfUndefined([
                    "interpolate",
                    ["linear"],
                    dataGetter,
                    ...getGradientStops(
                        fillColor.gradient,
                        min,
                        max,
                        fillColor.center,
                    ).flatMap((stop) => [stop.position, stop.color]),
                ]),
            },
        }
    }

    return {
        type: "fill",
        paint: {
            "fill-color": "#ff00ff",
        },
    }
}

/* ================ SHADING-TO-LEGEND LOGIC ================ */

/** Value mappers that can be used in vanilla JS and MapGL paint expressions. */
interface ValueMapper {
    /** Used when finding the min and max */
    forward(x: number): number
    /** Used when converting legend color stop position to the tick display value */
    inverse(x: number): number
    /** Used to get the interpolation factor during map draw */
    paint(expr: ExpressionSpecification): ExpressionSpecification
}
const SHADING_VALUE_MAPPERS = {
    potential: {
        forward(x) {
            return -Math.log10(x)
        },
        inverse(x) {
            return 10 ** -x
        },
        paint(expr) {
            return ["-", ["log10", expr]]
        },
    } as ValueMapper,
} as const

/** Parameters to use a custom mapping for
 *
 * Do NOT use custom mappers for enum etc. parameters. Only use them for gradient-shaded parameters
 */
export const SHADING_PARAMETER_MAPPERS: Partial<
    Record<ShadedSoilParameters, ValueMapper>
> = {
    // a_cn_fr is a ratio so making the coloring linear like with pH is useful
    a_cn_fr: SHADING_VALUE_MAPPERS.potential,
    // a_com_fr is a ratio so making the coloring linear like with pH is useful
    a_com_fr: SHADING_VALUE_MAPPERS.potential,
}
const DEFAULT_PARAMETER_MAPPER: ValueMapper = {
    forward(x) {
        return x
    },
    inverse(x) {
        return x
    },
    paint(x) {
        return x
    },
}
/**Gets the forward and inverse mappings if a different mapping than linear is used for gradient shading
 *
 * @param parameter parameter to get the mappings for
 * @returns object containing mapping functions
 */
export function getShadingParameterMapper(parameter: ShadedSoilParameters) {
    if (
        parameter in SHADING_PARAMETER_MAPPERS &&
        !(parameter in GRADIENT_SHADED_SOIL_PARAMETERS)
    ) {
        console.warn(
            `Custom value mapper used for non-gradient-shaded parameter: ${parameter}`,
        )
    }
    return SHADING_PARAMETER_MAPPERS[parameter] ?? DEFAULT_PARAMETER_MAPPER
}
