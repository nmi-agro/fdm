import { describe, expect, it } from "vitest"
import type { CatalogueFeedItem } from "./d"
import { hashFeed } from "./hash"

describe("hashFeed", () => {
  const item: CatalogueFeedItem = {
    f_source: "nmi",
    f_id_catalogue: "nmi_001",
    f_name_nl: "Snijmaïs",
    f_type_rvo: "snijmais",
    f_dm: 360.7,
    f_n_dm: 11.3,
    f_p_dm: 4.5,
  }

  it("is stable for identical items and changes when content changes", async () => {
    expect(await hashFeed({ ...item })).toBe(await hashFeed({ ...item }))
    expect(await hashFeed({ ...item, f_dm: 361 })).not.toBe(await hashFeed({ ...item }))
  })
})
