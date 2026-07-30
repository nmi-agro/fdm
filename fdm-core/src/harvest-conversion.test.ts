import { describe, expect, it } from "vitest"
import { convertHarvestParameters } from "./harvest-conversion"

describe("convertHarvestParameters", () => {
  // Tests for HC010
  describe("HC010 - Standard", () => {
    it("should convert HC010 parameters correctly", () => {
      const result = convertHarvestParameters(
        "HC010",
        undefined,
        undefined,
        10000, // b_lu_yield_fresh
        undefined,
        undefined,
        undefined,
        200, // b_lu_dm
        undefined,
        15, // b_lu_n_harvestable
      )
      expect(result.b_lu_yield).toBe(2000)
      expect(result.b_lu_n_harvestable).toBe(15)
    })

    it("should throw an error for HC010 if required parameters are missing", () => {
      expect(() => convertHarvestParameters("HC010")).toThrow(
        "Missing required parameter for HC010: b_lu_yield_fresh",
      )
    })
  })

  // Tests for HC020
  describe("HC020 - Grassland", () => {
    it("should convert HC020 parameters correctly", () => {
      const result = convertHarvestParameters(
        "HC020",
        5000, // b_lu_yield
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        125, // b_lu_cp
      )
      expect(result.b_lu_yield).toBe(5000)
      expect(result.b_lu_n_harvestable).toBe(20)
    })

    it("should throw an error for HC020 if required parameters are missing", () => {
      expect(() => convertHarvestParameters("HC020")).toThrow(
        "Missing required parameter for HC020: b_lu_yield",
      )
    })
  })

  // Tests for HC031
  describe("HC031 - Maize", () => {
    it("should convert HC031 parameters correctly", () => {
      const result = convertHarvestParameters(
        "HC031",
        15000, // b_lu_yield
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        87.5, // b_lu_cp
      )
      expect(result.b_lu_yield).toBe(15000)
      expect(result.b_lu_n_harvestable).toBe(14)
    })

    it("should throw an error for HC031 if required parameters are missing", () => {
      expect(() => convertHarvestParameters("HC031")).toThrow(
        "Missing required parameter for HC031: b_lu_yield",
      )
    })
  })

  // Tests for HC040
  describe("HC040 - Root crops", () => {
    it("should convert HC040 parameters correctly", () => {
      const result = convertHarvestParameters(
        "HC040",
        undefined,
        60000, // b_lu_yield_bruto
        undefined,
        10, // b_lu_tarra
        undefined,
        undefined,
        250, // b_lu_dm
        undefined,
        20, // b_lu_n_harvestable
      )
      expect(result.b_lu_yield).toBe(13500)
      expect(result.b_lu_n_harvestable).toBe(20)
    })

    it("should throw an error for HC040 if required parameters are missing", () => {
      expect(() => convertHarvestParameters("HC040")).toThrow(
        "Missing required parameter for HC040: b_lu_yield_bruto",
      )
    })
  })

  // Tests for HC041
  describe("HC041 - Sugar beet", () => {
    it("should convert HC041 parameters correctly", () => {
      const result = convertHarvestParameters(
        "HC041",
        undefined,
        80000, // b_lu_yield_bruto
        undefined,
        15, // b_lu_tarra
        undefined,
        undefined,
        230, // b_lu_dm
        undefined,
        18, // b_lu_n_harvestable
      )
      expect(result.b_lu_yield).toBe(15640)
      expect(result.b_lu_n_harvestable).toBe(18)
    })

    it("should throw an error for HC041 if required parameters are missing", () => {
      expect(() => convertHarvestParameters("HC041")).toThrow(
        "Missing required parameter for HC041: b_lu_yield_bruto",
      )
    })
  })

  // Tests for HC042
  describe("HC042 - Potatoes", () => {
    it("should convert HC042 parameters correctly", () => {
      const result = convertHarvestParameters(
        "HC042",
        undefined,
        50000, // b_lu_yield_bruto
        undefined,
        5, // b_lu_tarra
        undefined,
        380, // b_lu_uww
        undefined,
        undefined,
        25, // b_lu_n_harvestable
      )
      expect(result.b_lu_yield).toBeCloseTo(9795)
      expect(result.b_lu_n_harvestable).toBe(25)
    })

    it("should throw an error for HC042 if required parameters are missing", () => {
      expect(() => convertHarvestParameters("HC042")).toThrow(
        "Missing required parameter for HC042: b_lu_yield_bruto",
      )
    })
  })

  // Tests for HC050
  describe("HC050 - Cereals", () => {
    it("should convert HC050 parameters correctly", () => {
      const result = convertHarvestParameters(
        "HC050",
        undefined,
        undefined,
        8000, // b_lu_yield_fresh
        undefined,
        15, // b_lu_moist
        undefined,
        undefined,
        114, // b_lu_cp
      )
      expect(result.b_lu_yield).toBe(6800)
      expect(result.b_lu_n_harvestable).toBe(20)
    })

    it("should throw an error for HC050 if required parameters are missing", () => {
      expect(() => convertHarvestParameters("HC050")).toThrow(
        "Missing required parameter for HC050: b_lu_yield_fresh",
      )
    })
  })
})
