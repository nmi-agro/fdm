import { create } from "zustand"

interface FarmState {
  farmId: string | undefined
  setFarmId: (farmId: string | undefined) => void
}

export const useFarmStore = create<FarmState>((set) => ({
  farmId: undefined, // Initial farmId is undefined
  setFarmId: (farmId) => set({ farmId }),
}))
