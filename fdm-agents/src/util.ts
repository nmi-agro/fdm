import type { BaseContextSchema, FdmAgent } from "./types"

/**
 * Checks if the given object might be a valid agent.
 * @param obj Object to check.
 * @returns true iff the object has the `stream` and `streamEvents` methods.
 */
export function isValidAgent<T_ContextSchema extends BaseContextSchema>(
  obj: unknown,
): obj is FdmAgent<T_ContextSchema> {
  return (
    obj != null &&
    typeof (obj as FdmAgent<T_ContextSchema>).stream === "function" &&
    typeof (obj as FdmAgent<T_ContextSchema>).streamEvents === "function"
  )
}
