import type { StateStorage } from "zustand/middleware"

const createSSRStorage = (name: keyof Window): StateStorage => {
    if (typeof window !== "undefined") {
        return window[name]
    }

    // Return a no-op storage for SSR
    return {
        getItem: (_name: string) => null,
        setItem: (_name: string, _value: string) => {},
        removeItem: (_name: string) => {},
    }
}

export const ssrSafeJSONStorage = createSSRStorage("localStorage")
export const ssrSafeSessionJSONStorage = createSSRStorage("sessionStorage")
