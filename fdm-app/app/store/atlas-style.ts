import { createJSONStorage, persist } from "zustand/middleware"
import { create } from "zustand/react"
import { MapStyleVariant } from "~/integrations/map"

interface AtlasStyleStore {
  style: MapStyleVariant
  setStyle: (style: MapStyleVariant) => void
}

export const useAtlasStyle = create<AtlasStyleStore>()(
  persist(
    (set) => ({
      style: "satellite",
      setStyle: (style) => set({ style }),
    }),
    {
      name: "atlasStyle", // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
    },
  ),
)
