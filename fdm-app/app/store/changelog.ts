import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { changelogReleases } from "~/lib/changelog"
import { ssrSafeJSONStorage } from "./storage"

interface ChangelogState {
  lastSeenVersion: string | null
  hasNewUpdates: boolean
  latestUpdateTitle: string | null
  latestUpdateVersion: string | null
  /**
   * The version that was last seen before the changelog page was opened in this browser session.
   * `undefined` until the page has been opened; `null` when no version had been seen before.
   * Not persisted, so it survives client-side navigation but resets on reload.
   */
  versionSeenBeforeVisit: string | null | undefined
  initializeChangelog: () => void
  markAllAsSeen: () => void
  /** Records the previously seen version (once per session) and marks all releases as seen. */
  openChangelog: () => void
}

export const useChangelogStore = create<ChangelogState>()(
  persist(
    (set, get) => ({
      lastSeenVersion: null,
      hasNewUpdates: false,
      latestUpdateTitle: null,
      latestUpdateVersion: null,
      versionSeenBeforeVisit: undefined,
      initializeChangelog: () => {
        const latestEntry = changelogReleases[0]
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
        const latestEntry = changelogReleases[0]
        if (latestEntry) {
          set({
            lastSeenVersion: latestEntry.version,
            hasNewUpdates: false,
          })
        }
      },
      openChangelog: () => {
        if (get().versionSeenBeforeVisit === undefined) {
          set({ versionSeenBeforeVisit: get().lastSeenVersion })
        }
        get().markAllAsSeen()
      },
    }),
    {
      name: "changelog-storage", // name of the item in localStorage
      storage: createJSONStorage(() => ssrSafeJSONStorage),
      partialize: (state) => ({ lastSeenVersion: state.lastSeenVersion }),
    },
  ),
)
