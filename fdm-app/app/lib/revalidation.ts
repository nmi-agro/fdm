import type { ShouldRevalidateFunction, ShouldRevalidateFunctionArgs } from "react-router"

/**
 * Creates a `shouldRevalidate` for a layout route whose loader data only depends on some of the
 * route params, such as the farm and the calendar year.
 *
 * React Router re-runs a parent loader whenever any param of the URL changes, so switching to
 * another field would reload the farm-wide data of every layout above it. With this function the
 * layout loader only runs again when:
 * - a form or fetcher submission happened (the data may have changed),
 * - the URL stayed the same (an explicit revalidation, for example a retry button),
 * - or one of the given params changed.
 *
 * In all other cases React Router keeps the previous loader data. When React Router itself would
 * not revalidate, this function doesn't either.
 *
 * @param paramNames - The route params the loader data depends on.
 * @returns A function to export as `shouldRevalidate` from the layout route.
 */
export function revalidateOnParamChange(paramNames: readonly string[]): ShouldRevalidateFunction {
  return ({
    currentParams,
    nextParams,
    currentUrl,
    nextUrl,
    formMethod,
    defaultShouldRevalidate,
  }: ShouldRevalidateFunctionArgs): boolean => {
    if (!defaultShouldRevalidate) return false
    if (formMethod) return true
    if (currentUrl.href === nextUrl.href) return true
    return paramNames.some((name) => currentParams[name] !== nextParams[name])
  }
}

/**
 * `shouldRevalidate` for layouts whose loader data depends only on the farm and the calendar year.
 */
export const revalidateOnFarmOrCalendarChange = revalidateOnParamChange(["b_id_farm", "calendar"])
