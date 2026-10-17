import { create } from "zustand"
import type { ReviewChoices, ReviewItemFieldKey } from "~/components/blocks/rvo/review-fields"

/**
 * Per-field user choices made while reviewing an RVO import, keyed by review item id and
 * then by field key (e.g. `b_name`, `b_start`).
 */
type UserChoices = Map<string, ReviewChoices>

interface RvoImportReviewState {
  userChoices: UserChoices
  fieldsToAdd: Set<string>
  fieldsToRemove: Set<string>
  showCustomValueButtons: boolean
  setUserChoice: (itemId: string, key: ReviewItemFieldKey, value: unknown) => void
  /** Sets several choices for one review item in a single update. */
  setUserChoices: (itemId: string, values: ReviewChoices) => void
  setFieldToAdd: (itemId: string, add: boolean) => void
  setFieldToRemove: (itemId: string, remove: boolean) => void
  /** Clears all choices, optionally starting from the given initial choices per review item. */
  reset: (initialChoices: UserChoices) => void
  setShowCustomValueButtons: (value: boolean) => void
}

/**
 * Holds the user's per-field choices for the RVO import review table.
 *
 * This lives outside React state so that editing one cell only notifies the components that
 * actually read that cell's slice (via the selector hooks below), instead of re-rendering the
 * whole review table on every keystroke.
 */
export const useRvoImportReviewStore = create<RvoImportReviewState>((set) => ({
  userChoices: new Map(),
  fieldsToAdd: new Set(),
  fieldsToRemove: new Set(),
  showCustomValueButtons: false,
  setUserChoice(itemId, key, value) {
    set((state) => {
      const userChoices = new Map(state.userChoices)
      userChoices.set(itemId, { ...userChoices.get(itemId), [key]: value })
      return { userChoices }
    })
  },
  setUserChoices(itemId, values) {
    set((state) => {
      const userChoices = new Map(state.userChoices)
      userChoices.set(itemId, { ...userChoices.get(itemId), ...values })
      return { userChoices }
    })
  },
  setFieldToAdd(itemId, add) {
    set((state) => {
      if (state.fieldsToAdd.has(itemId) === add) return state
      const fieldsToAdd = new Set(state.fieldsToAdd)
      if (add) {
        fieldsToAdd.add(itemId)
      } else {
        fieldsToAdd.delete(itemId)
      }
      return { fieldsToAdd }
    })
  },
  setFieldToRemove(itemId, remove) {
    set((state) => {
      if (state.fieldsToRemove.has(itemId) === remove) return state
      const fieldsToRemove = new Set(state.fieldsToRemove)
      if (remove) {
        fieldsToRemove.add(itemId)
      } else {
        fieldsToRemove.delete(itemId)
      }
      return { fieldsToRemove }
    })
  },
  reset(initialChoices) {
    set({
      userChoices: new Map(initialChoices),
      fieldsToAdd: new Set(),
      fieldsToRemove: new Set(),
    })
  },
  setShowCustomValueButtons(value: boolean) {
    set({
      showCustomValueButtons: value,
    })
  },
}))

/** Subscribes to a single field's user choice for one review item. */
export function useRvoUserChoice<T = unknown>(
  itemId: string,
  key: ReviewItemFieldKey,
): T | undefined {
  return useRvoImportReviewStore((state) => state.userChoices.get(itemId)?.[key] as T | undefined)
}

/** Subscribes to all user choices for one review item at once. */
export function useRvoUserChoices(itemId: string): ReviewChoices | undefined {
  return useRvoImportReviewStore((state) => state.userChoices.get(itemId))
}

/** Subscribes to whether one review item is marked to be added. */
export function useRvoFieldToAdd(itemId: string): boolean {
  return useRvoImportReviewStore((state) => state.fieldsToAdd.has(itemId))
}

/** Subscribes to whether one review item is marked to be removed. */
export function useRvoFieldToRemove(itemId: string): boolean {
  return useRvoImportReviewStore((state) => state.fieldsToRemove.has(itemId))
}
