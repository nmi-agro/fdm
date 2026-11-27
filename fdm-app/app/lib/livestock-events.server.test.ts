import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("~/lib/fdm.server", () => ({ fdm: {} }))
vi.mock("@nmi-agro/fdm-core", () => ({
  addAnimal: vi.fn(),
  addAnimalsToHerd: vi.fn(),
  createHerdWithAnimals: vi.fn(),
  getAnimalCategoriesForFarm: vi.fn(),
  reassignHerdAnimals: vi.fn(),
  removeAnimalsFromHerd: vi.fn(),
  removeHerd: vi.fn(),
  updateHerd: vi.fn(),
}))

const { getAnimalCategoriesForFarm, removeHerd } = await import("@nmi-agro/fdm-core")
const { handleLivestockEvent, isLivestockIntent, parseAnimalCount } =
  await import("./livestock-events.server")

const context = { principal_id: "user-1", b_id_farm: "0123456789abcdef" }

function form(fields: Record<string, string>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) formData.append(key, value)
  return formData
}

describe("handleLivestockEvent", () => {
  beforeEach(() => {
    vi.mocked(getAnimalCategoriesForFarm).mockResolvedValue([])
    vi.mocked(removeHerd).mockResolvedValue(undefined as never)
  })

  it("rejects an add_herd without an animal category", async () => {
    await expect(handleLivestockEvent(form({ intent: "add_herd" }), context)).rejects.toMatchObject(
      { data: "Kies een diercategorie", init: { status: 400 } },
    )
  })

  it("rejects a non-grazing animal category", async () => {
    await expect(
      handleLivestockEvent(form({ intent: "add_herd", l_id_category: "rvo_400" }), context),
    ).rejects.toMatchObject({
      data: "Kies een diercategorie voor weidegang.",
      init: { status: 400 },
    })
  })

  it("rejects an unknown intent", async () => {
    await expect(handleLivestockEvent(form({ intent: "nope" }), context)).rejects.toMatchObject({
      data: "Ongeldige actie",
      init: { status: 400 },
    })
  })

  it("removes a herd", async () => {
    await handleLivestockEvent(form({ intent: "remove_herd", l_id_herd: "herd-1" }), context)
    expect(removeHerd).toHaveBeenCalledWith({}, "user-1", "herd-1")
  })

  it("does nothing when the count did not change", async () => {
    const result = await handleLivestockEvent(
      form({ intent: "update_count", l_id_herd: "herd-1", target_count: "5", previous_count: "5" }),
      context,
    )
    expect(result).toEqual({ success: true })
  })
})

describe("parseAnimalCount", () => {
  it("accepts whole numbers from 1 to 5000", () => {
    expect(parseAnimalCount("1")).toBe(1)
    expect(parseAnimalCount("5000")).toBe(5000)
  })

  it.each(["0", "5001", "1.5", "abc", ""])("rejects %j", (value) => {
    expect(() => parseAnimalCount(value)).toThrowError()
  })
})

describe("isLivestockIntent", () => {
  it("recognises livestock intents only", () => {
    expect(isLivestockIntent("add_herd")).toBe(true)
    expect(isLivestockIntent("delete_everything")).toBe(false)
    expect(isLivestockIntent(undefined)).toBe(false)
  })
})
