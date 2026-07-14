import type { VisibilityState } from "@tanstack/react-table"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { UnitMode } from "~/components/blocks/nutrient-advice/overview-types"
import { ssrSafeSessionJSONStorage } from "./storage"

interface NutrientAdviceOverviewState {
  unitMode: UnitMode
  columnVisibility: VisibilityState
  // Tracks whether the user has ever made an explicit column visibility choice, so the
  // mobile/desktop default (hide secondary/trace nutrients on mobile) only applies until then
  // and never clobbers a persisted, explicit selection on a later mount.
  hasCustomColumnVisibility: boolean
  setUnitMode: (unitMode: UnitMode) => void
  setColumnVisibility: (
    columnVisibility: VisibilityState | ((prev: VisibilityState) => VisibilityState),
  ) => void
  applyDefaultColumnVisibility: (columnVisibility: VisibilityState) => void
  resetColumnVisibility: () => void
}

export const useNutrientAdviceOverviewStore = create<NutrientAdviceOverviewState>()(
  persist(
    (set) => ({
      unitMode: "per_ha",
      columnVisibility: {},
      hasCustomColumnVisibility: false,
      setUnitMode: (unitMode) => set({ unitMode }),
      setColumnVisibility: (columnVisibility) =>
        set((state) => ({
          columnVisibility:
            typeof columnVisibility === "function"
              ? columnVisibility(state.columnVisibility)
              : columnVisibility,
          hasCustomColumnVisibility: true,
        })),
      // Applies the mobile/desktop default without marking the selection as user-customized.
      applyDefaultColumnVisibility: (columnVisibility) => set({ columnVisibility }),
      // "Select all" in the column visibility dropdown: an empty state means every column is
      // visible, so resetting simply clears any per-column overrides.
      resetColumnVisibility: () => set({ columnVisibility: {}, hasCustomColumnVisibility: true }),
    }),
    {
      name: "nutrient-advice-overview-storage",
      storage: createJSONStorage(() => ssrSafeSessionJSONStorage),
    },
  ),
)
