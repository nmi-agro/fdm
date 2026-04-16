import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { ssrSafeSessionJSONStorage } from "./storage"

type CultivationView = "simple" | "advanced"

interface AtlasFieldViewState {
    cultivationView: CultivationView
    setCultivationView: (view: CultivationView) => void
}

export const useAtlasCultivationHistoryStore = create<AtlasFieldViewState>()(
    persist(
        (set) => ({
            cultivationView: "simple",
            setCultivationView: (view) => set({ cultivationView: view }),
        }),
        {
            name: "atlas-cultivation-history-storage",
            storage: createJSONStorage(() => ssrSafeSessionJSONStorage),
        },
    ),
)
