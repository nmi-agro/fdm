import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { changelogEntries } from "~/routes/about.whats-new._index"
import { ssrSafeJSONStorage } from "./storage"

interface ChangelogState {
  lastSeenVersion: string | null
  hasNewUpdates: boolean
  latestUpdateTitle: string | null
  latestUpdateVersion: string | null
  initializeChangelog: () => void
  markAllAsSeen: () => void
}

export const useChangelogStore = create<ChangelogState>()(
  persist(
    (set, get) => ({
      lastSeenVersion: null,
      hasNewUpdates: false,
      latestUpdateTitle: null,
      latestUpdateVersion: null,
      initializeChangelog: () => {
        const latestEntry = changelogEntries[0]
        if (latestEntry) {
          const { lastSeenVersion } = get()
          if (latestEntry.version !== lastSeenVersion) {
            set({
              hasNewUpdates: true,
              latestUpdateTitle: latestEntry.title,
              latestUpdateVersion: latestEntry.version,
            })
          } else {
            set({ hasNewUpdates: false })
          }
        }
      },
      markAllAsSeen: () => {
        const latestEntry = changelogEntries[0]
        if (latestEntry) {
          set({
            lastSeenVersion: latestEntry.version,
            hasNewUpdates: false,
          })
        }
      },
    }),
    {
      name: "changelog-storage", // name of the item in localStorage
      storage: createJSONStorage(() => ssrSafeJSONStorage),
      partialize: (state) => ({ lastSeenVersion: state.lastSeenVersion }),
    },
  ),
)
