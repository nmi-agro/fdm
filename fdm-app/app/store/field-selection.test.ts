import { beforeEach, describe, expect, it } from "vitest"
import { useFieldFilterStore } from "./field-filter"
import { useFieldSelectionStore } from "./field-selection"

// Outside a browser the stores persist to a no-op storage, so they can be used directly.

describe("useFieldSelectionStore", () => {
  beforeEach(() => {
    useFieldSelectionStore.setState({ farmId: null, fieldIds: [] })
  })

  it("keeps the selection while the farm stays the same", () => {
    const store = useFieldSelectionStore.getState()
    store.syncFarm("farm-a")
    store.setFieldIds(["field-1", "field-2"])
    useFieldSelectionStore.getState().syncFarm("farm-a")
    expect(useFieldSelectionStore.getState().fieldIds).toEqual(["field-1", "field-2"])
  })

  it("clears the selection when another farm is opened", () => {
    const store = useFieldSelectionStore.getState()
    store.syncFarm("farm-a")
    store.setFieldIds(["field-1"])
    useFieldSelectionStore.getState().syncFarm("farm-b")
    expect(useFieldSelectionStore.getState()).toMatchObject({ farmId: "farm-b", fieldIds: [] })
  })
})

describe("useFieldFilterStore", () => {
  beforeEach(() => {
    useFieldFilterStore.setState({ farmId: null, showProductiveOnly: false, searchTerms: "" })
  })

  it("toggles the productive-only filter", () => {
    useFieldFilterStore.getState().toggleShowProductiveOnly()
    expect(useFieldFilterStore.getState().showProductiveOnly).toBe(true)
    useFieldFilterStore.getState().toggleShowProductiveOnly()
    expect(useFieldFilterStore.getState().showProductiveOnly).toBe(false)
  })

  it("clears the search terms, but not the filter, when another farm is opened", () => {
    const store = useFieldFilterStore.getState()
    store.syncFarm("farm-a")
    store.setSearchTerms("akker")
    store.toggleShowProductiveOnly()
    useFieldFilterStore.getState().syncFarm("farm-b")
    expect(useFieldFilterStore.getState()).toMatchObject({
      farmId: "farm-b",
      searchTerms: "",
      showProductiveOnly: true,
    })
  })
})
