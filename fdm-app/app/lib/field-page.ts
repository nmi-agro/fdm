import { useMatches } from "react-router"

/**
 * Route `handle` for pages inside the field layout. With `fieldDescription`, a page replaces the
 * generic description under the field name, so that the page needs no title block of its own.
 *
 * @example
 * export const handle: FieldPageHandle = { fieldDescription: "Bodemanalyse toevoegen" }
 */
export interface FieldPageHandle {
  /** The description, or a function that derives it from the loader data of the route. */
  fieldDescription?: string | ((loaderData: unknown) => string | undefined)
}

/**
 * Returns the description that the deepest matching route sets with {@link FieldPageHandle}, or
 * `undefined` when no route sets one.
 */
export function useFieldPageDescription(): string | undefined {
  const matches = useMatches()
  for (const match of [...matches].reverse()) {
    const description = (match.handle as FieldPageHandle | undefined)?.fieldDescription
    const resolved = typeof description === "function" ? description(match.loaderData) : description
    if (resolved) return resolved
  }
  return undefined
}
