import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { ssrSafeSessionJSONStorage } from "./storage"

interface OrganizationFarmSelectionState {
    organizationId: string | null
    farmIds: string[]
    setFarmIds: (fieldIds: string[]) => void
    syncOrganization: (id: string, farmIds?: string[]) => void
}

export const useOrganizationFarmSelectionStore =
    create<OrganizationFarmSelectionState>()(
        persist(
            (set, get) => ({
                organizationId: null,
                farmIds: [],
                setFarmIds(farmIds: string[]) {
                    set({ farmIds })
                },
                syncOrganization(
                    organizationId: string,
                    farmIds: string[] = [],
                ) {
                    if (get().organizationId !== organizationId) {
                        set({ organizationId, farmIds: farmIds })
                    }
                },
            }),
            {
                name: "organization-farm-selection-storage", // unique name
                storage: createJSONStorage(() => ssrSafeSessionJSONStorage), // Use SSR-safe storage
            },
        ),
    )
