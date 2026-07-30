/* eslint-disable typescript/unbound-method -- xxhash.h32ToString is a standalone utility function that does not rely on a specific 'this' context. */
import xxhash from "xxhash-wasm"

// Initialize hash function lazily to avoid top-level await
export let h32ToString: (input: string) => string
let initPromise: Promise<void> | null = null

export function ensureInitialized() {
  if (!initPromise) {
    initPromise = xxhash().then((hash) => {
      h32ToString = hash.h32ToString
      return
    })
  }
  return initPromise
}
