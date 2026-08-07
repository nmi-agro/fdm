import { describe, expect, it } from "vitest"
import type { CatalogueAnimalCategory } from "./d"
import { hashAnimalCategory } from "./hash"

const category: CatalogueAnimalCategory = {
  l_category_source: "rvo",
  l_id_category: "rvo_100",
  l_category: "100 - Melk- en kalfkoeien",
  l_specie: "cattle",
  l_sex_options: ["female"],
  l_lsu: 1,
}

describe("hashAnimalCategory", () => {
  it("generates a stable hash and ignores a persisted hash", async () => {
    const first = await hashAnimalCategory(category)
    const second = await hashAnimalCategory({ ...category, hash: "existing" })

    expect(first).toBe(second)
    expect(first).toHaveLength(8)
  })

  it("changes when catalogue data changes", async () => {
    const first = await hashAnimalCategory(category)
    const second = await hashAnimalCategory({ ...category, l_lsu: 0.8 })

    expect(first).not.toBe(second)
  })
})
