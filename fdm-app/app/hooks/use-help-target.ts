import { useMatches } from "react-router"
import type { HelpHandle, HelpTargetId } from "~/lib/manual/help-targets"

/**
 * Returns the help target that the deepest matching route declares with
 * `export const handle: HelpHandle = { help: "…" }`, or `undefined` when no route declares one.
 */
export function useHelpTarget(): HelpTargetId | undefined {
  const matches = useMatches()
  for (const match of [...matches].reverse()) {
    const help = (match.handle as HelpHandle | undefined)?.help
    if (help) return help
  }
  return undefined
}
