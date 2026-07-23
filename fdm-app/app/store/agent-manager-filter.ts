import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { ssrSafeSessionJSONStorage } from "./storage"

interface AgentManagerFilterStore {
  activeOnly: boolean
  setActiveOnly: (activeOnly: boolean) => void
}

export const useAgentManagerFilterStore = create<AgentManagerFilterStore>()(
  persist(
    (set) => ({
      activeOnly: false,
      setActiveOnly(value) {
        set({ activeOnly: value })
      },
    }),
    {
      name: "agent-manager-filter",
      storage: createJSONStorage(() => ssrSafeSessionJSONStorage),
    },
  ),
)
