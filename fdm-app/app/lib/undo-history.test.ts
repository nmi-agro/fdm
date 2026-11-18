import { describe, expect, it } from "vitest"
import { pushUndo, UNDO_LIMIT } from "./undo-history"

describe("pushUndo", () => {
  it("adds the step at the end without changing the given history", () => {
    const history = ["a"]
    expect(pushUndo(history, "b")).toEqual(["a", "b"])
    expect(history).toEqual(["a"])
  })

  it("keeps null as a step, such as an empty zone", () => {
    expect(pushUndo<string | null>([], null)).toEqual([null])
  })

  it("drops the oldest steps beyond the limit", () => {
    expect(pushUndo([1, 2, 3], 4, 3)).toEqual([2, 3, 4])
  })

  it("keeps 20 steps by default", () => {
    let history: number[] = []
    for (let step = 0; step < 25; step++) history = pushUndo(history, step)
    expect(UNDO_LIMIT).toBe(20)
    expect(history).toHaveLength(20)
    expect(history[0]).toBe(5)
    expect(history.at(-1)).toBe(24)
  })
})
