import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import type { NitrogenBalanceFieldInput } from "./types"
import { currentSoilDataFixture } from "../shared/soil.test-helpers"
import { calculateNitrogenBalanceField } from "./field"

describe("calculateNitrogenBalanceField with nitrous oxide", () => {
  const input: NitrogenBalanceFieldInput = {
    fieldInput: {
      field: {
        b_id: "field1",
        b_centroid: [5.0, 52.0],
        b_area: 10,
        b_start: new Date("2025-01-01"),
        b_end: null,
        b_bufferstrip: false,
      },
      cultivations: [
        {
          b_lu: "cultivation1",
          b_lu_catalogue: "catalogue1",
          m_cropresidue: true,
          b_lu_start: new Date("2025-01-01"),
          b_lu_end: new Date("2025-08-15"),
          b_lu_name: "Wintertarwe",
          b_lu_croprotation: "cereal",
        },
      ],
      harvests: [],
      currentSoilData: currentSoilDataFixture({
        b_soiltype_agr: "dekzand",
        b_gwl_class: "V",
        a_c_of: 20,
        a_cn_fr: 10,
        a_density_sa: 1.2,
        a_n_rt: 2000,
        a_som_loi: 4,
      }),
      fertilizerApplications: [
        {
          p_app_id: "app1",
          p_id_catalogue: "slurry",
          p_app_amount: 30000,
          p_app_date: new Date("2025-03-15"),
          p_app_method: "injection",
          p_name_nl: "Rundveedrijfmest",
          p_id: "fertilizer1",
        },
      ],
      depositionSupply: { total: new Decimal(20) },
    },
    fertilizerDetails: [
      {
        p_id_catalogue: "slurry",
        p_type: "manure",
        p_n_rt: 4.1,
        p_no3_rt: 0,
        p_nh4_rt: 1.9,
        p_s_rt: 0,
        p_ef_nh3: null,
      },
    ],
    cultivationDetails: [
      {
        b_lu_catalogue: "catalogue1",
        b_lu_croprotation: "cereal",
        b_lu_yield: 7000,
        b_lu_hi: 0.5,
        b_lu_n_harvestable: 20,
        b_lu_n_residue: 5,
        b_n_fixation: 0,
      },
    ],
    timeFrame: { start: new Date("2025-01-01"), end: new Date("2025-12-31") },
  }

  it("includes the N2O emission in the total emission, but not in the balance", () => {
    const result = calculateNitrogenBalanceField(input)
    const { emission } = result

    expect(emission.nitrous_oxide.total).toBeLessThan(0)
    // The total emission is the sum of its parts as they are shown: ammonia and nitrate as whole
    // numbers, N2O with one decimal
    const nitrousOxideShown = new Decimal(emission.nitrous_oxide.total)
      .toDecimalPlaces(1)
      .toNumber()
    const sum = emission.ammonia.total + emission.nitrate.total + nitrousOxideShown
    expect(emission.total).toBeCloseTo(sum, 10)
    // The balance is supply + removal + ammonia, without nitrate and N2O
    const balance = result.supply.total + result.removal.total + emission.ammonia.total
    expect(Math.abs(result.balance - balance)).toBeLessThanOrEqual(1)
  })
})
