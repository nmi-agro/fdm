/** Number of steps an undo history keeps by default. */
export const UNDO_LIMIT = 20

/**
 * Adds a step to an undo history, dropping the oldest steps beyond the limit.
 *
 * @param history - The earlier states, oldest first.
 * @param entry - The state to restore with the next undo.
 * @param limit - Maximum number of steps to keep. Defaults to {@link UNDO_LIMIT}.
 * @returns A new history; the given one is not changed.
 */
export function pushUndo<T>(history: readonly T[], entry: T, limit = UNDO_LIMIT): T[] {
  const next = [...history, entry]
  return next.length > limit ? next.slice(next.length - limit) : next
}
