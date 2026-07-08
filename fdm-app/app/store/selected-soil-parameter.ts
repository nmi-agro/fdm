import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import {
  getShadedSoilParameters,
  type ShadedSoilParameters,
} from "~/components/blocks/atlas/atlas-soil-analysis"
import { ssrSafeSessionJSONStorage } from "./storage"

interface SelectedAtlasSoilParameterState {
  selectedParameter: ShadedSoilParameters
  setSelectedParameter: (selectedParameter: ShadedSoilParameters) => void
}

export const useSelectedAtlasSoilParameterStore = create<SelectedAtlasSoilParameterState>()(
  persist(
    (set) => ({
      selectedParameter: "a_som_loi",
      setSelectedParameter: (selectedParameter) => set({ selectedParameter: selectedParameter }),
    }),
    {
      name: "selected-atlas-soil-parameter-storage",
      storage: createJSONStorage(() => ssrSafeSessionJSONStorage),
      onRehydrateStorage: () => {
        // Returned function will be called after rehydration
        return (state, error) => {
          if (error) {
            console.warn(error)
          }
          // If the stored soil parameter is invalid, set default
          if (
            state &&
            !getShadedSoilParameters().some((item) => item.parameter === state.selectedParameter)
          ) {
            state.setSelectedParameter("a_som_loi")
          }
        }
      },
    },
  ),
)
