/**
 * The fields table (`farm.$b_id_farm.$calendar.field`) only reads the database, so the sidebar
 * can prefetch it. Its cultivation suggestions, which come from the NMI API, load from the
 * resource route `farm.$b_id_farm.$calendar.cultivation-suggestions`.
 *
 * The NMI lookup is replaced by a stub, so the tests can count the lookups. Only this file
 * imports the resource route, so the mocks apply to it even when another test file in the same
 * worker (`isolate: false`) loaded the real modules first.
 */
import { addField, getField } from "@nmi-agro/fdm-core"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fdm } from "~/lib/fdm.server"
import { loader as suggestionsLoader } from "~/routes/farm.$b_id_farm.$calendar.cultivation-suggestions"
import { loader as fieldsTableLoader } from "~/routes/farm.$b_id_farm.$calendar.field"
import { loaderArgs, runRoute, type SeededUser, seedUserWithFarm } from "../helpers"
import { signInAs } from "../session"

const nmi = vi.hoisted(() => ({ apiKey: "test-key" as string | undefined }))

vi.mock("~/integrations/nmi.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/integrations/nmi.server")>()
  return { ...actual, getNmiApiKey: () => nmi.apiKey }
})

/** Suggests the same crop for every requested field. */
const getCultivationSuggestion = vi.hoisted(() =>
  vi.fn(
    async (_fdm: unknown, _principal: unknown, _farm: unknown, b_ids: string[]) =>
      new Map(
        b_ids.map((b_id) => [
          b_id,
          {
            status: "suggested" as const,
            suggestion: {
              b_lu_catalogue: "nl_265",
              b_lu_name: "Grasland, blijvend",
              b_lu_start: new Date(Date.UTC(2026, 0, 1, 12)),
              b_lu_end: undefined,
            },
          },
        ]),
      ),
  ),
)

vi.mock("~/lib/cultivation-suggestion.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/cultivation-suggestion.server")>()
  return { ...actual, getCultivationSuggestionResultsForFarm: getCultivationSuggestion }
})

let owner: SeededUser
let stranger: SeededUser
let calendar: string
/** A field without any cultivation, so it has no main cultivation. */
let bareField: string

beforeAll(async () => {
  owner = await seedUserWithFarm("suggestions")
  stranger = await seedUserWithFarm("stranger")
  calendar = String(owner.ids.year)

  const seededField = Object.values(owner.ids.fields).find((b_id): b_id is string => !!b_id)
  if (!seededField) throw new Error("The seed has no fields")
  const { b_geometry } = await getField(fdm, owner.user.id, seededField)
  bareField = await addField(
    fdm,
    owner.user.id,
    owner.ids.farm,
    "Perceel zonder gewas",
    null,
    b_geometry,
    new Date(Date.UTC(owner.ids.year - 1, 0, 1, 12)),
    "nl_01",
  )
})

beforeEach(() => {
  nmi.apiKey = "test-key"
  getCultivationSuggestion.mockClear()
})

function tableArgs() {
  return loaderArgs(`/farm/${owner.ids.farm}/${calendar}/field`, {
    b_id_farm: owner.ids.farm,
    calendar,
  })
}

function suggestionsArgs() {
  return loaderArgs(`/farm/${owner.ids.farm}/${calendar}/cultivation-suggestions`, {
    b_id_farm: owner.ids.farm,
    calendar,
  })
}

describe("fields table", () => {
  it("does not look up suggestions, and asks the page to load them", async () => {
    signInAs(owner.user)
    const { status, data } = await runRoute(() => fieldsTableLoader(tableArgs()))
    expect(status).toBe(200)
    expect(getCultivationSuggestion).not.toHaveBeenCalled()

    const result = data as {
      loadCultivationSuggestions: boolean
      fieldsExtended: {
        b_id: string
        missingMainCultivation: boolean
        cultivationSuggestion?: unknown
      }[]
    }
    expect(result.loadCultivationSuggestions).toBe(true)
    expect(result.fieldsExtended.every((field) => !field.cultivationSuggestion)).toBe(true)
    // Only the field without a crop may show a suggestion
    expect(
      result.fieldsExtended.filter((field) => field.missingMainCultivation).map((f) => f.b_id),
    ).toEqual([bareField])
  })
})

describe("cultivation suggestions", () => {
  it("suggests a cultivation only for fields without a main cultivation", async () => {
    signInAs(owner.user)
    const { status, data } = await runRoute(() => suggestionsLoader(suggestionsArgs()))
    expect(status).toBe(200)

    const { suggestions } = data as { suggestions: Record<string, { b_lu_catalogue: string }> }
    expect(Object.keys(suggestions)).toEqual([bareField])
    expect(suggestions[bareField].b_lu_catalogue).toBe("nl_265")
    // One lookup for the farm, with only the field without a main cultivation
    expect(getCultivationSuggestion).toHaveBeenCalledTimes(1)
    expect(getCultivationSuggestion.mock.calls[0][3]).toEqual([bareField])
  })

  it("returns no suggestions without an NMI API key", async () => {
    nmi.apiKey = undefined
    signInAs(owner.user)
    const { data } = await runRoute(() => suggestionsLoader(suggestionsArgs()))
    expect(data).toEqual({ suggestions: {} })
    expect(getCultivationSuggestion).not.toHaveBeenCalled()
  })

  it("gives a user without access to the farm no suggestions", async () => {
    // The suggestions are optional, so a refused read gives an empty list instead of an error
    // page over the fields table
    signInAs(stranger.user)
    const { status, data } = await runRoute(() => suggestionsLoader(suggestionsArgs()))
    expect(status).toBe(200)
    expect(data).toEqual({ suggestions: {} })
    expect(getCultivationSuggestion).not.toHaveBeenCalled()
  })
})
