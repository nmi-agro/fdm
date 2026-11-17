/**
 * Limits how many operations run at the same time, for example GeoTIFF raster reads or
 * requests to the NMI API.
 *
 * Call {@link Semaphore.acquire} before the operation and {@link Semaphore.release} after it,
 * also when it fails. A waiting caller can stop waiting with an abort signal.
 */
export class Semaphore {
  private queue: (() => void)[] = []
  private active = 0
  constructor(private maxConcurrent: number) {}

  acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      return Promise.reject(signal.reason)
    }
    if (this.active < this.maxConcurrent) {
      this.active++
      return Promise.resolve()
    }
    return new Promise<void>((resolve, reject) => {
      const onRelease = () => {
        // Slot transfers from the releasing caller — active stays the same.
        signal?.removeEventListener("abort", onAbort)
        resolve()
      }
      const onAbort = () => {
        const idx = this.queue.indexOf(onRelease)
        if (idx !== -1) {
          this.queue.splice(idx, 1)
        }
        // No slot was ever granted, so active is not incremented.
        reject(signal?.reason)
      }
      this.queue.push(onRelease)
      signal?.addEventListener("abort", onAbort, { once: true })
    })
  }

  release(): void {
    const next = this.queue.shift()
    if (next) {
      next()
    } else if (this.active > 0) {
      this.active--
    }
  }
}
