import { describe, expect, it } from "vitest"
import { getHerdMoveTargets } from "./herd-moves.server"

const herds = [
  { l_id_herd: "dairy", l_id_category: "rvo_100", l_sex_options: ["female"] },
  { l_id_herd: "dairy-2", l_id_category: "rvo_100", l_sex_options: ["female"] },
  { l_id_herd: "calves", l_id_category: "rvo_101", l_sex_options: ["female", "male"] },
  { l_id_herd: "heifers", l_id_category: "rvo_102", l_sex_options: ["female"] },
  { l_id_herd: "bulls", l_id_category: "rvo_104", l_sex_options: ["male"] },
  { l_id_herd: "beef", l_id_category: "rvo_122", l_sex_options: ["female", "male"] },
  { l_id_herd: "buffalo", l_id_category: "rvo_991", l_sex_options: ["female"] },
]
const ids = (targets: Array<{ l_id_herd: string }>) => targets.map((t) => t.l_id_herd)

describe("getHerdMoveTargets", () => {
  it("offers a herd of the same category and the next life stage, never back or across species", () => {
    expect(ids(getHerdMoveTargets("rvo_100", ["female"], herds))).toEqual(["dairy", "dairy-2"])
    // A water buffalo cow only moves to another water buffalo herd, never to the dairy cows
    expect(ids(getHerdMoveTargets("rvo_991", ["female"], herds))).toEqual(["buffalo"])
    // A young water buffalo bull can join the breeding bulls, a young cow the buffalo cows
    expect(ids(getHerdMoveTargets("rvo_992", ["male"], herds))).toEqual(["bulls"])
    expect(ids(getHerdMoveTargets("rvo_992", ["female"], herds))).toEqual(["buffalo"])
    expect(ids(getHerdMoveTargets("rvo_102", ["female"], herds))).toEqual([
      "dairy",
      "dairy-2",
      "heifers",
    ])
  })

  it("follows the sex of the animal", () => {
    expect(ids(getHerdMoveTargets("rvo_101", ["female"], herds))).toEqual([
      "calves",
      "heifers",
      "beef",
    ])
    expect(ids(getHerdMoveTargets("rvo_101", ["male"], herds))).toEqual(["calves", "bulls", "beef"])
  })

  it("tells which sex an animal of unknown sex gets", () => {
    const targets = getHerdMoveTargets("rvo_101", [null], herds)
    expect(targets).toEqual([
      { l_id_herd: "calves", l_sex_after: null },
      { l_id_herd: "heifers", l_sex_after: "female" },
      { l_id_herd: "bulls", l_sex_after: "male" },
      { l_id_herd: "beef", l_sex_after: null },
    ])
  })

  it("only offers a herd every animal of a group can move to", () => {
    const targets = getHerdMoveTargets("rvo_101", ["male", null], herds)
    expect(targets).toEqual([
      { l_id_herd: "calves", l_sex_after: null },
      { l_id_herd: "bulls", l_sex_after: "male" },
      { l_id_herd: "beef", l_sex_after: null },
    ])
  })

  it("uses the categories only for a herd without animals", () => {
    expect(getHerdMoveTargets("rvo_101", [], herds).map((t) => t.l_sex_after)).toEqual([
      null,
      null,
      null,
      null,
    ])
  })

  it("lets an animal in no herd join any herd that allows its sex", () => {
    expect(ids(getHerdMoveTargets(null, ["male"], herds))).toEqual(["calves", "bulls", "beef"])
    expect(getHerdMoveTargets(null, [null], herds).find((t) => t.l_id_herd === "dairy")).toEqual({
      l_id_herd: "dairy",
      l_sex_after: "female",
    })
  })
})
