import { fdmSchema } from "@nmi-agro/fdm-core"
import { z } from "zod"

/**
 * Coded values and their Dutch names.
 *
 * Several fields hold a code (`'slotted coulter'`, `'nl_01'`) while the web app shows the user a
 * Dutch name ("Zodenbemester / Sleepvoet", "Eigendom"). The descriptions built here list every code
 * with that name, so a client, or an AI assistant that talks Dutch with the user, can map the
 * user's words to the right code. The lists come from fdm-core, the same source the web app uses,
 * so a new code appears here without a change to the API.
 */

/** A code and the Dutch name the web app shows for it. */
export interface CodeOption {
  value: string
  label: string
}

/** Methods of applying a fertilizer (`p_app_method`). */
export const APPLICATION_METHODS: readonly CodeOption[] = fdmSchema.applicationMethodOptions

/** Ways a farm acquired the use of a field (`b_acquiring_method`), following the RVO registration. */
export const ACQUIRING_METHODS: readonly CodeOption[] = fdmSchema.acquiringMethodOptions

/** Agricultural soil types (`b_soiltype_agr`). */
export const SOIL_TYPES: readonly CodeOption[] = fdmSchema.soilTypesOptions

/** Groundwater classes (`b_gwl_class`, Dutch "grondwatertrap"). */
export const GROUNDWATER_CLASSES: readonly CodeOption[] = fdmSchema.gwlClassesOptions

/** Laboratories and datasets that produce soil analyses (`a_source`). */
export const SOIL_ANALYSIS_SOURCES: readonly CodeOption[] = fdmSchema.soilAnalysisSourceOptions

/**
 * Sources that only the system records. A client cannot choose them: `nl-other-nmi` marks soil
 * data that NMI estimated.
 */
const SYSTEM_SOIL_ANALYSIS_SOURCES = new Set(["nl-other-nmi"])

/** The soil analysis sources a client may choose when it creates or changes an analysis. */
export const SELECTABLE_SOIL_ANALYSIS_SOURCES: readonly CodeOption[] = SOIL_ANALYSIS_SOURCES.filter(
  (option) => !SYSTEM_SOIL_ANALYSIS_SOURCES.has(option.value),
)

/**
 * Appends the allowed codes, each with its Dutch name, to a field description.
 *
 * @param description - What the field holds, as one or more sentences.
 * @param options - The allowed codes.
 * @returns For example `Application method. One of: 'injection' (Mestinjectie), ...`. A name that
 *   equals its code is left out.
 */
export function describeCodes(description: string, options: readonly CodeOption[]): string {
  const list = options
    .map(({ value, label }) => (label === value ? `'${value}'` : `'${value}' (${label})`))
    .join(", ")
  return `${description} One of: ${list}. The name in parentheses is what the user sees in the Dutch web app; refer to the value by that name when talking to the user.`
}

/**
 * Builds a schema that accepts only the given codes, for request bodies. A wrong code then fails
 * validation with the allowed values, instead of failing in the database.
 *
 * @param options - The allowed codes.
 * @returns A Zod enum of the codes.
 */
export function codeEnum(options: readonly CodeOption[]) {
  return z.enum(options.map((option) => option.value) as [string, ...string[]])
}
