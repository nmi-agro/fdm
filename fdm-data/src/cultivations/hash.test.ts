import { describe, expect, it } from "vitest"
import type { CatalogueCultivationItem } from "./d"
import { hashCultivation } from "./hash"

describe("hashCultivation", () => {
  it("should generate a hash for a cultivation item", async () => {
    const cultivation: CatalogueCultivationItem = {
      b_lu_source: "brp",
      b_lu_catalogue: "test-id",
      b_lu_name: "Test Cultivation",
      b_lu_name_en: "Test Cultivation (EN)",
      b_lu_harvestable: "once",
      b_lu_hcat3: "hcat3",
      b_lu_hcat3_name: "hcat3 name",
      b_lu_croprotation: "other",
      b_lu_harvestcat: "HC010",
      b_lu_yield: 51298,
      b_lu_dm: 500,
      b_lu_hi: 0.85,
      b_lu_eom: 850,
      b_lu_eom_residue: 0,
      b_lu_n_harvestable: 11.3,
      b_lu_n_residue: 19.3,
      b_n_fixation: 0,
      b_lu_rest_oravib: false,
      b_lu_variety_options: null,
      b_lu_start_default: "03-15",
      b_date_harvest_default: "09-15",
      hash: null,
    }

    const hash = await hashCultivation(cultivation)
    expect(hash).toBeDefined()
    expect(typeof hash).toBe("string")
    expect(hash.length).toBeGreaterThan(0)
    expect(hash).toBe("c49afa2d")
  })

  it("should generate different hashes for different cultivation items", async () => {
    const cultivation1: CatalogueCultivationItem = {
      b_lu_source: "brp",
      b_lu_catalogue: "test-id-1",
      b_lu_name: "Test Cultivation 1",
      b_lu_name_en: "Test Cultivation (EN)",
      b_lu_harvestable: "once",
      b_lu_hcat3: "hcat3",
      b_lu_hcat3_name: "hcat3 name",
      b_lu_croprotation: "other",
      b_lu_harvestcat: "HC010",
      b_lu_yield: 51298,
      b_lu_dm: 500,
      b_lu_hi: 0.85,
      b_lu_eom: 850,
      b_lu_eom_residue: 0,
      b_lu_n_harvestable: 11.3,
      b_lu_n_residue: 19.3,
      b_n_fixation: 0,
      b_lu_rest_oravib: false,
      b_lu_variety_options: null,
      b_lu_start_default: "03-15",
      b_date_harvest_default: "09-15",
      hash: null,
    }

    const cultivation2: CatalogueCultivationItem = {
      b_lu_source: "brp",
      b_lu_catalogue: "test-id-2",
      b_lu_name: "Test Cultivation 2", // Different name
      b_lu_name_en: "Test Cultivation (EN)",
      b_lu_harvestable: "once",
      b_lu_hcat3: "hcat3",
      b_lu_hcat3_name: "hcat3 name",
      b_lu_croprotation: "other",
      b_lu_harvestcat: "HC010",
      b_lu_yield: 51298,
      b_lu_dm: 500,
      b_lu_hi: 0.85,
      b_lu_eom: 850,
      b_lu_eom_residue: 0,
      b_lu_n_harvestable: 11.3,
      b_lu_n_residue: 19.3,
      b_n_fixation: 0,
      b_lu_rest_oravib: false,
      b_lu_variety_options: null,
      b_lu_start_default: "03-15",
      b_date_harvest_default: "09-15",
      hash: null,
    }

    const hash1 = await hashCultivation(cultivation1)
    const hash2 = await hashCultivation(cultivation2)

    expect(hash1).not.toBe(hash2)
  })

  it("should generate the same hash for identical cultivation items", async () => {
    const cultivation1: CatalogueCultivationItem = {
      b_lu_source: "brp",
      b_lu_catalogue: "test-id-1",
      b_lu_name: "Test Cultivation 1",
      b_lu_name_en: "Test Cultivation (EN)",
      b_lu_harvestable: "once",
      b_lu_hcat3: "hcat3",
      b_lu_hcat3_name: "hcat3 name",
      b_lu_croprotation: "other",
      b_lu_harvestcat: "HC010",
      b_lu_yield: 51298,
      b_lu_dm: 500,
      b_lu_hi: 0.85,
      b_lu_eom: 850,
      b_lu_eom_residue: 0,
      b_lu_n_harvestable: 11.3,
      b_lu_n_residue: 19.3,
      b_n_fixation: 0,
      b_lu_rest_oravib: false,
      b_lu_variety_options: null,
      b_lu_start_default: "03-15",
      b_date_harvest_default: "09-15",
      hash: null,
    }

    const cultivation2: CatalogueCultivationItem = {
      ...cultivation1,
    }

    const hash1 = await hashCultivation(cultivation1)
    const hash2 = await hashCultivation(cultivation2)

    expect(hash1).toBe(hash2)
  })

  it("should generate different hashes when a string value changes", async () => {
    const cultivation1: CatalogueCultivationItem = {
      b_lu_source: "brp",
      b_lu_catalogue: "test-id-1",
      b_lu_name: "Test Cultivation 1",
      b_lu_name_en: "Test Cultivation (EN)",
      b_lu_harvestable: "once",
      b_lu_hcat3: "hcat3",
      b_lu_hcat3_name: "hcat3 name",
      b_lu_croprotation: "other",
      b_lu_harvestcat: "HC010",
      b_lu_yield: 51298,
      b_lu_dm: 500,
      b_lu_hi: 0.85,
      b_lu_eom: 850,
      b_lu_eom_residue: 0,
      b_lu_n_harvestable: 11.3,
      b_lu_n_residue: 19.3,
      b_n_fixation: 0,
      b_lu_rest_oravib: false,
      b_lu_variety_options: null,
      b_lu_start_default: "03-15",
      b_date_harvest_default: "09-15",
      hash: null,
    }

    const cultivation2: CatalogueCultivationItem = {
      ...cultivation1,
      b_lu_name: "Updated Test Cultivation Name",
    }

    const hash1 = await hashCultivation(cultivation1)
    const hash2 = await hashCultivation(cultivation2)

    expect(hash1).not.toBe(hash2)
  })
  it("should generate different hashes when a null string value is changed", async () => {
    const cultivation1: CatalogueCultivationItem = {
      b_lu_source: "brp",
      b_lu_catalogue: "test-id-1",
      b_lu_name: "Test Cultivation 1",
      b_lu_name_en: null,
      b_lu_harvestable: "once",
      b_lu_hcat3: "hcat3",
      b_lu_hcat3_name: "hcat3 name",
      b_lu_croprotation: "other",
      b_lu_harvestcat: "HC010",
      b_lu_yield: 51298,
      b_lu_dm: 500,
      b_lu_hi: 0.85,
      b_lu_eom: 850,
      b_lu_eom_residue: 0,
      b_lu_n_harvestable: 11.3,
      b_lu_n_residue: 19.3,
      b_n_fixation: 0,
      b_lu_rest_oravib: false,
      b_lu_variety_options: null,
      b_lu_start_default: "03-15",
      b_date_harvest_default: "09-15",
      hash: null,
    }

    const cultivation2: CatalogueCultivationItem = {
      ...cultivation1,
      b_lu_name_en: "Test Cultivation (EN)",
    }

    const hash1 = await hashCultivation(cultivation1)
    const hash2 = await hashCultivation(cultivation2)

    expect(hash1).not.toBe(hash2)
  })

  it("should generate different hashes when a non null string value is changed", async () => {
    const cultivation1: CatalogueCultivationItem = {
      b_lu_source: "brp",
      b_lu_catalogue: "test-id-1",
      b_lu_name: "Test Cultivation 1",
      b_lu_name_en: "Test Cultivation (EN)",
      b_lu_harvestable: "once",
      b_lu_hcat3: "hcat3",
      b_lu_hcat3_name: "hcat3 name",
      b_lu_croprotation: "other",
      b_lu_harvestcat: "HC010",
      b_lu_yield: 51298,
      b_lu_dm: 500,
      b_lu_hi: 0.85,
      b_lu_eom: 850,
      b_lu_eom_residue: 0,
      b_lu_n_harvestable: 11.3,
      b_lu_n_residue: 19.3,
      b_n_fixation: 0,
      b_lu_rest_oravib: false,
      b_lu_variety_options: null,
      b_lu_start_default: "03-15",
      b_date_harvest_default: "09-15",
      hash: null,
    }

    const cultivation2: CatalogueCultivationItem = {
      ...cultivation1,
      b_lu_hcat3_name: null,
    }

    const hash1 = await hashCultivation(cultivation1)
    const hash2 = await hashCultivation(cultivation2)

    expect(hash1).not.toBe(hash2)
  })

  it("should generate different hashes when a array of strings value is changed", async () => {
    const cultivation1: CatalogueCultivationItem = {
      b_lu_source: "brp",
      b_lu_catalogue: "test-id-1",
      b_lu_name: "Test Cultivation 1",
      b_lu_name_en: "Test Cultivation (EN)",
      b_lu_harvestable: "once",
      b_lu_hcat3: "hcat3",
      b_lu_hcat3_name: "hcat3 name",
      b_lu_croprotation: "other",
      b_lu_harvestcat: "HC010",
      b_lu_yield: 51298,
      b_lu_dm: 500,
      b_lu_hi: 0.85,
      b_lu_eom: 850,
      b_lu_eom_residue: 0,
      b_lu_n_harvestable: 11.3,
      b_lu_n_residue: 19.3,
      b_n_fixation: 0,
      b_lu_rest_oravib: false,
      b_lu_variety_options: ["Agria"],
      b_lu_start_default: "03-15",
      b_date_harvest_default: "09-15",
      hash: null,
    }

    const cultivation2: CatalogueCultivationItem = {
      ...cultivation1,
      b_lu_variety_options: null,
    }

    const hash1 = await hashCultivation(cultivation1)
    const hash2 = await hashCultivation(cultivation2)

    expect(hash1).not.toBe(hash2)
  })

  it("should generate different hashes when a enum value changes", async () => {
    const cultivation1: CatalogueCultivationItem = {
      b_lu_source: "brp",
      b_lu_catalogue: "test-id-1",
      b_lu_name: "Test Cultivation 1",
      b_lu_name_en: "Test Cultivation (EN)",
      b_lu_harvestable: "once",
      b_lu_hcat3: "hcat3",
      b_lu_hcat3_name: "hcat3 name",
      b_lu_croprotation: "other",
      b_lu_harvestcat: "HC010",
      b_lu_yield: 51298,
      b_lu_dm: 500,
      b_lu_hi: 0.85,
      b_lu_eom: 850,
      b_lu_eom_residue: 0,
      b_lu_n_harvestable: 11.3,
      b_lu_n_residue: 19.3,
      b_n_fixation: 0,
      b_lu_rest_oravib: false,
      b_lu_variety_options: null,
      b_lu_start_default: "03-15",
      b_date_harvest_default: "09-15",
      hash: null,
    }

    const cultivation2: CatalogueCultivationItem = {
      ...cultivation1,
      b_lu_harvestable: "multiple",
    }

    const cultivation3: CatalogueCultivationItem = {
      ...cultivation1,
      b_lu_croprotation: "grass",
    }

    const hash1 = await hashCultivation(cultivation1)
    const hash2 = await hashCultivation(cultivation2)
    const hash3 = await hashCultivation(cultivation3)

    expect(hash1).not.toBe(hash2)
    expect(hash1).not.toBe(hash3)
  })

  it("should generate different hashes when a boolean value changes", async () => {
    const cultivation1: CatalogueCultivationItem = {
      b_lu_source: "brp",
      b_lu_catalogue: "test-id-1",
      b_lu_name: "Test Cultivation 1",
      b_lu_name_en: "Test Cultivation (EN)",
      b_lu_harvestable: "once",
      b_lu_hcat3: "hcat3",
      b_lu_hcat3_name: "hcat3 name",
      b_lu_croprotation: "other",
      b_lu_harvestcat: "HC010",
      b_lu_yield: 51298,
      b_lu_dm: 500,
      b_lu_hi: 0.85,
      b_lu_eom: 850,
      b_lu_eom_residue: 0,
      b_lu_n_harvestable: 11.3,
      b_lu_n_residue: 19.3,
      b_n_fixation: 0,
      b_lu_rest_oravib: false,
      b_lu_variety_options: null,
      b_lu_start_default: "03-15",
      b_date_harvest_default: "09-15",
      hash: null,
    }

    const cultivation2: CatalogueCultivationItem = {
      ...cultivation1,
      b_lu_rest_oravib: true,
    }

    const hash1 = await hashCultivation(cultivation1)
    const hash2 = await hashCultivation(cultivation2)

    expect(hash1).not.toBe(hash2)
  })
})
