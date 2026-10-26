/**
 * Takes a comma separated list of b_id:p_app_id pairs and converts it to a list of objects
 *
 * For example, `"a:b,c:d"` would parse into `[{b_id: "a", p_app_id: "b"}, {b_id: "c", p_app_id: "d"}]`
 *
 * Any string separated by `,` that is not a valid pair in the above format is discarded.
 * Therefore, this function might return an empty array even if the string is not empty.
 *
 *
 * @param value string to parse
 * @returns array of objects
 */
export function parseAppIds(value: string) {
  return value
    .split(",")
    .map((pairStr) => pairStr.split(":"))
    .filter((pair) => pair.length === 2 && pair[0].length > 0 && pair[1].length > 0)
    .map(([b_id, p_app_id]) => ({ b_id, p_app_id }))
}

/** The values of a fertilizer application that are shown on the application form. */
export interface ApplicationFormValues {
  p_id?: string
  p_app_date?: Date
  p_app_method?: string
  p_app_amount_display?: number
}

type ApplicationLike = {
  p_id: string | null
  p_app_date: Date | null
  p_app_method: string | null
  p_app_amount_display: number | null
}

const FORM_KEY_TYPES = {
  p_id: "string",
  p_app_date: "date",
  p_app_method: "string",
  p_app_amount_display: "number",
} as const

/**
 * Determines the form values that several fertilizer applications have in common, to prefill the
 * form when they are changed at once.
 *
 * A value is common when every application has it; amounts count as equal when they differ by at
 * most 1% from the first application. When the fertilizers differ, the method is not common either.
 *
 * @param applications - The applications, in a stable order (the first one is the reference).
 * @returns `common`: the values to prefill. `example`: the values of the first application, to
 *   show as placeholder for the values that differ.
 */
export function getCommonApplicationValues(applications: ApplicationLike[]): {
  common: ApplicationFormValues
  example: ApplicationFormValues
} {
  const [first] = applications
  if (!first) return { common: {}, example: {} }

  const keys = Object.keys(FORM_KEY_TYPES) as (keyof typeof FORM_KEY_TYPES)[]
  const common: Record<string, unknown> = {}
  for (const key of keys) {
    const reference = first[key]
    if (reference === null || reference === undefined) continue
    const isCommon = applications.every((app) => {
      const value = app[key]
      if (value === null || value === undefined) return false
      if (FORM_KEY_TYPES[key] === "number") {
        const a = value as number
        const b = reference as number
        return a === b || Math.abs(a - b) <= Math.abs(b) / 100
      }
      if (FORM_KEY_TYPES[key] === "date") {
        return (value as Date).getTime() === (reference as Date).getTime()
      }
      return value === reference
    })
    if (isCommon) common[key] = reference
  }

  const example: Record<string, unknown> = Object.fromEntries(
    keys.map((key) => [key, first[key] ?? undefined]),
  )
  // If the fertilizers differ, assume the application methods differ too
  if (!common.p_id) {
    delete common.p_app_method
    // Also, no specific placeholder should be shown
    delete example.p_app_amount_display
  }
  return { common: common as ApplicationFormValues, example: example as ApplicationFormValues }
}
