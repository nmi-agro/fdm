import type { ExpressionSpecification } from "maplibre-gl"
import type { LayerProps } from "react-map-gl"

/* ================ SHADING DEFINITIONS ================ */

/**
 * A gradient stop with position and color
 */
type GradientStop = {
    /** Stop position such that 0 becomes the start of the gradient and 1 becomes the end */
    normalPosition: number
    /** normalPosition linearly-interpolated between the data min and max values. ColorBrewer gradients have this value as if the data min is 0 and the max is 1 */
    position: number
    /** Color at this gradient stop */
    color: string
}

/**
 * Collection of stops defining a gradient's colors
 */
type Gradient = GradientStop[]

function evenlySpaced(...args: string[]) {
    return args.map((item, i) => {
        const t = i / (args.length - 1)
        return { position: t, normalPosition: t, color: item }
    })
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

/**
 * Value, label, and display fill color for each agricultural soiltype that is supported by fdm-core
 */
export const SHADED_SOIL_TYPES = [
    { value: "moerige_klei", label: "Moerige klei", fill: "#D37FD0" },
    { value: "rivierklei", label: "Rivierklei", fill: "#81FE00" },
    { value: "dekzand", label: "Dekzand", fill: "#FFFF99" },
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
        gradient: Gradient
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

/** MapLibreGL match arm definitions for each soil type that should be shaded according to enum values */
const ENUM_SHADED_SOIL_PARAMETERS = {
    b_soiltype_agr: SHADED_SOIL_TYPES.flatMap(({ value, fill }) => [
        value,
        fill,
    ]).concat(["#777777"]),
} as const
type EnumShadedSoilParameters = keyof typeof ENUM_SHADED_SOIL_PARAMETERS

/** Soil parameters supported by the soil analysis atlas */
export type ShadedSoilParameters =
    | GradientShadedSoilParameters
    | EnumShadedSoilParameters

/**
 * Gets the list of soil parameters supported by the soil analysis atlas
 *
 * @returns array of strings
 */
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

/**
 * Transforms the gradient stops such that the stops are positioned either
 *
 * - between the min and max value, where original 0 is mapped to min and 1 to max
 * - 0 to min and 0.5 to max if center is specified and all values are less than the center value
 * - 0.5 to min and 1 to max if center is specified and all values are greater than the center value
 * - 0 to the greatest possible and 1 to the least possible value such that 0.5 is mapped to the center,
 *   if the previous two cases don't hold.
 *
 * This strategy ensures that there is always a big contrast between the min and max colors, but it is
 * still possible to specify a meaningful center value.
 *
 * For example in the case of pH, if all data points indicate acidic soil, no blue values will be used,
 * the most pale value in the middle of the gradient will be for the minimum acidity, and the most intense
 * red will be for the maximum acidity.
 *
 * @param gradient gradient to use. It may be "clipped" and some colors might not be used, according to the strategy above.
 * @param min minimum data value
 * @param max maximum data value
 * @param center optional value to always align the center of the original gradient at
 * @returns a new list of gradient stops. normalPosition might be different than the original gradient, but has the same units.
 * position will have the units of the data. Both of them might go out of the 0-1 or min-max range if gradient clipping occurred.
 */
export function transformGradientStops(
    gradient: Gradient,
    min: number,
    max: number,
    center: number | undefined,
): Gradient {
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
            fromMax = center + radius
        }
    }

    if (Math.abs(fromMax - fromMin) < 0.001) {
        fromMax = fromMin + 0.001
    }

    if (Math.abs(toMax - toMin) < 0.001) {
        toMax = toMin + 0.001
    }

    const stops: Gradient = []

    for (let i = 0; i < gradient.length; i++) {
        const originalPos = gradient[i].position
        const originalCol = gradient[i].color

        const t = (originalPos - toMin) / (toMax - toMin)
        stops.push({
            normalPosition: t,
            position: fromMin + t * (fromMax - fromMin),
            color: originalCol,
        })
    }

    return stops
}

/**
 * Builds the layer style to be applied to the field layer on the soil analysis atlas. This needs to be
 * paired with a correctly-working legend, which can make use of the `transformGradientStops` function.
 *
 * Missing values will be displayed in a gray color.
 *
 * @param parameter which soil parameter to get the styles for
 * @param min minimum data value
 * @param max maximum data value
 * @returns Layer component `type` and `paint` props
 */
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
                    ...transformGradientStops(
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
