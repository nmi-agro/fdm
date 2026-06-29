import { describe, expect, it } from "vitest"
import type { InputAggregateNormFillingsToFarmLevel, InputAggregateNormsToFarmLevel } from "./farm"
import { aggregateNormFillingsToFarmLevel, aggregateNormsToFarmLevel } from "./farm"

describe("aggregateNormsToFarmLevel", () => {
  it("should correctly aggregate norm values to farm level", () => {
    const fieldData: InputAggregateNormsToFarmLevel = [
      {
        b_id: "field1",
        b_area: 10, // hectares
        norms: {
          manure: { normValue: 100, normSource: "Source A" }, // kg N/ha
          nitrogen: { normValue: 150, normSource: "Source B" }, // kg N/ha
          phosphate: { normValue: 50, normSource: "Source C" }, // kg P2O5/ha
        },
      },
      {
        b_id: "field2",
        b_area: 5, // hectares
        norms: {
          manure: { normValue: 90, normSource: "Source A" }, // kg N/ha
          nitrogen: { normValue: 140, normSource: "Source B" }, // kg N/ha
          phosphate: { normValue: 45, normSource: "Source C" }, // kg P2O5/ha
        },
      },
    ]

    const aggregatedNorms = aggregateNormsToFarmLevel(fieldData)

    expect(aggregatedNorms).toEqual({
      manure: 1450, // (100 * 10) + (90 * 5)
      nitrogen: 2200, // (150 * 10) + (140 * 5)
      phosphate: 725, // (50 * 10) + (45 * 5)
    })
  })

  it("should handle empty input array", () => {
    const fieldData: InputAggregateNormsToFarmLevel = []
    const aggregatedNorms = aggregateNormsToFarmLevel(fieldData)
    expect(aggregatedNorms).toEqual({
      manure: 0,
      nitrogen: 0,
      phosphate: 0,
    })
  })

  it("should handle fields with zero area", () => {
    const fieldData: InputAggregateNormsToFarmLevel = [
      {
        b_id: "field1",
        b_area: 0, // hectares
        norms: {
          manure: { normValue: 100, normSource: "Source A" },
          nitrogen: { normValue: 150, normSource: "Source B" },
          phosphate: { normValue: 50, normSource: "Source C" },
        },
      },
    ]
    const aggregatedNorms = aggregateNormsToFarmLevel(fieldData)
    expect(aggregatedNorms).toEqual({
      manure: 0,
      nitrogen: 0,
      phosphate: 0,
    })
  })
})

describe("aggregateNormFillingsToFarmLevel", () => {
  it("should correctly aggregate norm filling values to farm level", () => {
    const fieldData: InputAggregateNormFillingsToFarmLevel = [
      {
        b_id: "field1",
        b_area: 10, // hectares
        normsFilling: {
          manure: {
            normFilling: 10,
            applicationFilling: [
              { p_app_id: "app1", normFilling: 5 },
              { p_app_id: "app2", normFilling: 5 },
            ],
          },
          nitrogen: {
            normFilling: 20,
            applicationFilling: [
              { p_app_id: "app1", normFilling: 10 },
              { p_app_id: "app2", normFilling: 10 },
            ],
          },
          phosphate: {
            normFilling: 5,
            applicationFilling: [
              { p_app_id: "app1", normFilling: 2 },
              { p_app_id: "app2", normFilling: 3 },
            ],
          },
        },
      },
      {
        b_id: "field2",
        b_area: 5, // hectares
        normsFilling: {
          manure: {
            normFilling: 8,
            applicationFilling: [
              { p_app_id: "app3", normFilling: 4 },
              { p_app_id: "app4", normFilling: 4 },
            ],
          },
          nitrogen: {
            normFilling: 15,
            applicationFilling: [
              { p_app_id: "app3", normFilling: 7 },
              { p_app_id: "app4", normFilling: 8 },
            ],
          },
          phosphate: {
            normFilling: 3,
            applicationFilling: [
              { p_app_id: "app3", normFilling: 1 },
              { p_app_id: "app4", normFilling: 2 },
            ],
          },
        },
      },
    ]

    const aggregatedFillings = aggregateNormFillingsToFarmLevel(fieldData)

    expect(aggregatedFillings.manure).toBe(140) // (10 * 10) + (8 * 5)
    expect(aggregatedFillings.nitrogen).toBe(275) // (20 * 10) + (15 * 5)
    expect(aggregatedFillings.phosphate).toBe(65) // (5 * 10) + (3 * 5)
  })

  it("should handle empty input array for norm fillings", () => {
    const fieldData: InputAggregateNormFillingsToFarmLevel = []
    const aggregatedFillings = aggregateNormFillingsToFarmLevel(fieldData)
    expect(aggregatedFillings).toEqual({
      manure: 0,
      nitrogen: 0,
      phosphate: 0,
    })
  })

  it("should handle fields with zero area for norm fillings", () => {
    const fieldData: InputAggregateNormFillingsToFarmLevel = [
      {
        b_id: "field1",
        b_area: 0, // hectares
        normsFilling: {
          manure: {
            normFilling: 10,
            applicationFilling: [{ p_app_id: "app1", normFilling: 5 }],
          },
          nitrogen: {
            normFilling: 20,
            applicationFilling: [{ p_app_id: "app1", normFilling: 10 }],
          },
          phosphate: {
            normFilling: 5,
            applicationFilling: [{ p_app_id: "app1", normFilling: 2 }],
          },
        },
      },
    ]
    const aggregatedFillings = aggregateNormFillingsToFarmLevel(fieldData)
    expect(aggregatedFillings).toEqual({
      manure: 0,
      nitrogen: 0,
      phosphate: 0,
    })
  })
})
