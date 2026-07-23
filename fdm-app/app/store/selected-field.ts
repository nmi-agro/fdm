import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { ssrSafeSessionJSONStorage } from "./storage"

interface SelectedFieldState {
  b_id: string | null
  b_name: string | null
  farmId: string | null
  calendar: string | null
  recentFieldIds: string[]
  setSelectedField: (b_id: string | null, b_name: string | null) => void
  addRecentFieldId: (b_id: string) => void
  clearSelectedField: () => void
  syncContext: (farmId: string | undefined, calendar: string | undefined) => void
}

export const useSelectedFieldStore = create<SelectedFieldState>()(
  persist(
    (set, get) => ({
      b_id: null,
      b_name: null,
      farmId: null,
      calendar: null,
      recentFieldIds: [],
      setSelectedField: (b_id, b_name) =>
        set((state) => {
          const nextRecent = state.recentFieldIds.filter((id) => id !== b_id)
          if (b_id) {
            nextRecent.unshift(b_id)
          }
          return {
            b_id,
            b_name,
            recentFieldIds: nextRecent.slice(0, 5),
          }
        }),
      addRecentFieldId: (b_id) =>
        set((state) => {
          const nextRecent = state.recentFieldIds.filter((id) => id !== b_id)
          nextRecent.unshift(b_id)
          return { recentFieldIds: nextRecent.slice(0, 5) }
        }),
      clearSelectedField: () => set({ b_id: null, b_name: null }),
      syncContext: (farmId, calendar) => {
        const current = get()
        const nextFarmId = farmId ?? null
        const nextCalendar = calendar ?? null
        if (current.farmId !== nextFarmId || current.calendar !== nextCalendar) {
          set({
            farmId: nextFarmId,
            calendar: nextCalendar,
            b_id: null,
            b_name: null,
          })
        }
      },
    }),
    {
      name: "selected-field-storage",
      storage: createJSONStorage(() => ssrSafeSessionJSONStorage),
    },
  ),
)
