import { create } from "zustand"
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware"
import { ssrSafeJSONStorage } from "./storage"

export type CookieConsent = "yes" | "no" | "undecided"

interface CookieConsentState {
  consent: CookieConsent
  isBannerVisible: boolean
  acceptCookies: () => void
  declineCookies: () => void
  resetCookieConsent: () => void
  openCookieSettings: () => void
  closeCookieSettings: () => void
}

type PersistedCookieConsentState = Pick<CookieConsentState, "consent">

// Reuses the pre-Zustand key, which held a bare "yes"/"no" string rather than the JSON blob
// `persist` writes — getItem upgrades that legacy value on read so an existing choice is
// respected instead of re-prompting everyone once. setItem always writes the new JSON format,
// so the legacy format is only ever read once per browser.
const STORAGE_KEY = "cookie_consent"

const cookieConsentStorage: PersistStorage<PersistedCookieConsentState> = {
  getItem: (name) => {
    // ssrSafeJSONStorage is typed against StateStorage's generic (possibly async) signature,
    // but the underlying storage (localStorage, or the SSR no-op stub) is always synchronous.
    const raw = ssrSafeJSONStorage.getItem(name) as string | null
    if (!raw) return null
    if (raw === "yes" || raw === "no") {
      return { state: { consent: raw }, version: 0 }
    }
    try {
      return JSON.parse(raw) as StorageValue<PersistedCookieConsentState>
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    ssrSafeJSONStorage.setItem(name, JSON.stringify(value))
  },
  removeItem: (name) => {
    ssrSafeJSONStorage.removeItem(name)
  },
}

/**
 * Tracks the user's cookie consent choice, persisted to `localStorage`. The banner's visibility
 * is deliberately not persisted: it defaults to open whenever consent is still "undecided" (see
 * `onRehydrateStorage` below), and otherwise stays closed until the user reopens it.
 */
export const useCookieConsentStore = create<CookieConsentState>()(
  persist(
    (set) => ({
      consent: "undecided",
      isBannerVisible: false,
      acceptCookies: () => set({ consent: "yes", isBannerVisible: false }),
      declineCookies: () => set({ consent: "no", isBannerVisible: false }),
      resetCookieConsent: () => set({ consent: "undecided", isBannerVisible: true }),
      openCookieSettings: () => set({ isBannerVisible: true }),
      closeCookieSettings: () => set({ isBannerVisible: false }),
    }),
    {
      name: STORAGE_KEY,
      storage: cookieConsentStorage,
      partialize: (state) => ({ consent: state.consent }),
      onRehydrateStorage: () => (state) => {
        if (state?.consent === "undecided") {
          state.openCookieSettings()
        }
      },
    },
  ),
)
