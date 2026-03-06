import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { ssrSafeSessionJSONStorage } from "./storage"

interface FieldSelectionState {
    farmId: string | null
    fieldIds: string[]
    setFieldIds: (fieldIds: string[]) => void
    syncFarm: (farmId: string) => void
}

export const useFieldSelectionStore = create<FieldSelectionState>()(
    persist(
        (set, get) => ({
            farmId: null,
            fieldIds: [],
            setFieldIds(fieldIds: string[]) {
                set({ fieldIds })
            },
            syncFarm(farmId: string) {
                if (get().farmId !== farmId) {
                    set({ farmId, fieldIds: [] })
                }
            },
        }),
        {
            name: "field-selection-storage", // unique name
            storage: createJSONStorage(() => ssrSafeSessionJSONStorage), // Use SSR-safe storage
        },
    ),
)
