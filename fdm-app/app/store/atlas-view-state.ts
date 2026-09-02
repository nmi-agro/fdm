import { createJSONStorage, persist } from "zustand/middleware"
import { create } from "zustand/react"
import { AtlasViewState } from "~/components/blocks/atlas/atlas-viewstate"

interface AtlasViewStateStore {
  viewState: AtlasViewState | undefined
  setViewState: (viewState: AtlasViewState | undefined) => void
}

export const useAtlasViewState = create<AtlasViewStateStore>()(
  persist(
    (set) => ({
      viewState: undefined,
      setViewState: (viewState) => set({ viewState }),
    }),
    {
      name: "mapViewState", // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
    },
  ),
)
