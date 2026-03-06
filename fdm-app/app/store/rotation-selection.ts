import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { ssrSafeSessionJSONStorage } from "./storage"

interface RotationSelectionState {
    farmId: string | null
    selection: Record<string, Record<string, boolean>>
    updateSelection: (
        selection: Record<string, Record<string, boolean>>,
    ) => void
    syncFarm: (farmId: string) => void
}

export const useRotationSelectionStore = create<RotationSelectionState>()(
    persist(
        (set, get) => ({
            farmId: null,
            selection: {},
            updateSelection(
                selection: Record<string, Record<string, boolean>>,
            ) {
                const currentSelection = get().selection
                const result: Record<string, Record<string, boolean>> = {}
                for (const currentKey of Object.keys(currentSelection)) {
                    result[currentKey] = { ...currentSelection[currentKey] }
                }
                for (const key of Object.keys(selection)) {
                    result[key] = { ...(result[key] ?? {}), ...selection[key] }
                }
                set({ selection: result })
            },
            syncFarm(farmId: string) {
                if (get().farmId !== farmId) {
                    set({ farmId, selection: {} })
                }
            },
        }),
        {
            name: "rotation-selection-storage", // unique name
            storage: createJSONStorage(() => ssrSafeSessionJSONStorage), // Use SSR-safe storage
        },
    ),
)
