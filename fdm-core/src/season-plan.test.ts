import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmServerType } from "./fdm-server.types"
import {
  enableCultivationCatalogue,
  enableFertilizerCatalogue,
  enableMeasureCatalogue,
  syncMeasuresCatalogueArray,
} from "./catalogues"
import { addCultivation, addCultivationToCatalogue } from "./cultivation"
import { startOfDayInFdmTimeZone } from "./date"
import * as schema from "./db/schema"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import {
  addFertilizer,
  addFertilizerApplication,
  addFertilizerToCatalogue,
  getFertilizerApplications,
} from "./fertilizer"
import { addField } from "./field"
import { createId } from "./id"
import { addMeasure, getMeasures } from "./measure"
import {
  closeOngoingMeasuresOfField,
  copyFertilizerApplications,
  getSeasonPlanProgress,
  getSeasonPlanProposal,
  resolveSeasonPlanTarget,
} from "./season-plan"

// Synthetic fixtures only.
/** Start of a calendar day in Europe/Amsterdam. */
const day = (year: number, month: number, d: number) => startOfDayInFdmTimeZone(year, month, d)

const geometry = {
  type: "Polygon" as const,
  coordinates: [
    [
      [30, 10],
      [40, 40],
      [20, 40],
      [10, 20],
      [30, 10],
    ],
  ],
}

const cultivationDetails = {
  b_lu_name_en: "test",
  b_lu_harvestable: "once",
  b_lu_hcat3: "test-hcat3",
  b_lu_hcat3_name: "test-hcat3-name",
  b_lu_harvestcat: "HC050",
  b_lu_yield: 8000,
  b_lu_dm: 850,
  b_lu_hi: 0.5,
  b_lu_n_harvestable: 20,
  b_lu_n_residue: 5,
  b_n_fixation: 0,
  b_lu_eom: 100,
  b_lu_eom_residue: 50,
  b_lu_rest_oravib: false,
  b_lu_variety_options: null,
  b_lu_start_default: "03-15",
  b_date_harvest_default: "08-15",
  b_lu_ya: null,
} as const

const fertilizerProperties = {
  p_name_nl: "Testmest",
  p_name_en: "Test manure",
  p_description: "Synthetische meststof voor tests",
  p_app_method_options: ["broadcasting"],
  p_app_amount_unit: undefined,
  p_dm: 100,
  p_density: 1,
  p_om: 50,
  p_a: 10,
  p_hc: 10,
  p_eom: 20,
  p_eoc: 10,
  p_c_rt: 30,
  p_c_of: 20,
  p_c_if: 5,
  p_c_fr: 5,
  p_cn_of: 10,
  p_n_rt: 5,
  p_n_if: 1,
  p_n_of: 3,
  p_n_wc: 0.6,
  p_no3_rt: 0,
  p_nh4_rt: 2,
  p_p_rt: 2,
  p_k_rt: 5,
  p_mg_rt: 1,
  p_ca_rt: 2,
  p_ne: 0,
  p_s_rt: 0.5,
  p_s_wc: 0.5,
  p_cu_rt: 0,
  p_zn_rt: 0,
  p_na_rt: 0,
  p_si_rt: 0,
  p_b_rt: 0,
  p_mn_rt: 0,
  p_ni_rt: 0,
  p_fe_rt: 0,
  p_mo_rt: 0,
  p_co_rt: 0,
  p_as_rt: 0,
  p_cd_rt: 0,
  p_cr_rt: 0,
  p_cr_vi: 0,
  p_pb_rt: 0,
  p_hg_rt: 0,
  p_cl_rt: 0,
  p_ef_nh3: null,
  p_type: "manure",
  p_type_rvo: "10",
} as const

describe("Season plan", () => {
  let fdm: FdmServerType
  let principal_id: string
  let b_id_farm: string
  let b_id_kept: string
  let b_id_dropped: string
  let b_id_new: string
  let p_id: string
  let wheat: string
  let grass: string

  /**
   * Adds a field with grassland sown in 2015 without end date, so the cultivation starts before
   * every timeframe used by the season plan and continues into the target year.
   */
  async function addPermanentGrassland() {
    const b_id_grass = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Perceel D",
      "source-d",
      geometry,
      day(2015, 1, 1),
      "nl_01",
    )
    const b_lu_grass = await addCultivation(fdm, principal_id, grass, b_id_grass, day(2015, 3, 1))
    return { b_id_grass, b_lu_grass }
  }

  beforeEach(async () => {
    fdm = createFdmServer(
      inject("host"),
      inject("port"),
      inject("user"),
      inject("password"),
      inject("database"),
    )
    principal_id = createId()
    b_id_farm = await addFarm(fdm, principal_id, "Testbedrijf", "123456", "Teststraat 1", "1234AB")

    const suffix = createId()
    const b_lu_source = `season_plan_${suffix}`
    wheat = `sp_wheat_${suffix}`
    await addCultivationToCatalogue(fdm, {
      ...cultivationDetails,
      b_lu_catalogue: wheat,
      b_lu_source,
      b_lu_name: "Wintertarwe",
      b_lu_croprotation: "cereal",
    })
    grass = `sp_grass_${suffix}`
    await addCultivationToCatalogue(fdm, {
      ...cultivationDetails,
      b_lu_catalogue: grass,
      b_lu_source,
      b_lu_name: "Grasland, blijvend",
      b_lu_croprotation: "grass",
      b_lu_harvestable: "multiple",
      b_lu_harvestcat: "HC020",
    })
    await enableCultivationCatalogue(fdm, principal_id, b_id_farm, b_lu_source)

    b_id_kept = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Perceel A",
      "source-a",
      geometry,
      day(2020, 1, 1),
      "nl_01",
    )
    b_id_dropped = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Perceel B",
      "source-b",
      geometry,
      day(2020, 1, 1),
      "nl_01",
      day(2026, 12, 31),
    )
    b_id_new = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Perceel C",
      "source-c",
      geometry,
      day(2027, 1, 1),
      "nl_01",
    )
    await addCultivation(fdm, principal_id, wheat, b_id_kept, day(2026, 3, 15), day(2026, 8, 15))
    await addCultivation(fdm, principal_id, wheat, b_id_dropped, day(2026, 3, 15), day(2026, 8, 15))

    await enableFertilizerCatalogue(fdm, principal_id, b_id_farm, b_id_farm)
    const p_id_catalogue = await addFertilizerToCatalogue(fdm, principal_id, b_id_farm, {
      ...fertilizerProperties,
      p_app_method_options: [...fertilizerProperties.p_app_method_options],
    })
    p_id = await addFertilizer(fdm, principal_id, p_id_catalogue, b_id_farm, 1000, day(2026, 1, 1))
    await addFertilizerApplication(
      fdm,
      principal_id,
      b_id_kept,
      p_id,
      30,
      "broadcasting",
      new Date("2026-03-01T09:00:00Z"),
    )
  })

  describe("getSeasonPlanProgress", () => {
    it("derives the progress of the target year from the data", async () => {
      const progress = await getSeasonPlanProgress(fdm, principal_id, b_id_farm, 2027)
      expect(progress.targetYear).toBe(2027)
      expect(progress.started).toBe(true)
      expect(progress.complete).toBe(false)
      expect(progress.firstIncompleteStep).toBe("cultivations")
      expect(progress.fieldStatus.get(b_id_kept)).toBe("kept")
      expect(progress.fieldStatus.get(b_id_dropped)).toBe("dropped")
      expect(progress.fieldStatus.get(b_id_new)).toBe("new")
      const cultivations = progress.steps.find((s) => s.step === "cultivations")
      expect(cultivations?.pending.sort()).toEqual([b_id_kept, b_id_new].sort())
    })

    it("marks the cultivation step done once every field has a main cultivation", async () => {
      await addCultivation(fdm, principal_id, wheat, b_id_kept, day(2027, 3, 15), day(2027, 8, 15))
      await addCultivation(fdm, principal_id, wheat, b_id_new, day(2027, 3, 15), day(2027, 8, 15))
      const progress = await getSeasonPlanProgress(fdm, principal_id, b_id_farm, 2027)
      expect(progress.steps.find((s) => s.step === "cultivations")?.done).toBe(true)
      // Harvests are created by addCultivation for crops harvested once
      expect(progress.steps.find((s) => s.step === "harvests")?.done).toBe(true)
      expect(progress.firstIncompleteStep).toBe("fertilizers")
    })

    it("recognises grassland that started before the timeframe and has no end date", async () => {
      const { b_lu_grass, b_id_grass } = await addPermanentGrassland()
      const progress = await getSeasonPlanProgress(fdm, principal_id, b_id_farm, 2027)
      expect(progress.fieldStatus.get(b_id_grass)).toBe("kept")
      const cultivations = progress.steps.find((s) => s.step === "cultivations")
      expect(cultivations?.pending).not.toContain(b_id_grass)
      // Grassland is harvested multiple times, so a harvest in 2027 is expected
      expect(progress.steps.find((s) => s.step === "harvests")?.pending).toContain(b_lu_grass)
      // Grassland is not arable land, so no catch crop is asked for
      expect(progress.steps.find((s) => s.step === "catch_crops")?.notices).not.toContain(
        b_id_grass,
      )
    })

    it("rejects a year that is not an integer", async () => {
      await expect(getSeasonPlanProgress(fdm, principal_id, b_id_farm, 2027.5)).rejects.toThrow()
    })

    it("checks the permission of the principal", async () => {
      await expect(getSeasonPlanProgress(fdm, createId(), b_id_farm, 2027)).rejects.toThrow()
    })
  })

  describe("resolveSeasonPlanTarget", () => {
    it("returns the current year when it is not planned yet", async () => {
      const target = await resolveSeasonPlanTarget(fdm, principal_id, b_id_farm, {
        now: new Date("2026-02-01T12:00:00Z"),
      })
      // The farm has no main cultivation before 2026, so only 2027 can be planned
      expect(target).toEqual({ targetYear: 2027, complete: false, availableYears: [2027] })
    })

    it("returns null when the farm has no history", async () => {
      const target = await resolveSeasonPlanTarget(fdm, principal_id, b_id_farm, {
        now: new Date("2024-06-01T12:00:00Z"),
      })
      expect(target).toBeNull()
    })
  })

  describe("getSeasonPlanProposal", () => {
    it("proposes per field and leaves the crop open when the rotation gives no suggestion", async () => {
      const proposal = await getSeasonPlanProposal(fdm, principal_id, b_id_farm, 2027)
      expect(proposal.droppedFields.map((f) => f.b_id)).toEqual([b_id_dropped])
      const kept = proposal.fields.find((f) => f.b_id === b_id_kept)
      expect(kept?.fieldType).toBe("rotation")
      expect(kept?.sourceYear).toBe(2026)
      expect(kept?.history.map((h) => h.b_lu_catalogue)).toEqual([wheat])
      // Only one year of history: no cycle, and wheat again would get a rotation warning
      expect(kept?.suggested).toBeNull()
      expect(kept?.fertilizerTemplate).toBeNull()
      const added = proposal.fields.find((f) => f.b_id === b_id_new)
      expect(added?.fieldType).toBe("new")
      expect(added?.fertilizerTemplate).toBeNull()
    })

    it("classifies grassland without end date as permanent", async () => {
      const { b_id_grass } = await addPermanentGrassland()
      const proposal = await getSeasonPlanProposal(fdm, principal_id, b_id_farm, 2027)
      const grassField = proposal.fields.find((f) => f.b_id === b_id_grass)
      expect(grassField?.fieldType).toBe("permanent")
      expect(grassField?.sourceYear).toBe(2026)
      expect(grassField?.history.map((h) => h.year)).toEqual([2021, 2022, 2023, 2024, 2025, 2026])
      expect(grassField?.suggested?.b_lu_catalogue).toBe(grass)
      expect(grassField?.current?.b_lu_catalogue).toBe(grass)
      expect(grassField?.continuing).toBe(true)
      expect(grassField?.rotationWarnings).toEqual([])
    })

    it("proposes the fertilizer template of the crop recorded for the target year", async () => {
      await addCultivation(fdm, principal_id, wheat, b_id_kept, day(2027, 3, 15), day(2027, 8, 15))
      const proposal = await getSeasonPlanProposal(fdm, principal_id, b_id_farm, 2027)
      const kept = proposal.fields.find((f) => f.b_id === b_id_kept)
      expect(kept?.current?.b_lu_catalogue).toBe(wheat)
      expect(kept?.rotationWarnings).toEqual([
        { b_lu_croprotation: "cereal", minYearsBetween: 2, lastYear: 2026 },
      ])
      expect(kept?.fertilizerTemplate).toMatchObject({ b_id: b_id_kept, year: 2026 })
      expect(kept?.fertilizerTemplate?.applications).toHaveLength(1)
      expect(kept?.fertilizerTemplate?.applications[0].p_app_date.toISOString()).toBe(
        "2027-03-01T09:00:00.000Z",
      )
    })
  })

  describe("copyFertilizerApplications", () => {
    it("copies the applications to the target year without duplicates", async () => {
      const first = await copyFertilizerApplications(
        fdm,
        principal_id,
        b_id_kept,
        b_id_new,
        2026,
        2027,
      )
      expect(first).toHaveLength(1)
      const second = await copyFertilizerApplications(
        fdm,
        principal_id,
        b_id_kept,
        b_id_new,
        2026,
        2027,
      )
      expect(second).toEqual([])

      const applications = await getFertilizerApplications(fdm, principal_id, b_id_new)
      expect(applications).toHaveLength(1)
      expect(applications[0].p_id).toBe(p_id)
      expect(applications[0].p_app_amount).toBe(30)
      expect(applications[0].p_app_date.toISOString()).toBe("2027-03-01T09:00:00.000Z")
    })

    it("does not copy applications with an amount outside the accepted range", async () => {
      // Older records may hold an amount that is no longer accepted
      await fdm.insert(schema.fertilizerApplication).values({
        p_app_id: createId(),
        b_id: b_id_kept,
        p_id,
        p_app_amount: 0,
        p_app_method: "broadcasting",
        p_app_date: new Date("2026-04-01T09:00:00Z"),
      })
      const copied = await copyFertilizerApplications(
        fdm,
        principal_id,
        b_id_kept,
        b_id_new,
        2026,
        2027,
      )
      expect(copied).toHaveLength(1)
      const applications = await getFertilizerApplications(fdm, principal_id, b_id_new)
      expect(applications.map((a) => a.p_app_amount)).toEqual([30])
    })

    it("refuses to copy between farms", async () => {
      const otherFarm = await addFarm(
        fdm,
        principal_id,
        "Ander bedrijf",
        "654321",
        "Laan 2",
        "4321BA",
      )
      const otherField = await addField(
        fdm,
        principal_id,
        otherFarm,
        "Perceel X",
        "source-x",
        geometry,
        day(2020, 1, 1),
        "nl_01",
      )
      await expect(
        copyFertilizerApplications(fdm, principal_id, b_id_kept, otherField, 2026, 2027),
      ).rejects.toThrow()
    })
  })

  describe("closeOngoingMeasuresOfField", () => {
    beforeEach(async () => {
      await syncMeasuresCatalogueArray(fdm, [
        {
          m_id: "bln_SP1",
          m_source: "bln",
          m_name: "Testmaatregel 1",
          m_description: null,
          m_summary: null,
          m_source_url: null,
          m_conflicts: null,
        },
        {
          m_id: "bln_SP2",
          m_source: "bln",
          m_name: "Testmaatregel 2",
          m_description: null,
          m_summary: null,
          m_source_url: null,
          m_conflicts: null,
        },
        {
          m_id: "bln_SP3",
          m_source: "bln",
          m_name: "Testmaatregel 3",
          m_description: null,
          m_summary: null,
          m_source_url: null,
          m_conflicts: null,
        },
      ])
      await enableMeasureCatalogue(fdm, principal_id, b_id_farm, "bln")
    })

    it("ends ongoing measures and reports measures starting later", async () => {
      const ongoing = await addMeasure(fdm, principal_id, b_id_dropped, "bln_SP1", day(2024, 1, 1))
      const ended = await addMeasure(
        fdm,
        principal_id,
        b_id_dropped,
        "bln_SP2",
        day(2024, 1, 1),
        day(2025, 12, 31),
      )
      const later = await addMeasure(fdm, principal_id, b_id_dropped, "bln_SP3", day(2027, 3, 1))

      const result = await closeOngoingMeasuresOfField(
        fdm,
        principal_id,
        b_id_dropped,
        day(2026, 12, 31),
      )
      expect(result).toEqual({ closed: [ongoing], startingAfterEnd: [later] })

      const measures = await getMeasures(fdm, principal_id, b_id_dropped)
      const byId = new Map(measures.map((m) => [m.b_id_measure, m]))
      expect(byId.get(ongoing)?.m_end?.getTime()).toBe(day(2026, 12, 31).getTime())
      expect(byId.get(ended)?.m_end?.getTime()).toBe(day(2025, 12, 31).getTime())
      expect(byId.get(later)?.m_end).toBeNull()
    })

    it("rejects an invalid date", async () => {
      await expect(
        closeOngoingMeasuresOfField(fdm, principal_id, b_id_dropped, new Date("invalid")),
      ).rejects.toThrow()
    })
  })
})
