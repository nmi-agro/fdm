import type * as GeoJSON from "geojson"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmServerType } from "./fdm-server.types"
import type { CurrentSoilData } from "./soil.types"
import * as schema from "./db/schema"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addField } from "./field"
import { createId } from "./id"
import {
  addSoilAnalysis,
  getCurrentSoilData,
  getCurrentSoilDataForFarm,
  getCurrentSoilDataPerZone,
  getSoilAnalyses,
  getSoilAnalysesForFarm,
  getSoilAnalysis,
  getSoilParametersDescription,
  removeSoilAnalysis,
  updateSoilAnalysis,
} from "./soil"

type Polygon = schema.fieldsTypeInsert["b_geometry"]

describe("Soil Analysis Functions", () => {
  let fdm: FdmServerType
  let b_id: string
  let test_a_id: string
  let principal_id: string

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")
    fdm = createFdmServer(host, port, user, password, database)

    // Create test field and analyses before each test
    const farmName = "Test Farm"
    const farmBusinessId = "123456"
    const farmAddress = "123 Farm Lane"
    const farmPostalCode = "12345"
    principal_id = createId()
    const b_id_farm = await addFarm(
      fdm,
      principal_id,
      farmName,
      farmBusinessId,
      farmAddress,
      farmPostalCode,
    )

    const fieldName = "Test Field"
    const fieldIDSource = "test-field-id"
    const fieldGeometry: Polygon = {
      type: "Polygon",
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
    const AcquireDate = new Date("2023-01-01")
    const DiscardingDate = new Date("2023-12-31")
    const acquiringMethod = "nl_01"
    b_id = await addField(
      fdm,
      principal_id,
      b_id_farm,
      fieldName,
      fieldIDSource,
      fieldGeometry,
      AcquireDate,
      acquiringMethod,
      DiscardingDate,
    )
  })

  it("should add a new soil analysis", async () => {
    const a_date = new Date()
    const a_source = "other"
    const a_depth_lower = 30
    const b_sampling_date = new Date()
    // const b_sampling_geometry = 'MULTIPOINT((0 0))'
    const a_p_al = 5
    const a_p_cc = 5
    const b_soiltype_agr = "rivierklei"
    const b_gwl_class = "II"

    test_a_id = await addSoilAnalysis(
      fdm,
      principal_id,
      a_date,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date,
      {
        a_p_al: a_p_al,
        a_p_cc: a_p_cc,
        b_soiltype_agr: b_soiltype_agr,
        b_gwl_class: b_gwl_class,
      },
    )

    expect(test_a_id).toBeDefined()

    const addedAnalysis = await fdm
      .select()
      .from(schema.soilAnalysis)
      .where(eq(schema.soilAnalysis.a_id, test_a_id))
      .limit(1)
    expect(addedAnalysis).toHaveLength(1)
    expect(addedAnalysis[0].a_date).toEqual(a_date)
    expect(addedAnalysis[0].a_source).toEqual(a_source)
    expect(addedAnalysis[0].a_p_al).toEqual(a_p_al)
    expect(addedAnalysis[0].a_p_cc).toEqual(a_p_cc)
    expect(addedAnalysis[0].b_soiltype_agr).toEqual(b_soiltype_agr)
    expect(addedAnalysis[0].b_gwl_class).toEqual(b_gwl_class)

    const addedSampling = await fdm
      .select()
      .from(schema.soilSampling)
      .where(eq(schema.soilSampling.a_id, test_a_id))
      .limit(1)

    expect(addedSampling).toHaveLength(1)
    expect(addedSampling[0].b_id).toEqual(b_id)
    expect(addedSampling[0].b_sampling_date).toEqual(b_sampling_date)
    expect(addedSampling[0].a_depth_lower).toEqual(a_depth_lower)
    expect(addedSampling[0].a_depth_upper).toEqual(0)
  })

  it("should throw an error if lower depth is greater than upper depth", async () => {
    const a_date = new Date()
    const a_source = "other"
    const a_depth_lower = 30
    const a_depth_upper = 60
    const b_sampling_date = new Date()
    // const b_sampling_geometry = 'MULTIPOINT((0 0))'
    const a_p_al = 5
    const a_p_cc = 5
    const b_soiltype_agr = "rivierklei"
    const b_gwl_class = "II"

    await expect(
      addSoilAnalysis(
        fdm,
        principal_id,
        a_date,
        a_source,
        b_id,
        a_depth_lower,
        b_sampling_date,
        {
          a_p_al: a_p_al,
          a_p_cc: a_p_cc,
          b_soiltype_agr: b_soiltype_agr,
          b_gwl_class: b_gwl_class,
        },
        a_depth_upper,
      ),
    ).rejects.toThrowError("Exception for addSoilAnalysis")
  })

  it("should add a new soil analysis with upper and lower depth", async () => {
    const a_date = new Date()
    const a_source = "other"
    const a_depth_lower = 60
    const a_depth_upper = 30
    const b_sampling_date = new Date()
    // const b_sampling_geometry = 'MULTIPOINT((0 0))'
    const a_p_al = 5
    const a_p_cc = 5
    const b_soiltype_agr = "rivierklei"
    const b_gwl_class = "II"

    test_a_id = await addSoilAnalysis(
      fdm,
      principal_id,
      a_date,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date,
      {
        a_p_al: a_p_al,
        a_p_cc: a_p_cc,
        b_soiltype_agr: b_soiltype_agr,
        b_gwl_class: b_gwl_class,
      },
      a_depth_upper,
    )

    expect(test_a_id).toBeDefined()

    const addedSampling = await fdm
      .select()
      .from(schema.soilSampling)
      .where(eq(schema.soilSampling.a_id, test_a_id))
      .limit(1)

    expect(addedSampling).toHaveLength(1)
    expect(addedSampling[0].b_id).toEqual(b_id)
    expect(addedSampling[0].b_sampling_date).toEqual(b_sampling_date)
    expect(addedSampling[0].a_depth_lower).toEqual(a_depth_lower)
    expect(addedSampling[0].a_depth_upper).toEqual(a_depth_upper)
  })

  // Test updating existing soil data

  it("should update an existing soil analysis", async () => {
    const a_date = new Date()
    const a_source = "other"
    const a_depth_lower = 30
    const b_sampling_date = new Date("2025-02-01")
    // const b_sampling_geometry = 'MULTIPOINT((0 0))'

    test_a_id = await addSoilAnalysis(
      fdm,
      principal_id,
      a_date,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date,
    )

    // Test updating existing soil data
    await updateSoilAnalysis(fdm, principal_id, test_a_id, {
      a_n_rt: 1000,
    })

    const updatedAnalysis = await fdm
      .select()
      .from(schema.soilAnalysis)
      .where(eq(schema.soilAnalysis.a_id, test_a_id))
      .limit(1)
    expect(updatedAnalysis[0].a_n_rt).toEqual(1000)
  })

  it("should update sampling date, depth and clear a score", async () => {
    test_a_id = await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2025-02-01"),
      "other",
      b_id,
      25,
      new Date("2025-02-01"),
      { a_ss_bcs: 2, a_rd_bcs: 1 },
    )

    const newSamplingDate = new Date("2025-03-15")
    await updateSoilAnalysis(fdm, principal_id, test_a_id, {
      a_date: newSamplingDate,
      b_sampling_date: newSamplingDate,
      a_depth_lower: 40,
      a_ss_bcs: 0,
      a_rd_bcs: null,
    })

    const [analysis] = await fdm
      .select()
      .from(schema.soilAnalysis)
      .where(eq(schema.soilAnalysis.a_id, test_a_id))
    const [sampling] = await fdm
      .select()
      .from(schema.soilSampling)
      .where(eq(schema.soilSampling.a_id, test_a_id))

    expect(analysis.a_date).toEqual(newSamplingDate)
    expect(analysis.a_ss_bcs).toEqual(0)
    expect(analysis.a_rd_bcs).toBeNull()
    expect(sampling.b_sampling_date).toEqual(newSamplingDate)
    expect(sampling.a_depth_lower).toEqual(40)
  })

  it("should reject an a_depth_lower that is not below a_depth_upper", async () => {
    test_a_id = await addSoilAnalysis(fdm, principal_id, new Date(), "other", b_id, 30, new Date())

    await expect(
      updateSoilAnalysis(fdm, principal_id, test_a_id, { a_depth_lower: 0 }),
    ).rejects.toThrowError("Exception for updateSoilAnalysis")
  })

  it("should not allow updating a soil analysis without write permission", async () => {
    test_a_id = await addSoilAnalysis(fdm, principal_id, new Date(), "other", b_id, 30, new Date())

    await expect(
      updateSoilAnalysis(fdm, createId(), test_a_id, { b_sampling_date: new Date() }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")
  })

  // Test removing existing soil data
  it("should remove an existing soil analysis", async () => {
    const a_date = new Date()
    const a_source = "other"
    const a_depth_lower = 30
    const b_sampling_date = new Date()
    // const b_sampling_geometry = 'MULTIPOINT((0 0))'

    test_a_id = await addSoilAnalysis(
      fdm,
      principal_id,
      a_date,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date,
    )

    // Test removing existing soil data
    await removeSoilAnalysis(fdm, principal_id, test_a_id)

    const removedAnalysis = await fdm
      .select()
      .from(schema.soilAnalysis)
      .where(eq(schema.soilAnalysis.a_id, test_a_id))
    expect(removedAnalysis).toHaveLength(0)

    const removedSampling = await fdm
      .select()
      .from(schema.soilSampling)
      .where(eq(schema.soilSampling.a_id, test_a_id))
    expect(removedSampling).toHaveLength(0)
  })

  it("should get latest soil analysis", async () => {
    const a_date_old = new Date("2024-01-02T00:00:00Z")
    const a_source = "other"
    const a_som_loi = 5
    const a_depth_lower = 30
    const b_sampling_date_old = new Date("2024-01-01T00:00:00Z")
    // const b_sampling_geometry = 'MULTIPOINT((0 0))'

    test_a_id = await addSoilAnalysis(
      fdm,
      principal_id,
      a_date_old,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date_old,
    )

    const b_sampling_date_new = new Date(b_sampling_date_old.getTime() + 5000) // Add 5 seconds

    await addSoilAnalysis(
      fdm,
      principal_id,
      a_date_old,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date_new,
      { a_som_loi: a_som_loi },
    )

    const allAnalyses = await getSoilAnalyses(fdm, principal_id, b_id)
    expect(allAnalyses).toHaveLength(2)

    // get soil analysis for field
    const latestAnalysis = await getSoilAnalysis(fdm, principal_id, allAnalyses[0].a_id)
    expect(latestAnalysis?.a_date).toEqual(a_date_old)
    expect(latestAnalysis?.b_sampling_date).toEqual(b_sampling_date_new)
    expect(latestAnalysis?.a_som_loi).toEqual(a_som_loi)
  })

  it("should get all soil analysis", async () => {
    const a_date = new Date()
    const a_source = "other"
    const a_som_loi = 7
    const a_depth_lower = 30
    const b_sampling_date = new Date()
    // const b_sampling_geometry = 'MULTIPOINT((0 0))'

    // Add first soil analysis
    await addSoilAnalysis(
      fdm,
      principal_id,
      a_date,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date,
      {
        a_som_loi: a_som_loi,
      },
    )

    // Add second soil analysis
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date(Date.now() + 1000),
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date,
      { a_som_loi: a_som_loi },
    )

    const allAnalyses = await getSoilAnalyses(fdm, principal_id, b_id)
    expect(allAnalyses).toHaveLength(2)
  })

  it("should get soil analyses within a timeframe", async () => {
    // Add soil analyses with different sampling dates
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2023-03-15"),
      "other",
      b_id,
      10,
      new Date("2023-03-15"),
    )
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2023-04-20"),
      "other",
      b_id,
      15,
      new Date("2023-04-20"),
    )
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2023-05-25"),
      "other",
      b_id,
      20,
      new Date("2023-05-25"),
    )
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2023-06-30"),
      "other",
      b_id,
      25,
      new Date("2023-06-30"),
    )

    // Test with a timeframe that includes only the second analysis
    const timeframe1 = {
      start: new Date("2023-04-01"),
      end: new Date("2023-04-30"),
    }
    const analyses1 = await getSoilAnalyses(fdm, principal_id, b_id, timeframe1)
    analyses1.forEach((analysis) => {
      expect(analysis.b_sampling_date).toBeInstanceOf(Date)
      expect(analysis.b_sampling_date?.getTime()).toBeGreaterThanOrEqual(timeframe1.start.getTime())
      expect(analysis.b_sampling_date?.getTime()).toBeLessThanOrEqual(timeframe1.end.getTime())
    })

    // Test with a timeframe that includes the second and third analyses
    const timeframe2 = {
      start: new Date("2023-04-01"),
      end: new Date("2023-05-31"),
    }
    const analyses2 = await getSoilAnalyses(fdm, principal_id, b_id, timeframe2)
    analyses2.forEach((analysis) => {
      expect(analysis.b_sampling_date).toBeInstanceOf(Date)
      expect(analysis.b_sampling_date?.getTime()).toBeGreaterThanOrEqual(timeframe2.start.getTime())
      expect(analysis.b_sampling_date?.getTime()).toBeLessThanOrEqual(timeframe2.end.getTime())
    })

    // Test with a timeframe that includes all analyses
    const timeframe3 = {
      start: new Date("2023-03-01"),
      end: new Date("2023-06-30"),
    }
    const analyses3 = await getSoilAnalyses(fdm, principal_id, b_id, timeframe3)
    analyses3.forEach((analysis) => {
      expect(analysis.b_sampling_date).toBeInstanceOf(Date)
      expect(analysis.b_sampling_date?.getTime()).toBeGreaterThanOrEqual(timeframe3.start.getTime())
      expect(analysis.b_sampling_date?.getTime()).toBeLessThanOrEqual(timeframe3.end.getTime())
    })

    // Test with only start date
    const timeframe4 = {
      start: new Date("2023-05-01"),
      end: undefined,
    }
    const analyses4 = await getSoilAnalyses(fdm, principal_id, b_id, timeframe4)
    analyses4.forEach((analysis) => {
      expect(analysis.b_sampling_date).toBeInstanceOf(Date)
      expect(analysis.b_sampling_date?.getTime()).toBeGreaterThanOrEqual(timeframe4.start.getTime())
    })

    // Test with only end date
    const timeframe5 = {
      start: undefined,
      end: new Date("2023-04-30"),
    }
    const analyses5 = await getSoilAnalyses(fdm, principal_id, b_id, timeframe5)
    analyses5.forEach((analysis) => {
      expect(analysis.b_sampling_date).toBeInstanceOf(Date)
      expect(analysis.b_sampling_date?.getTime()).toBeLessThanOrEqual(timeframe5.end.getTime())
    })
    // Test with no timeframe
    const analyses6 = await getSoilAnalyses(fdm, principal_id, b_id)
    expect(analyses6).toHaveLength(4)
  })

  it("should get current soil data", async () => {
    const a_date_old = new Date("2024-01-02T00:00:00Z")
    const a_source = "other"
    const a_som_loi_old = 5
    const a_p_al_old = 10
    const a_depth_lower = 30
    const b_sampling_date_old = new Date("2024-01-01T00:00:00Z")

    await addSoilAnalysis(
      fdm,
      principal_id,
      a_date_old,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date_old,
      { a_som_loi: a_som_loi_old, a_p_al: a_p_al_old },
    )

    const b_sampling_date_new = new Date(b_sampling_date_old.getTime() + 5000) // Add 5 seconds
    const a_som_loi_new = 7
    const a_p_al_new = 12
    const b_gwl_class_new = "III"

    await addSoilAnalysis(
      fdm,
      principal_id,
      a_date_old,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date_new,
      {
        a_som_loi: a_som_loi_new,
        a_p_al: a_p_al_new,
        b_gwl_class: b_gwl_class_new,
      },
    )

    const currentData: CurrentSoilData = await getCurrentSoilData(fdm, principal_id, b_id)
    expect(currentData.length).toBeGreaterThanOrEqual(3)

    const somLoiData = currentData.find((item) => item.parameter === "a_som_loi")
    expect(somLoiData?.value).toEqual(a_som_loi_new)
    expect(somLoiData?.sources[0].b_sampling_date).toEqual(b_sampling_date_new)

    const pAlData = currentData.find((item) => item.parameter === "a_p_al")
    expect(pAlData?.value).toEqual(a_p_al_new)
    expect(pAlData?.sources[0].b_sampling_date).toEqual(b_sampling_date_new)

    const gwlClassData = currentData.find((item) => item.parameter === "b_gwl_class")
    expect(gwlClassData?.value).toEqual(b_gwl_class_new)
    expect(gwlClassData?.sources[0].b_sampling_date).toEqual(b_sampling_date_new)
  })

  it("should get current soil data within a timeframe", async () => {
    const a_date_old = new Date("2024-01-02T00:00:00Z")
    const a_source = "other"
    const a_som_loi_old = 5
    const a_p_al_old = 10
    const a_depth_lower = 30
    const b_sampling_date_old = new Date("2024-01-01T00:00:00Z")

    await addSoilAnalysis(
      fdm,
      principal_id,
      a_date_old,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date_old,
      { a_som_loi: a_som_loi_old, a_p_al: a_p_al_old },
    )

    const b_sampling_date_new = new Date(b_sampling_date_old.getTime() + 5000) // Add 5 seconds
    const a_som_loi_new = 7
    const a_p_al_new = 12
    const b_gwl_class_new = "III"

    await addSoilAnalysis(
      fdm,
      principal_id,
      a_date_old,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date_new,
      {
        a_som_loi: a_som_loi_new,
        a_p_al: a_p_al_new,
        b_gwl_class: b_gwl_class_new,
      },
    )

    const timeframe = {
      start: null,
      end: new Date(b_sampling_date_new.getTime() - 1),
    } // Exclude latest

    const currentData: CurrentSoilData = await getCurrentSoilData(
      fdm,
      principal_id,
      b_id,
      timeframe,
    )
    expect(currentData.length).toBeGreaterThanOrEqual(2)

    const somLoiData = currentData.find((item) => item.parameter === "a_som_loi")
    expect(somLoiData?.value).toEqual(a_som_loi_old)
    expect(somLoiData?.sources[0].b_sampling_date).toEqual(b_sampling_date_old)

    const pAlData = currentData.find((item) => item.parameter === "a_p_al")
    expect(pAlData?.value).toEqual(a_p_al_old)
    expect(pAlData?.sources[0].b_sampling_date).toEqual(b_sampling_date_old)

    const gwlClassData = currentData.find((item) => item.parameter === "b_gwl_class")
    expect(gwlClassData).toBeUndefined()

    const timeframe2 = {
      start: null,
      end: new Date(b_sampling_date_new.getTime() + 1000),
    }

    const currentData2: CurrentSoilData = await getCurrentSoilData(
      fdm,
      principal_id,
      b_id,
      timeframe2,
    )
    expect(currentData2.length).toBeGreaterThanOrEqual(3)

    const somLoiData2 = currentData2.find((item) => item.parameter === "a_som_loi")
    expect(somLoiData2?.value).toEqual(a_som_loi_new)
    expect(somLoiData2?.sources[0].b_sampling_date).toEqual(b_sampling_date_new)

    const pAlData2 = currentData2.find((item) => item.parameter === "a_p_al")
    expect(pAlData2?.value).toEqual(a_p_al_new)
    expect(pAlData2?.sources[0].b_sampling_date).toEqual(b_sampling_date_new)

    const gwlClassData2 = currentData2.find((item) => item.parameter === "b_gwl_class")
    expect(gwlClassData2?.value).toEqual(b_gwl_class_new)
    expect(gwlClassData2?.sources[0].b_sampling_date).toEqual(b_sampling_date_new)
  })

  it("should return empty array if no soil data is present within timeframe", async () => {
    const a_date_old = new Date("2024-01-02T00:00:00Z")
    const a_source = "other"
    const a_som_loi_old = 5
    const a_p_al_old = 10
    const a_depth_lower = 30
    const b_sampling_date_old = new Date("2024-01-01T00:00:00Z")

    await addSoilAnalysis(
      fdm,
      principal_id,
      a_date_old,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date_old,
      { a_som_loi: a_som_loi_old, a_p_al: a_p_al_old },
    )
    const timeframe = { start: null, end: new Date("2023-01-01T00:00:00Z") }
    const currentData = await getCurrentSoilData(fdm, principal_id, b_id, timeframe)
    expect(currentData.length).toEqual(0)
  })

  it("should return all data if timeframe has no end", async () => {
    const a_date_old = new Date("2024-01-02T00:00:00Z")
    const a_source = "other"
    const a_som_loi_old = 5
    const a_p_al_old = 10
    const a_depth_lower = 30
    const b_sampling_date_old = new Date("2024-01-01T00:00:00Z")

    await addSoilAnalysis(
      fdm,
      principal_id,
      a_date_old,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date_old,
      { a_som_loi: a_som_loi_old, a_p_al: a_p_al_old },
    )
    const timeframe = { start: new Date("2023-01-01T00:00:00Z"), end: null }
    const currentData = await getCurrentSoilData(fdm, principal_id, b_id, timeframe)
    expect(currentData.length).toBeGreaterThanOrEqual(2)
  })

  it("should return empty array if no soil data is present", async () => {
    const currentData = await getCurrentSoilData(fdm, principal_id, b_id)
    expect(currentData.length).toEqual(0)
  })

  it("should retrieve soil analyses including those with null b_sampling_date and order correctly", async () => {
    const a_date = new Date()
    const a_source = "other"
    const a_depth_lower = 30

    // Add analyses with valid b_sampling_date
    const b_sampling_date1 = new Date("2024-01-01T00:00:00Z")
    await addSoilAnalysis(
      fdm,
      principal_id,
      a_date,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date1,
    )

    const b_sampling_date2 = new Date("2024-01-05T00:00:00Z")
    await addSoilAnalysis(
      fdm,
      principal_id,
      a_date,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date2,
    )

    // Add an analysis with null b_sampling_date
    await addSoilAnalysis(fdm, principal_id, a_date, a_source, b_id, a_depth_lower, null)

    // Retrieve all analyses
    const allAnalyses = await getSoilAnalyses(fdm, principal_id, b_id)

    expect(allAnalyses).toHaveLength(3)

    // Check that the analysis with null date comes last
    expect(allAnalyses[0].b_sampling_date).toEqual(b_sampling_date2)
    expect(allAnalyses[1].b_sampling_date).toEqual(b_sampling_date1)
    expect(allAnalyses[2].b_sampling_date).toBeNull()
  })

  it("should retrieve soil analyses including those with null b_sampling_date and order correctly with timeframe", async () => {
    const a_date = new Date()
    const a_source = "other"
    const a_depth_lower = 30

    // Add analyses with valid b_sampling_date
    const b_sampling_date1 = new Date("2024-01-01T00:00:00Z")
    const properties1 = { a_som_loi: 5 }
    await addSoilAnalysis(
      fdm,
      principal_id,
      a_date,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date1,
      properties1,
    )

    const b_sampling_date2 = new Date("2024-01-05T00:00:00Z")
    const properties2 = { a_som_loi: 6 }
    await addSoilAnalysis(
      fdm,
      principal_id,
      a_date,
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date2,
      properties2,
    )

    // Add an analysis with null b_sampling_date
    const properties3 = { a_som_loi: 7, a_p_al: 20 }
    await addSoilAnalysis(
      fdm,
      principal_id,
      a_date,
      a_source,
      b_id,
      a_depth_lower,
      null,
      properties3,
    )

    // Retrieve all analyses
    const allAnalyses = await getSoilAnalyses(fdm, principal_id, b_id, {
      start: new Date("2023-01-01"),
      end: new Date("2025-01-01"),
    })

    expect(allAnalyses).toHaveLength(3)

    // Check that the analysis with null date comes last
    expect(allAnalyses[0].b_sampling_date).toEqual(b_sampling_date2)
    expect(allAnalyses[1].b_sampling_date).toEqual(b_sampling_date1)
    expect(allAnalyses[2].b_sampling_date).toBeNull()

    const currentData = await getCurrentSoilData(fdm, principal_id, b_id, {
      start: new Date("2023-01-01"),
      end: new Date("2025-01-01"),
    })

    const somLoiData = currentData.find((item) => item.parameter === "a_som_loi")
    expect(somLoiData?.value).toEqual(properties2.a_som_loi)

    const palData = currentData.find((item) => item.parameter === "a_p_al")
    expect(palData?.value).toEqual(properties3.a_p_al)
  })
})

describe("getSoilParametersDescription", () => {
  it("should return the correct soil parameter descriptions for NL-nl locale", () => {
    const descriptions = getSoilParametersDescription("NL-nl")
    expect(descriptions).toHaveLength(43)
    for (const description of descriptions) {
      expect(description).toHaveProperty("parameter")
      expect(description).toHaveProperty("unit")
      expect(description).toHaveProperty("name")
      expect(description).toHaveProperty("type")
      expect(description).toHaveProperty("description")
      if (description.type === "enum") {
        expect(description).toHaveProperty("options")
      }
    }
  })

  it("should use the units of the NMI parameter definitions", () => {
    const descriptions = getSoilParametersDescription("NL-nl")
    const unitOf = (parameter: string) =>
      descriptions.find((description) => description.parameter === parameter)?.unit

    expect(unitOf("a_c_of")).toBe("g C/kg")
    expect(unitOf("a_n_rt")).toBe("mg N/kg")
    expect(unitOf("a_ca_co")).toBe("mmol+/kg")
    expect(unitOf("a_k_co")).toBe("mmol+/kg")
    expect(unitOf("a_mg_co")).toBe("mmol+/kg")
    expect(unitOf("a_cec_co")).toBe("mmol+/kg")
    expect(unitOf("a_density_sa")).toBe("g/cm³")
  })

  it("should label exchangeable cations as exchangeable, not as total reserve", () => {
    const descriptions = getSoilParametersDescription("NL-nl")
    for (const parameter of ["a_ca_co", "a_k_co", "a_mg_co"]) {
      const description = descriptions.find((item) => item.parameter === parameter)
      expect(description?.name).toContain("uitwisselbaar")
      expect(description?.description).not.toContain("totale bodemvoorraad")
    }
  })

  it("should throw an error for unsupported locales", () => {
    expect(() => getSoilParametersDescription("en-US")).toThrowError("Unsupported locale")
    expect(() => getSoilParametersDescription("de-DE")).toThrowError("Unsupported locale")
  })

  it("should return the correct soil parameter descriptions for default locale", () => {
    const descriptions = getSoilParametersDescription()
    expect(descriptions).toHaveLength(43)
    for (const description of descriptions) {
      expect(description).toHaveProperty("parameter")
      expect(description).toHaveProperty("unit")
      expect(description).toHaveProperty("name")
      expect(description).toHaveProperty("type")
      expect(description).toHaveProperty("description")
      if (description.type === "enum") {
        expect(description).toHaveProperty("options")
      }
    }
  })
})

describe("getSoilAnalysesForFarm", () => {
  let fdm: FdmServerType
  let principal_id: string
  let b_id_farm: string
  let b_id: string
  let b_id_2: string

  const geometry: schema.fieldsTypeInsert["b_geometry"] = {
    type: "Polygon",
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

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")
    fdm = createFdmServer(host, port, user, password, database)

    principal_id = createId()
    b_id_farm = await addFarm(fdm, principal_id, "Test Farm", "123456", "123 Farm Lane", "12345")

    b_id = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Field 1",
      "src1",
      geometry,
      new Date("2023-01-01"),
      "nl_01",
      new Date("2023-12-31"),
    )

    b_id_2 = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Field 2",
      "src2",
      geometry,
      new Date("2023-01-01"),
      "nl_01",
      new Date("2023-12-31"),
    )
  })

  it("should return a Map with analyses grouped by field ID", async () => {
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2023-05-01"),
      "other",
      b_id,
      30,
      new Date("2023-05-01"),
      { a_p_al: 10 },
    )
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2023-06-01"),
      "other",
      b_id_2,
      30,
      new Date("2023-06-01"),
      { a_p_al: 20 },
    )

    const result = await getSoilAnalysesForFarm(fdm, principal_id, b_id_farm)

    expect(result).toBeInstanceOf(Map)
    expect(result.has(b_id)).toBe(true)
    expect(result.has(b_id_2)).toBe(true)
    expect(result.get(b_id)).toHaveLength(1)
    expect(result.get(b_id_2)).toHaveLength(1)
    expect(result.get(b_id)?.[0].a_p_al).toBe(10)
    expect(result.get(b_id_2)?.[0].a_p_al).toBe(20)
  })

  it("should return an empty Map when the farm has no soil analyses", async () => {
    const result = await getSoilAnalysesForFarm(fdm, principal_id, b_id_farm)
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it("should only return analyses within the given timeframe", async () => {
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2023-05-01"),
      "other",
      b_id,
      30,
      new Date("2023-05-01"),
      { a_p_al: 10 },
    )
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2025-05-01"),
      "other",
      b_id_2,
      30,
      new Date("2025-05-01"),
      { a_p_al: 20 },
    )

    const timeframe = {
      start: new Date("2023-01-01"),
      end: new Date("2023-12-31"),
    }
    const result = await getSoilAnalysesForFarm(fdm, principal_id, b_id_farm, timeframe)

    expect(result.has(b_id)).toBe(true)
    expect(result.has(b_id_2)).toBe(false)
  })

  it("should not include analyses from other farms", async () => {
    const other_farm = await addFarm(
      fdm,
      principal_id,
      "Other Farm",
      "654321",
      "456 Other Lane",
      "67890",
    )
    const other_b_id = await addField(
      fdm,
      principal_id,
      other_farm,
      "other field",
      "src3",
      geometry,
      new Date("2023-01-01"),
      "nl_01",
      new Date("2023-12-31"),
    )

    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2023-05-01"),
      "other",
      other_b_id,
      30,
      new Date("2023-05-01"),
      { a_p_al: 99 },
    )
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2023-06-01"),
      "other",
      b_id,
      30,
      new Date("2023-06-01"),
      { a_p_al: 10 },
    )

    const result = await getSoilAnalysesForFarm(fdm, principal_id, b_id_farm)

    expect(result.has(b_id)).toBe(true)
    expect(result.has(other_b_id)).toBe(false)
  })

  it("should throw when principal does not have permission", async () => {
    const unauthorized_principal = createId()
    await expect(
      getSoilAnalysesForFarm(fdm, unauthorized_principal, b_id_farm),
    ).rejects.toThrowError("Principal does not have permission to perform this action")
  })
})

describe("getCurrentSoilDataForFarm", () => {
  let fdm: FdmServerType
  let principal_id: string
  let b_id_farm: string
  let b_id: string
  let b_id_2: string

  const geometry: schema.fieldsTypeInsert["b_geometry"] = {
    type: "Polygon",
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

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")
    fdm = createFdmServer(host, port, user, password, database)

    principal_id = createId()
    b_id_farm = await addFarm(fdm, principal_id, "Test Farm", "123456", "123 Farm Lane", "12345")

    b_id = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Field 1",
      "src1",
      geometry,
      new Date("2023-01-01"),
      "nl_01",
      new Date("2023-12-31"),
    )

    b_id_2 = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Field 2",
      "src2",
      geometry,
      new Date("2023-01-01"),
      "nl_01",
      new Date("2023-12-31"),
    )
  })

  it("should return a Map with current soil data grouped by field ID", async () => {
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2023-05-01"),
      "other",
      b_id,
      30,
      new Date("2023-05-01"),
      { a_p_al: 10, a_p_cc: 1.5 },
    )
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2023-06-01"),
      "other",
      b_id_2,
      30,
      new Date("2023-06-01"),
      { a_p_al: 20 },
    )

    const result = await getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm)

    expect(result).toBeInstanceOf(Map)
    expect(result.has(b_id)).toBe(true)
    expect(result.has(b_id_2)).toBe(true)
    const field1Data = result.get(b_id)!
    expect(field1Data.find((x) => x.parameter === "a_p_al")?.value).toBe(10)
    expect(field1Data.find((x) => x.parameter === "a_p_cc")?.value).toBe(1.5)
    const field2Data = result.get(b_id_2)!
    expect(field2Data.find((x) => x.parameter === "a_p_al")?.value).toBe(20)
  })

  it("should return an empty Map when the farm has no soil analyses", async () => {
    const result = await getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm)

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it("should only include analyses within the given timeframe", async () => {
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2023-05-01"),
      "other",
      b_id,
      30,
      new Date("2023-05-01"),
      { a_p_al: 10 },
    )
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2026-06-01"),
      "other",
      b_id_2,
      30,
      new Date("2026-06-01"),
      { a_p_al: 20 },
    )

    const timeframe = {
      start: new Date("2023-01-01"),
      end: new Date("2023-12-31"),
    }
    const result = await getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm, timeframe)

    expect(result.has(b_id)).toBe(true)
    expect(result.has(b_id_2)).toBe(false)
  })

  it("should throw when principal does not have permission", async () => {
    const unauthorized_principal = createId()
    await expect(
      getCurrentSoilDataForFarm(fdm, unauthorized_principal, b_id_farm),
    ).rejects.toThrowError("Principal does not have permission to perform this action")
  })
})

describe("Soil sampling zones", () => {
  let fdm: FdmServerType
  let b_id_farm: string
  let b_id: string
  let principal_id: string

  // Synthetic rectangular field split into a west and an east half
  const west = 5.0
  const middle = 5.005
  const east = 5.01
  const south = 52.0
  const north = 52.005
  const rectangle = (x1: number, x2: number): GeoJSON.Polygon => ({
    type: "Polygon",
    coordinates: [
      [
        [x1, south],
        [x2, south],
        [x2, north],
        [x1, north],
        [x1, south],
      ],
    ],
  })
  const westZone = rectangle(west, middle)
  const eastZone = rectangle(middle, east)
  const samplingPoints: GeoJSON.MultiPoint = {
    type: "MultiPoint",
    coordinates: [
      [5.002, 52.002],
      [5.003, 52.003],
    ],
  }

  const add = (date: string, data: Parameters<typeof addSoilAnalysis>[7]): Promise<string> =>
    addSoilAnalysis(fdm, principal_id, null, "other", b_id, 30, new Date(date), data)

  beforeEach(async () => {
    fdm = createFdmServer(
      inject("host"),
      inject("port"),
      inject("user"),
      inject("password"),
      inject("database"),
    )
    principal_id = createId()
    b_id_farm = await addFarm(fdm, principal_id, "Zone Farm", "654321", "Zone Lane 1", "1234 AB")
    b_id = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Zone Field",
      "zone-field",
      rectangle(west, east),
      new Date("2020-01-01"),
      "nl_01",
    )
  })

  it("stores and returns the sampling geometries", async () => {
    const a_id = await add("2024-03-01", {
      a_p_al: 30,
      b_sampling_geometry: samplingPoints,
      b_sampling_geometry_zone: westZone,
    })
    const analysis = await getSoilAnalysis(fdm, principal_id, a_id)
    expect(analysis.b_sampling_geometry).toEqual(samplingPoints)
    expect(analysis.b_sampling_geometry_zone).toEqual({
      type: "MultiPolygon",
      coordinates: [westZone.coordinates],
    })

    const analyses = await getSoilAnalyses(fdm, principal_id, b_id)
    expect(analyses[0].b_sampling_geometry_zone?.type).toBe("MultiPolygon")
    const analysesForFarm = await getSoilAnalysesForFarm(fdm, principal_id, b_id_farm)
    expect(analysesForFarm.get(b_id)?.[0].b_sampling_geometry).toEqual(samplingPoints)

    await updateSoilAnalysis(fdm, principal_id, a_id, {
      b_sampling_geometry: null,
      b_sampling_geometry_zone: eastZone,
    })
    const updated = await getSoilAnalysis(fdm, principal_id, a_id)
    expect(updated.b_sampling_geometry).toBeNull()
    expect(updated.b_sampling_geometry_zone?.coordinates).toEqual([eastZone.coordinates])
  })

  it("returns null geometries for analyses without them", async () => {
    const a_id = await add("2024-03-01", { a_p_al: 30 })
    const analysis = await getSoilAnalysis(fdm, principal_id, a_id)
    expect(analysis.b_sampling_geometry).toBeNull()
    expect(analysis.b_sampling_geometry_zone).toBeNull()
  })

  it("rejects invalid geometry types", async () => {
    await expect(
      add("2024-03-01", {
        b_sampling_geometry: westZone as unknown as GeoJSON.MultiPoint,
      }),
    ).rejects.toThrowError("Exception for addSoilAnalysis")
    await expect(
      add("2024-03-01", {
        b_sampling_geometry_zone: samplingPoints as unknown as GeoJSON.Polygon,
      }),
    ).rejects.toThrowError("Exception for addSoilAnalysis")
    const a_id = await add("2024-03-01", { a_p_al: 30 })
    await expect(
      updateSoilAnalysis(fdm, principal_id, a_id, {
        b_sampling_geometry_zone: rectangle(155000, 156000),
      }),
    ).rejects.toThrowError("Exception for updateSoilAnalysis")
  })

  it("stores an empty zone or empty sample points as null", async () => {
    const a_id = await add("2024-03-01", {
      a_p_al: 30,
      b_sampling_geometry: { type: "MultiPoint", coordinates: [] },
      b_sampling_geometry_zone: { type: "MultiPolygon", coordinates: [] },
    })
    const analysis = await getSoilAnalysis(fdm, principal_id, a_id)
    expect(analysis?.b_sampling_geometry).toBeNull()
    expect(analysis?.b_sampling_geometry_zone).toBeNull()
  })

  it("combines two zones by area without mixing parameters across zones", async () => {
    const a_id_west = await add("2024-03-20", {
      a_p_al: 40,
      a_som_loi: 4,
      b_soiltype_agr: "dekzand",
      b_sampling_geometry_zone: westZone,
    })
    const a_id_east = await add("2024-03-01", {
      a_p_al: 20,
      b_soiltype_agr: "zeeklei",
      b_sampling_geometry_zone: eastZone,
    })

    const current = await getCurrentSoilData(fdm, principal_id, b_id)
    const p = current.find((item) => item.parameter === "a_p_al")
    expect(p?.value).toBeCloseTo(30, 1)
    expect(p?.is_aggregated).toBe(true)
    expect(p?.has_coverage_warning).toBe(false)
    expect(p?.coverage).toBeCloseTo(1, 3)
    expect(p?.sources.map((s) => s.a_id)).toEqual([a_id_west, a_id_east])
    expect(p?.sources[0].area_fraction).toBeCloseTo(0.5, 2)

    // SOM is only known in the west zone
    const som = current.find((item) => item.parameter === "a_som_loi")
    expect(som?.value).toBe(4)
    expect(som?.is_aggregated).toBe(false)
    expect(som?.has_coverage_warning).toBe(true)
    expect(som?.coverage).toBeCloseTo(0.5, 2)

    const soilType = current.find((item) => item.parameter === "b_soiltype_agr")
    expect(soilType?.is_aggregated).toBe(true)

    const forFarm = await getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm)
    expect(forFarm.get(b_id)?.find((item) => item.parameter === "a_p_al")?.value).toBeCloseTo(30, 1)
  })

  it("uses only the remaining area of an older zone that overlaps a newer zone", async () => {
    // A newer west zone and an older zone that covers the whole field
    await add("2024-03-20", { a_p_al: 40, b_sampling_geometry_zone: westZone })
    await add("2024-03-01", {
      a_p_al: 20,
      b_sampling_geometry_zone: rectangle(west, east),
    })

    const current = await getCurrentSoilData(fdm, principal_id, b_id)
    const p = current.find((item) => item.parameter === "a_p_al")
    expect(p?.value).toBeCloseTo(30, 1)
    expect(p?.coverage).toBeCloseTo(1, 3)
  })

  it("gives the same values as before for analyses without zones", async () => {
    await add("2024-03-01", { a_p_al: 20, a_som_loi: 3 })
    await add("2025-03-01", { a_p_al: 25 })

    const current = await getCurrentSoilData(fdm, principal_id, b_id)
    const p = current.find((item) => item.parameter === "a_p_al")
    expect(p?.value).toBe(25)
    expect(p?.is_aggregated).toBe(false)
    expect(p?.coverage).toBe(1)
    expect(p?.sources).toHaveLength(1)
    expect(current.find((item) => item.parameter === "a_som_loi")?.value).toBe(3)
  })

  it("returns the current soil data per zone", async () => {
    const a_id_west = await add("2024-03-20", {
      a_p_al: 40,
      b_sampling_geometry_zone: westZone,
    })
    const a_id_east = await add("2024-03-01", {
      a_p_al: 20,
      b_sampling_geometry_zone: eastZone,
    })
    const a_id_field = await add("2025-02-01", { a_nmin_cc: 40 })

    const zones = await getCurrentSoilDataPerZone(fdm, principal_id, b_id)
    expect(zones).toHaveLength(3)

    const wholeField = zones.find((zone) => zone.a_ids.includes(a_id_field))
    expect(wholeField?.b_sampling_geometry_zone).toBeNull()
    expect(wholeField?.data.map((item) => item.parameter)).toEqual(["a_nmin_cc"])

    const westResult = zones.find((zone) => zone.a_ids.includes(a_id_west))
    expect(westResult?.b_sampling_geometry_zone?.type).toBe("MultiPolygon")
    expect(westResult?.data.find((item) => item.parameter === "a_p_al")?.value).toBe(40)
    expect(westResult?.b_area).toBeGreaterThan(0)

    const eastResult = zones.find((zone) => zone.a_ids.includes(a_id_east))
    expect(eastResult?.data.find((item) => item.parameter === "a_p_al")?.value).toBe(20)
  })
})
