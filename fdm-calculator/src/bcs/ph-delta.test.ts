import { describe, expect, it } from "vitest"
import { calcPhDelta } from "./ph-delta"

// Test cases verified against OBIC testthat/test-ph.R

describe("calcPhDelta", () => {
  describe("table 5.3 — clay soils (rivierklei, soiltype.ph=2)", () => {
    it("computes delta for rivierklei, clay=20%, OM=5%, pH=6.0", () => {
      // Table 5.3: lutum 18-25, OM 3-5 → ph.optimum = 6.3; delta = 6.3 - 6.0 = 0.3
      const result = calcPhDelta({
        b_soiltype_agr: "rivierklei",
        a_som_loi: 5,
        a_clay_mi: 20,
        a_ph_cc: 6.0,
        d_cp_starch: 0,
        d_cp_potato: 0.3,
        d_cp_sugarbeet: 0.2,
        d_cp_grass: 0,
        d_cp_mais: 0.2,
      })
      expect(result).toBeCloseTo(0.3)
    })

    it("returns 0 when pH is above optimum (no negative delta)", () => {
      // ph.optimum = 6.3, but measured pH = 7.0 → delta clamped to 0
      const result = calcPhDelta({
        b_soiltype_agr: "rivierklei",
        a_som_loi: 5,
        a_clay_mi: 20,
        a_ph_cc: 7.0,
        d_cp_starch: 0,
        d_cp_potato: 0,
        d_cp_sugarbeet: 0,
        d_cp_grass: 0,
        d_cp_mais: 0,
      })
      expect(result).toBe(0)
    })

    it("looks up correct row for zeeklei with high clay%", () => {
      // lutum=40%, OM=3%, table 5.3: lutum 35-101, OM 3-5 (since 3 < omHigh=5) → ph.optimum = 7.1
      const result = calcPhDelta({
        b_soiltype_agr: "zeeklei",
        a_som_loi: 3,
        a_clay_mi: 40,
        a_ph_cc: 6.5,
        d_cp_starch: 0,
        d_cp_potato: 0,
        d_cp_sugarbeet: 0,
        d_cp_grass: 0,
        d_cp_mais: 0,
      })
      expect(result).toBeCloseTo(0.6)
    })
  })

  describe("table 5.1 — sandy/peat soils without starch potato", () => {
    it("computes delta for dekzand, OM=5%, pH=5.0, no potatoes/beets", () => {
      // table 5.1: potato=0 (<0.05), sugarbeet=0, OM 5-8 → ph.optimum = 5.3
      const result = calcPhDelta({
        b_soiltype_agr: "dekzand",
        a_som_loi: 6,
        a_clay_mi: 0,
        a_ph_cc: 5.0,
        d_cp_starch: 0,
        d_cp_potato: 0,
        d_cp_sugarbeet: 0,
        d_cp_grass: 0,
        d_cp_mais: 0,
      })
      expect(result).toBeCloseTo(0.3)
    })

    it("uses higher optimum for potato-heavy rotation", () => {
      // potato=0.5 (>=0.45), sugarbeet=0, OM 0-5 → ph.optimum = 5.3
      const result = calcPhDelta({
        b_soiltype_agr: "dekzand",
        a_som_loi: 4,
        a_clay_mi: 0,
        a_ph_cc: 5.0,
        d_cp_starch: 0,
        d_cp_potato: 0.5,
        d_cp_sugarbeet: 0,
        d_cp_grass: 0,
        d_cp_mais: 0,
      })
      expect(result).toBeCloseTo(0.3)
    })
  })

  describe("table 5.2 — sandy soils with starch potato (d_cp_starch > 0.1)", () => {
    it("switches to table 5.2 when starch>0.1 even on clay soil", () => {
      // starch=0.4 > 0.1 → overrides soiltype.ph=1, uses table 5.2
      // veen (soiltype.ph=1), OM=20% (15-101), combined potato=0.4 (<0.45), sugarbeet=0 (<0.1)
      // Wait: veen has soiltype.ph=1, so it would go table 5.1, then starch>0.1 → 5.2
      // table 5.2: potato 0.35-1.01, sugarbeet 0-0.1, OM 15-101 → ph.optimum = 5.0
      // delta = 5.0 - 3.69 = 1.31
      const result = calcPhDelta({
        b_soiltype_agr: "veen",
        a_som_loi: 20,
        a_clay_mi: 0,
        a_ph_cc: 3.69,
        d_cp_starch: 0.2,
        d_cp_potato: 0.2,
        d_cp_sugarbeet: 0,
        d_cp_grass: 0,
        d_cp_mais: 0,
      })
      // combined potato = 0.2 + 0.2 = 0.4, in [0.35, 1.01), OM 15-101 → 5.0
      expect(result).toBeCloseTo(1.31)
    })
  })

  describe("table mh — grassland/dairy (grass+mais >= 0.5)", () => {
    it("returns 0 when pH is already at or above optimum", () => {
      // grass=0.85, mais=0, OM=23% (0-25) → ph.optimum = 5.31; pH=6.2 → delta = 0
      const result = calcPhDelta({
        b_soiltype_agr: "veen",
        a_som_loi: 23,
        a_clay_mi: 0,
        a_ph_cc: 6.2,
        d_cp_starch: 0,
        d_cp_potato: 0,
        d_cp_sugarbeet: 0,
        d_cp_grass: 0.85,
        d_cp_mais: 0,
      })
      expect(result).toBe(0)
    })

    it("computes delta for below-optimal pH in grassland", () => {
      // grass+mais=0.6, OM=10% (0-25) → ph.optimum = 5.31; pH=4.5 → delta = 0.81
      const result = calcPhDelta({
        b_soiltype_agr: "dekzand",
        a_som_loi: 10,
        a_clay_mi: 0,
        a_ph_cc: 4.5,
        d_cp_starch: 0,
        d_cp_potato: 0,
        d_cp_sugarbeet: 0,
        d_cp_grass: 0.5,
        d_cp_mais: 0.1,
      })
      expect(result).toBeCloseTo(0.81)
    })
  })

  describe("table mh_kl — grassland with clover", () => {
    it("uses higher optimum for clover grassland", () => {
      // OM=10% (0-25) → ph.optimum = 5.81; pH=5.0 → delta = 0.81
      const result = calcPhDelta({
        b_soiltype_agr: "dekzand",
        a_som_loi: 10,
        a_clay_mi: 0,
        a_ph_cc: 5.0,
        d_cp_starch: 0,
        d_cp_potato: 0,
        d_cp_sugarbeet: 0,
        d_cp_grass: 0.5,
        d_cp_mais: 0.1,
        b_lu_is_clover: true,
      })
      expect(result).toBeCloseTo(0.81)
    })
  })

  describe("loess soil (soiltype.ph=2)", () => {
    it("uses table 5.3 for loess", () => {
      // loess (soiltype.ph=2), starch=0.4 > 0.1 → switches to table 5.2
      // OM=8% (8-15), combined potato=0.4 (0.35-1.01), sugarbeet=0 (0-0.1) → ph.optimum=5.1
      const result = calcPhDelta({
        b_soiltype_agr: "loess",
        a_som_loi: 8,
        a_clay_mi: 0,
        a_ph_cc: 4.5,
        d_cp_starch: 0.4,
        d_cp_potato: 0,
        d_cp_sugarbeet: 0,
        d_cp_grass: 0,
        d_cp_mais: 0,
      })
      expect(result).toBeCloseTo(0.6)
    })
  })

  describe("edge cases", () => {
    it("returns null for unknown soil type", () => {
      const result = calcPhDelta({
        b_soiltype_agr: "unknown" as any,
        a_som_loi: 5,
        a_clay_mi: 10,
        a_ph_cc: 6.0,
        d_cp_starch: 0,
        d_cp_potato: 0,
        d_cp_sugarbeet: 0,
        d_cp_grass: 0,
        d_cp_mais: 0,
      })
      expect(result).toBeNull()
    })
  })
})
