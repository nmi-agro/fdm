import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { ssrSafeSessionJSONStorage } from "./storage"

interface FieldFilterState {
    farmId: string | null
    showProductiveOnly: boolean
    searchTerms: string
    toggleShowProductiveOnly: () => void
    setSearchTerms: (value: string) => void
    syncFarm: (farmId: string) => void
}

const createFilterStore = (name: string) =>
    create<FieldFilterState>()(
        persist(
            (set, get) => ({
                farmId: null,
                showProductiveOnly: false, // Default to showing all fields
                searchTerms: "",
                toggleShowProductiveOnly: () =>
                    set((state) => ({
                        showProductiveOnly: !state.showProductiveOnly,
                    })),
                setSearchTerms: (value) => {
                    set({
                        searchTerms: value,
                    })
                },
                syncFarm(farmId: string) {
                    if (get().farmId !== farmId) {
                        set({ farmId, searchTerms: "" })
                    }
                },
            }),
            {
                name: name, // unique name
                storage: createJSONStorage(() => ssrSafeSessionJSONStorage), // Use SSR-safe storage
            },
        ),
    )

export const useFieldFilterStore = createFilterStore("field-filter-storage")

export const useRotationFilterStore = createFilterStore(
    "rotation-filter-storage",
)
