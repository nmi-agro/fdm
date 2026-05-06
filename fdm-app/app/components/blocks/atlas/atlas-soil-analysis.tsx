import type { ExpressionSpecification } from "maplibre-gl"
import type { LayerProps } from "react-map-gl"

/* ================ SHADING DEFINITIONS ================ */

function evenlySpaced(...args: string[]) {
    return args.flatMap((item, i) => [i / (args.length - 1), item])
}

const COLORBREWER_ORANGES = evenlySpaced(
    "#fff5eb",
    "#fee6ce",
    "#fdd0a2",
    "#fdae6b",
    "#fd8d3c",
    "#f16913",
    "#d94801",
    "#a63603",
    "#7f2704",
)
const COLORBREWER_BLUES = evenlySpaced(
    "#f7fbff",
    "#deebf7",
    "#c6dbef",
    "#9ecae1",
    "#6baed6",
    "#4292c6",
    "#2171b5",
    "#08519c",
    "#08306b",
)
const COLORBREWER_GREYS = evenlySpaced(
    "#f7f7f7",
    "#cccccc",
    "#969696",
    "#636363",
    "#252525",
)
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
const COLORBREWER_BUGN = evenlySpaced(
    "#f7fcfd",
    "#e5f5f9",
    "#ccece6",
    "#99d8c9",
    "#66c2a4",
    "#41ae76",
    "#238b45",
    "#006d2c",
    "#00441b",
)

const COLORBREWER_GNBU = evenlySpaced(
    "#f7fcf0",
    "#e0f3db",
    "#ccebc5",
    "#a8ddb5",
    "#7bccc4",
    "#4eb3d3",
    "#2b8cbe",
    "#08589e",
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
const COLORBREWER_RDPU = evenlySpaced(
    "#fff7f3",
    "#fde0dd",
    "#fcc5c0",
    "#fa9fb5",
    "#f768a1",
    "#dd3497",
    "#ae017e",
    "#7a0177",
)
const COLORBREWER_PUBUGN = evenlySpaced(
    "#fff7fb",
    "#ece2f0",
    "#d0d1e6",
    "#a6bddb",
    "#67a9cf",
    "#3690c0",
    "#02818a",
    "#016c59",
    "#014636",
)

export const SHADED_SOIL_TYPES = [
    { value: "moerige_klei", label: "Moerige klei", fill: "rgb(45, 0, 168)" },
    { value: "rivierklei", label: "Rivierklei", fill: "rgb(112, 194, 0)" },
    { value: "dekzand", label: "Dekzand", fill: "rgb(244, 244, 70)" },
    { value: "zeeklei", label: "Zeeklei", fill: "rgb(6, 158, 200)" },
    { value: "dalgrond", label: "Dalgrond", fill: "rgb(195, 195, 195)" },
    { value: "veen", label: "Veen", fill: "rgb(223, 115, 255)" },
    { value: "loess", label: "Löss", fill: "rgb(255, 255, 255)" },
    { value: "duinzand", label: "Duinzand", fill: "rgb(255, 100, 0)" },
    { value: "maasklei", label: "Maasklei", fill: "rgb(152, 158, 0)" },
]

/** Which gradient definition to use for gradient-shaded parameters.
 *  Add items here to let the user select other parameters.
 */
export const GRADIENT_SHADED_SOIL_PARAMETERS = {
    a_al_ox: "aluminum",
    a_c_of: "carbon",
    a_ca_co: "calcium",
    a_ca_co_po: "calcium",
    a_cao3_if: "calcium",
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
    aluminum: { gradient: COLORBREWER_GREYS },
    bacterium: { gradient: COLORBREWER_GNBU },
    calcium: { gradient: COLORBREWER_BUGN },
    carbon: { gradient: COLORBREWER_GREYS },
    carbon_ratio: { gradient: COLORBREWER_GREYS },
    copper: { gradient: COLORBREWER_BLUES },
    earth_heavy: { gradient: COLORBREWER_YLORBR },
    earth_light: { gradient: COLORBREWER_ORANGES },
    nitrogen: { gradient: COLORBREWER_BLUES },
    iron: { gradient: COLORBREWER_ORANGES },
    magnesium: { gradient: COLORBREWER_PUBUGN },
    phosphorus: { gradient: COLORBREWER_RDPU },
    potassium: { gradient: COLORBREWER_RDPU },
    ph: { gradient: COLORBREWER_RDBU, center: 7 },
    sand_dark: { gradient: COLORBREWER_YLORBR },
    sand_light: { gradient: COLORBREWER_ORANGES },
    sulfur: { gradient: COLORBREWER_YLORBR },
    zinc: { gradient: COLORBREWER_GREYS },
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
        function transparentIfUndefined(
            expr: ExpressionSpecification,
        ): ["match", ...unknown[]] {
            return [
                "match",
                ["typeof", dataGetter],
                "number",
                expr,
                "string",
                expr,
                "transparent",
            ]
        }
        if (typeof fillColor.center !== "undefined") {
            // Cover as much range as needed but still keep the center (for example for pH display, where 7 is the center)
            const radius = Math.max(
                max - fillColor.center,
                fillColor.center - min,
            )
            const newMin = fillColor.center - radius
            const newMax = fillColor.center + radius
            return {
                type: "fill",
                paint: {
                    "fill-color": transparentIfUndefined([
                        "interpolate",
                        ["linear"],
                        dataGetter,
                        ...fillColor.gradient.map((item) =>
                            typeof item === "string"
                                ? item
                                : (newMax - newMin) * item + newMin,
                        ),
                    ]),
                },
            }
        }

        return {
            type: "fill",
            paint: {
                "fill-color": transparentIfUndefined([
                    "interpolate",
                    ["linear"],
                    dataGetter,
                    ...fillColor.gradient.map((item) =>
                        typeof item === "string"
                            ? item
                            : (max - min) * item + min,
                    ),
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
/**Gets the forward and inverse mappings if a different mapping than linear is used for chromatic shading
 *
 * @param parameter parameter to get the mappings for
 * @returns object containing mapping functions
 */
export function getShadingParameterMapper(parameter: ShadedSoilParameters) {
    if (!(parameter in GRADIENT_SHADED_SOIL_PARAMETERS)) {
        console.warn(
            `Custom value mapper used for non-gradient-shaded parameter: ${parameter}`,
        )
    }
    return SHADING_PARAMETER_MAPPERS[parameter] ?? DEFAULT_PARAMETER_MAPPER
}
