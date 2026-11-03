import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { changelogReleases } from "~/lib/changelog"
import { ssrSafeJSONStorage } from "./storage"

interface ChangelogState {
  /** The newest version the user has seen on the changelog page. Persisted. */
  lastSeenVersion: string | null
  /**
   * The newest version for which the user closed the sidebar notification. Persisted. Closing
   * the notification only hides it; it does not mark releases as seen.
   */
  dismissedVersion: string | null
  /** Whether the sidebar notification for a new release should be shown. */
  hasNewUpdates: boolean
  /**
   * The version that was last seen before the changelog page was opened in this browser session.
   * `undefined` until the page has been opened; `null` when no version had been seen before.
   * Not persisted, so it survives client-side navigation but resets on reload.
   */
  versionSeenBeforeVisit: string | null | undefined
  /**
   * Determines whether the notification should be shown. A first-time user (no version seen yet)
   * starts at the latest version, so the notification only appears for later releases.
   */
  initializeChangelog: () => void
  /** Hides the notification until the next release, without marking releases as seen. */
  dismissNotification: () => void
  /** Marks all releases as seen and hides the notification. */
  markAllAsSeen: () => void
  /** Records the previously seen version (once per session) and marks all releases as seen. */
  openChangelog: () => void
}

export const useChangelogStore = create<ChangelogState>()(
  persist(
    (set, get) => ({
      lastSeenVersion: null,
      dismissedVersion: null,
      hasNewUpdates: false,
      versionSeenBeforeVisit: undefined,
      initializeChangelog: () => {
        const latestEntry = changelogReleases[0]
        if (!latestEntry) return
        const { lastSeenVersion, dismissedVersion } = get()
        if (lastSeenVersion === null) {
          set({ lastSeenVersion: latestEntry.version, hasNewUpdates: false })
          return
        }
        set({
          hasNewUpdates:
            latestEntry.version !== lastSeenVersion && latestEntry.version !== dismissedVersion,
        })
      },
      dismissNotification: () => {
        const latestEntry = changelogReleases[0]
        if (latestEntry) {
          set({ dismissedVersion: latestEntry.version, hasNewUpdates: false })
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
      partialize: (state) => ({
        lastSeenVersion: state.lastSeenVersion,
        dismissedVersion: state.dismissedVersion,
      }),
    },
  ),
)
