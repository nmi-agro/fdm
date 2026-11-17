import { describe, expect, it } from "vitest"
import { Semaphore } from "./semaphore"

describe("Semaphore", () => {
  it("runs at most the given number of operations at the same time", async () => {
    const semaphore = new Semaphore(2)
    let active = 0
    let maxActive = 0
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        await semaphore.acquire()
        try {
          active++
          maxActive = Math.max(maxActive, active)
          await new Promise((resolve) => setTimeout(resolve, 5))
        } finally {
          active--
          semaphore.release()
        }
      }),
    )
    expect(maxActive).toBe(2)
    expect(active).toBe(0)
  })

  it("rejects at once with an aborted signal", async () => {
    const controller = new AbortController()
    controller.abort(new Error("stop"))
    await expect(new Semaphore(1).acquire(controller.signal)).rejects.toThrow("stop")
  })

  it("stops waiting when the signal is aborted, without taking a slot", async () => {
    const semaphore = new Semaphore(1)
    await semaphore.acquire()
    const controller = new AbortController()
    const waiting = semaphore.acquire(controller.signal)
    controller.abort(new Error("stop"))
    await expect(waiting).rejects.toThrow("stop")

    semaphore.release()
    // The slot is free again, so the next caller does not wait.
    await expect(semaphore.acquire()).resolves.toBeUndefined()
  })
})
