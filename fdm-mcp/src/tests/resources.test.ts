/**
 * Tests for the resource templates of farms and fields.
 */
import { describe, expect, it, vi } from "vitest"
import { connect, makeApp } from "./helpers"

describe("resources", () => {
  it("lists the farm and field templates", async () => {
    const { app } = makeApp()
    const client = await connect(app)
    const { resourceTemplates } = await client.listResourceTemplates()
    expect(resourceTemplates.map((template) => template.uriTemplate)).toEqual([
      "fdm://farms/{b_id_farm}",
      "fdm://fields/{b_id_field}",
    ])
    await client.close()
  })

  it("reads a farm as JSON through the same operation as get_farm", async () => {
    const getFarm = vi.fn().mockResolvedValue({
      b_id_farm: "farm-1",
      b_name_farm: "Proefbedrijf",
      b_businessid_farm: null,
      b_address_farm: null,
      b_postalcode_farm: null,
    })
    const { app } = makeApp({ getFarm })
    const client = await connect(app)
    const result = await client.readResource({ uri: "fdm://farms/farm-1" })
    expect(result.contents[0]?.mimeType).toBe("application/json")
    expect(JSON.parse((result.contents[0] as { text: string }).text)).toMatchObject({
      b_id_farm: "farm-1",
      b_name_farm: "Proefbedrijf",
    })
    expect(getFarm).toHaveBeenCalledWith(expect.anything(), "user-1", "farm-1")
    await client.close()
  })

  it("reports a missing field as resource not found", async () => {
    const { app } = makeApp({ getField: vi.fn().mockResolvedValue(undefined) })
    const client = await connect(app)
    await expect(client.readResource({ uri: "fdm://fields/field-x" })).rejects.toThrow()
    await client.close()
  })
})
