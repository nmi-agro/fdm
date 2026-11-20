import { describe, expect, it } from "vitest"
import type { PhosphateBalanceField } from "./types"
import { calculatePhosphateProjection } from "./projection"
import { calculatePhosphateSaturation, calculatePhosphateSaturationThreshold } from "./saturation"
import { assessPhosphateStatus, PHOSPHATE_STATUS_RULES as R } from "./status"

type Scenario = {
  /** Long-term average balance (kg P2O5 / ha / year) */
  balance: number
  /** Long-term average fertilizer supply (kg P2O5 / ha / year) */
  fertilizers?: number
  soil: Parameters<typeof calculatePhosphateSaturation>[0]
  isGrassland?: boolean
}

/** A field balance with only the parts the status uses, from a real saturation and projection. */
function makeBalance({ balance, fertilizers = 0, soil, isGrassland = false }: Scenario) {
  const saturation = calculatePhosphateSaturation(soil, isGrassland)
  const threshold = calculatePhosphateSaturationThreshold(saturation, soil)
  const projection = calculatePhosphateProjection(balance, saturation, threshold, soil, isGrassland)
  return {
    supply: { fertilizers: { total: fertilizers } },
    long_term: { balance, fertilizers, leaching: 0 },
    saturation,
    projection,
  } as unknown as PhosphateBalanceField
}

/** Replaces the PSD threshold of a balance (to set up a case without tuning P-CaCl2). */
function withThreshold(balance: PhosphateBalanceField, value: number): PhosphateBalanceField {
  const psd = balance.projection?.psd
  if (!psd) throw new Error("no PSD")
  psd.threshold = { ...psd.threshold, value, source: "field" }
  return balance
}

/** Measured dekzand with the oxalate triplet: PSC 32.5 mmol/kg, PSD 36.9 %. */
const SAND = {
  a_p_ox: 12,
  a_fe_ox: 29,
  a_al_ox: 36,
  a_density_sa: 1.35,
  a_depth_upper: 0,
  a_depth_lower: 25,
  a_source: "nl-rva-l122",
  b_gwl_class: "VII" as const,
  b_soiltype_agr: "dekzand" as const,
}

describe("assessPhosphateStatus", () => {
  it("should be unknown without a projection", () => {
    const status = assessPhosphateStatus({
      ...makeBalance({ balance: 0, soil: [] }),
      projection: null,
    })
    expect(status.verdict).toBe("unknown")
    expect(status.aim).toBeNull()
  })

  it("should reduce for the environment when the PSD is above the threshold although P-AL is fine", () => {
    // P-AL 37 is fine for the yield, PSD 36.9 % is above a threshold of 30 %
    const balance = withThreshold(
      makeBalance({ balance: -60, soil: [{ ...SAND, a_p_al: 37 }] }),
      30,
    )
    const status = assessPhosphateStatus(balance)
    expect(status.aim).toBe("afbouwen")
    expect(status.binding).toBe("psd")
    expect(status.conflict).toBe(true)
    expect(status.direction).toBe("down")
    expect(status.p_al_min_years).not.toBeNull()
  })

  it("should need attention, not adjustment, when the PSD decreases too slowly without fertilizers", () => {
    const balance = withThreshold(
      makeBalance({ balance: -22, fertilizers: 0, soil: [{ ...SAND, a_p_al: 37 }] }),
      20,
    )
    const status = assessPhosphateStatus(balance)
    expect(status.verdict).toBe("attention")
    expect(status.years?.value).toBeGreaterThan(R.reach_horizon)
    expect(status.has_fertilizer_input).toBe(false)
    expect(status.balance_needed?.limit).toBe("max")
    expect(status.balance_needed?.fertilizers).toBe(0)
  })

  it("should be good when the PSD comes within the margin of the threshold within the reach horizon", () => {
    const balance = withThreshold(
      makeBalance({ balance: -150, soil: [{ ...SAND, a_p_al: 50 }] }),
      30,
    )
    const status = assessPhosphateStatus(balance)
    expect(status.verdict).toBe("good")
    expect(status.conflict).toBe(false)
    expect(status.years?.value).toBeLessThanOrEqual(R.reach_horizon)
    expect(status.balance_needed).toBeNull()
  })

  it("should count a PSD just above the threshold (within the margin) as reached", () => {
    const balance = withThreshold(makeBalance({ balance: 20, soil: [{ ...SAND, a_p_al: 40 }] }), 36)
    const status = assessPhosphateStatus(balance)
    expect(status.direction).toBe("stable")
    expect(status.verdict).toBe("good")
    expect(status.years_class).toBe("reached")
  })

  it("should adjust when the PSD is above the threshold and increases", () => {
    const balance = withThreshold(
      makeBalance({ balance: 100, fertilizers: 140, soil: [{ ...SAND, a_p_al: 50 }] }),
      20,
    )
    const status = assessPhosphateStatus(balance)
    expect(status.verdict).toBe("adjust")
    expect(status.direction).toBe("up")
    expect(status.has_fertilizer_input).toBe(true)
    expect(status.balance_needed?.value).toBeLessThan(0)
  })

  it("should give a needed balance that reaches the margin edge in the reach horizon", () => {
    const balance = withThreshold(
      makeBalance({ balance: 100, fertilizers: 140, soil: [{ ...SAND, a_p_al: 50 }] }),
      20,
    )
    const needed = assessPhosphateStatus(balance).balance_needed
    if (!needed) throw new Error("no needed balance")
    // The fertilizers that give the needed balance at the same removal
    expect(needed.fertilizers).toBeCloseTo(Math.max(0, needed.value - (100 - 140)))
    const after = withThreshold(
      makeBalance({ balance: needed.value, soil: [{ ...SAND, a_p_al: 50 }] }),
      20,
    )
    const psd = after.projection?.psd
    expect((psd?.current.value ?? 0) + (psd?.delta_per_year ?? 0) * R.reach_horizon).toBeCloseTo(
      20 + R.psd_margin,
    )
  })

  it("should build up below the agronomic minimum and never call mining there good", () => {
    const soil = [{ ...SAND, a_p_ox: 3, a_p_al: 18 }]
    const mining = assessPhosphateStatus(withThreshold(makeBalance({ balance: -30, soil }), 30))
    expect(mining.aim).toBe("opbouwen")
    expect(mining.binding).toBe("p_al")
    expect(mining.verdict).toBe("adjust")
    expect(mining.balance_needed?.limit).toBe("min")

    const building = assessPhosphateStatus(withThreshold(makeBalance({ balance: 80, soil }), 30))
    expect(building.direction).toBe("up")
    expect(["good", "attention"]).toContain(building.verdict)
  })

  it("should accept a deficit in the zone when the status stays there for the stay horizon", () => {
    // PSD 9.2 % below a threshold of 30 %, P-AL 60: plenty of room above P-AL 25
    const soil = [{ ...SAND, a_p_ox: 3, a_p_al: 60 }]
    const status = assessPhosphateStatus(withThreshold(makeBalance({ balance: -10, soil }), 30))
    expect(status.aim).toBe("onderhouden")
    expect(status.direction).toBe("down")
    expect(status.verdict).toBe("good")
  })

  it("should warn in the zone when P-AL leaves it within the stay horizon", () => {
    const soil = [{ ...SAND, a_p_ox: 3, a_p_al: 30 }]
    const status = assessPhosphateStatus(withThreshold(makeBalance({ balance: -40, soil }), 30))
    expect(status.aim).toBe("onderhouden")
    expect(status.binding).toBe("p_al")
    expect(status.verdict).not.toBe("good")
    expect(status.balance_needed?.limit).toBe("min")
  })

  it("should flag a PSD above the threshold together with a low P-AL for an advisor", () => {
    const soil = [{ ...SAND, a_p_al: 20 }]
    const status = assessPhosphateStatus(withThreshold(makeBalance({ balance: -20, soil }), 20))
    expect(status.aim).toBe("onderhouden")
    expect(status.conflict).toBe(true)
    expect(status.verdict).toBe("attention")
  })

  it("should fall back to P-AL 25–45 when the PSD is not reliable for the soil type", () => {
    const soil = [{ ...SAND, b_soiltype_agr: "duinzand" as const, a_p_al: 60 }]
    const status = assessPhosphateStatus(makeBalance({ balance: -60, soil }))
    expect(status.aim).toBe("afbouwen")
    expect(status.binding).toBe("p_al")
    expect(status.indicative).toBe(true)
    expect(status.years).not.toBeNull()
  })

  it("should treat a balance that only covers the fixation as stable", () => {
    const soil = [{ ...SAND, a_p_ox: 3, a_p_al: 35 }]
    const status = assessPhosphateStatus(withThreshold(makeBalance({ balance: 20, soil }), 30))
    expect(status.direction).toBe("stable")
    expect(status.verdict).toBe("good")
  })

  it("should mark the judgement as indicative with only NMI estimates", () => {
    const soil = [{ ...SAND, a_source: "nl-other-nmi", a_p_al: 40 }]
    const status = assessPhosphateStatus(withThreshold(makeBalance({ balance: 0, soil }), 30))
    expect(status.indicative).toBe(true)
  })
})
