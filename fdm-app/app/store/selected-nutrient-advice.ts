import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import {
  DEFAULT_NUTRIENT_ADVICE_MODE,
  DEFAULT_NUTRIENT_ADVICE_NUTRIENT,
  isNutrientAdviceMode,
  type NutrientAdviceMode,
} from "~/components/blocks/atlas/atlas-nutrient-advice"
import { getNutrientsDescription } from "~/components/blocks/nutrient-advice/nutrients"
import { ssrSafeSessionJSONStorage } from "./storage"

interface SelectedAtlasNutrientAdviceState {
  /** Symbol of the selected nutrient, e.g. `"N"` or `"EOC"`. */
  nutrient: string
  /** How the selected nutrient is shown on the map. */
  mode: NutrientAdviceMode
  setNutrient: (nutrient: string) => void
  setMode: (mode: NutrientAdviceMode) => void
}

/**
 * Remembers the nutrient and display mode of the Atlas "Bemestingsadvies" layer, so the selection
 * is kept when the user switches layers or farms. Mirrors `useSelectedAtlasSoilParameterStore`
 * (session storage, validated on rehydrate).
 */
export const useSelectedAtlasNutrientAdviceStore = create<SelectedAtlasNutrientAdviceState>()(
  persist(
    (set) => ({
      nutrient: DEFAULT_NUTRIENT_ADVICE_NUTRIENT,
      mode: DEFAULT_NUTRIENT_ADVICE_MODE,
      setNutrient: (nutrient) => set({ nutrient }),
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "selected-atlas-nutrient-advice-storage",
      storage: createJSONStorage(() => ssrSafeSessionJSONStorage),
      // Only persist the values, not the setters.
      partialize: (state) => ({ nutrient: state.nutrient, mode: state.mode }),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.warn(error)
          }
          if (!state) return
          // Fall back to the defaults when stored values are no longer valid (e.g. after a rename).
          if (!getNutrientsDescription().some((item) => item.symbol === state.nutrient)) {
            state.setNutrient(DEFAULT_NUTRIENT_ADVICE_NUTRIENT)
          }
          if (!isNutrientAdviceMode(state.mode)) {
            state.setMode(DEFAULT_NUTRIENT_ADVICE_MODE)
          }
        }
      },
    },
  ),
)
