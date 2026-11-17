/**
 * Seeds a synthetic user and farm for the end-to-end tests and the manual screenshots.
 *
 * It builds the farm through the fdm-core functions, in the same order as the app does when a
 * user creates a farm, so the pages show what a real user would see. Run it against an empty,
 * migrated database: it refuses to touch a database that already contains farms.
 *
 * Two variants:
 *
 * - `minimal`: two fields with a crop, harvests, fertilisation and a soil analysis; enough for
 *   smoke tests of every page.
 * - `demo`: five fields, with measures and soil condition scores, covering every page that the user
 *   manual documents.
 */

import type { FeatureCollection, MultiPolygon, Polygon } from "geojson"
import {
  addCultivation,
  addFarm,
  addFertilizer,
  addFertilizerApplication,
  addField,
  addHarvest,
  addMeasure,
  addSoilAnalysis,
  createFdmAuth,
  createFdmServer,
  enableCultivationCatalogue,
  enableFertilizerCatalogue,
  enableMeasureCatalogue,
  fdmSchema,
  getFertilizersFromCatalogue,
  setGrazingIntention,
  updateUserProfile,
} from "@nmi-agro/fdm-core"
import { randomBytes } from "node:crypto"
import { readFileSync } from "node:fs"
import {
  DEMO_FARM_ADDRESS,
  DEMO_FARM_NAME,
  DEMO_USER,
  type DemoFarmIds,
  type DemoFieldKey,
  type SeededFieldRecords,
  type SeedUser,
  type SeedVariant,
  demoYear,
} from "./demo-farm"
import { samplingPoints, splitWestEast } from "./sampling"

type Fdm = ReturnType<typeof createFdmServer>

/** The fertilisers the demo farm uses, by their catalogue id (BAAT catalogue). */
const FERTILIZERS = {
  slurry: "BAAT050", // Rundveedrijfmest
  can: "BAAT028", // KAS
} as const

type FertilizerKey = keyof typeof FERTILIZERS

type HarvestProperties = NonNullable<Parameters<typeof addHarvest>[4]>

interface DemoCultivation {
  catalogue: string
  /** Month and day of sowing; `yearOffset` -1 means the previous year. */
  start: [month: number, day: number, yearOffset?: number]
  end?: [month: number, day: number, yearOffset?: number]
  harvests?: { date: [month: number, day: number]; properties: HarvestProperties }[]
}

interface DemoField {
  key: DemoFieldKey
  name: string
  cultivations: DemoCultivation[]
  applications: {
    fertilizer: FertilizerKey
    amount: number
    method: Parameters<typeof addFertilizerApplication>[5]
    date: [month: number, day: number]
  }[]
  soil: {
    depthLower: number
    data: NonNullable<Parameters<typeof addSoilAnalysis>[7]>
    /** Values for the eastern half, when the field is sampled as two zones (west and east). */
    eastZone?: Partial<NonNullable<Parameters<typeof addSoilAnalysis>[7]>>
  }
}

const SANDY_SOIL = {
  a_som_loi: 5.2,
  a_clay_mi: 3,
  a_silt_mi: 9,
  a_sand_mi: 88,
  a_p_al: 42,
  a_p_cc: 2.4,
  a_k_cc: 125,
  a_ph_cc: 5.4,
  a_n_rt: 2100,
  a_c_of: 27,
  b_soiltype_agr: "dekzand",
  b_gwl_class: "V",
} as const

const CLAY_SOIL = {
  a_som_loi: 3.4,
  a_clay_mi: 30,
  a_silt_mi: 40,
  a_sand_mi: 30,
  a_p_al: 36,
  a_p_cc: 1.9,
  a_k_cc: 175,
  a_ph_cc: 6.9,
  a_n_rt: 1650,
  a_c_of: 19,
  b_soiltype_agr: "rivierklei",
  b_gwl_class: "IV",
} as const

const grassCut = (month: number, day: number, yieldKg: number) => ({
  date: [month, day] as [number, number],
  properties: { b_lu_yield: yieldKg, b_lu_cp: 170 },
})

/**
 * The outlines of the demo fields, by key: parcels from the public BRP (Basisregistratie
 * Percelen, PDOK, Public Domain Mark) west of Wageningen. Only the outlines are used; the names,
 * crops and all other data of the demo farm are made up.
 */
const OUTLINES = new Map(
  (
    JSON.parse(
      readFileSync(new URL("./fields.geojson", import.meta.url), "utf8"),
    ) as FeatureCollection<Polygon, { key: DemoFieldKey }>
  ).features.map((feature) => [feature.properties.key, feature.geometry]),
)

/** The demo fields: two grassland fields and maize on sandy soil, two arable fields on clay. */
const FIELDS: DemoField[] = [
  {
    key: "grasland-huiskavel",
    name: "Huiskavel",
    cultivations: [
      {
        catalogue: "nl_265", // Grasland, blijvend
        start: [1, 1, -3],
        harvests: [
          grassCut(5, 10, 3600),
          grassCut(6, 25, 3100),
          grassCut(8, 15, 2700),
          grassCut(10, 1, 2200),
        ],
      },
    ],
    applications: [
      { fertilizer: "slurry", amount: 30, method: "slotted coulter", date: [3, 1] },
      { fertilizer: "can", amount: 250, method: "broadcasting", date: [3, 20] },
      { fertilizer: "slurry", amount: 20, method: "slotted coulter", date: [5, 20] },
      { fertilizer: "can", amount: 150, method: "broadcasting", date: [7, 1] },
    ],
    soil: { depthLower: 10, data: SANDY_SOIL, eastZone: { a_p_al: 29, a_ph_cc: 5.0 } },
  },
  {
    key: "grasland-achter",
    name: "Achterweide",
    cultivations: [
      {
        catalogue: "nl_265",
        start: [1, 1, -3],
        harvests: [grassCut(5, 15, 3400), grassCut(7, 1, 2900), grassCut(9, 1, 2500)],
      },
    ],
    applications: [
      { fertilizer: "slurry", amount: 25, method: "slotted coulter", date: [3, 5] },
      { fertilizer: "can", amount: 200, method: "broadcasting", date: [3, 25] },
    ],
    soil: { depthLower: 10, data: { ...SANDY_SOIL, a_p_al: 31, a_ph_cc: 5.1 } },
  },
  {
    key: "mais",
    name: "Maïsakker",
    cultivations: [
      {
        catalogue: "nl_259", // Mais, snij-
        start: [5, 1],
        harvests: [{ date: [9, 25], properties: { b_lu_yield: 17500, b_lu_cp: 75 } }],
      },
    ],
    applications: [{ fertilizer: "slurry", amount: 40, method: "injection", date: [4, 20] }],
    soil: { depthLower: 30, data: { ...SANDY_SOIL, a_som_loi: 4.1, a_k_cc: 95 } },
  },
  {
    key: "tarwe",
    name: "Lange akker",
    cultivations: [
      {
        catalogue: "nl_233", // Tarwe, winter-
        start: [10, 20, -1],
        harvests: [
          {
            date: [8, 1],
            properties: { b_lu_yield_fresh: 9500, b_lu_moist: 15, b_lu_cp: 115 },
          },
        ],
      },
      {
        catalogue: "nl_428", // Gele mosterd, as a catch crop after the wheat
        start: [8, 15],
        end: [2, 15, 1],
      },
    ],
    applications: [
      { fertilizer: "can", amount: 300, method: "broadcasting", date: [3, 10] },
      { fertilizer: "can", amount: 200, method: "broadcasting", date: [4, 25] },
    ],
    soil: { depthLower: 30, data: CLAY_SOIL },
  },
  {
    key: "aardappelen",
    name: "Kleiakker",
    cultivations: [
      {
        catalogue: "nl_2014", // Aardappelen, consumptie
        start: [4, 15],
        harvests: [
          {
            date: [9, 20],
            properties: {
              b_lu_yield_bruto: 56000,
              b_lu_tarra: 5,
              b_lu_uww: 380,
              b_lu_n_harvestable: 14,
            },
          },
        ],
      },
    ],
    applications: [
      { fertilizer: "slurry", amount: 30, method: "injection", date: [4, 1] },
      { fertilizer: "can", amount: 150, method: "broadcasting", date: [5, 15] },
    ],
    soil: { depthLower: 30, data: { ...CLAY_SOIL, a_k_cc: 160, a_p_al: 41 } },
  },
]

/** The measures of the `demo` variant, by their id in the BLN catalogue. */
const MEASURES: { field: DemoFieldKey; m_id: string; startYearOffset: number }[] = [
  { field: "mais", m_id: "bln_BM200", startYearOffset: -2 }, // Emissiearm toedienen drijfmest
  { field: "tarwe", m_id: "bln_BM213", startYearOffset: -3 }, // Niet-kerende grondbewerking
  { field: "grasland-achter", m_id: "bln_BM231", startYearOffset: 0 }, // Geen zware machines op natte grond
]

type BcsScores = NonNullable<Parameters<typeof addSoilAnalysis>[7]>

/**
 * The soil condition score (BCS) assessments of the `demo` variant: a score of 0, 1 or 2 per
 * visual indicator, as the app stores them. A spring assessment with some puddling and wheel
 * ruts, and a better one after the measure against heavy machinery on wet soil.
 */
const BCS_ASSESSMENTS: {
  field: DemoFieldKey
  date: [month: number, day: number]
  scores: BcsScores
}[] = [
  {
    field: "grasland-achter",
    date: [3, 12],
    scores: {
      a_cc_bcs: 2,
      a_rd_bcs: 1,
      a_sc_bcs: 1,
      a_ew_bcs: 1,
      a_ss_bcs: 1,
      a_gs_bcs: 2,
      a_p_bcs: 1,
      a_c_bcs: 0,
      a_rt_bcs: 1,
    },
  },
  {
    field: "grasland-achter",
    date: [5, 20],
    scores: {
      a_cc_bcs: 2,
      a_rd_bcs: 2,
      a_sc_bcs: 1,
      a_ew_bcs: 2,
      a_ss_bcs: 2,
      a_gs_bcs: 2,
      a_p_bcs: 0,
      a_c_bcs: 0,
      a_rt_bcs: 1,
    },
  },
]

/**
 * Returns the outline of a demo field.
 *
 * @param key - The key of the field.
 * @returns The polygon from `fields.geojson`.
 * @throws When the fixture has no outline for the key.
 */
function outline(key: DemoFieldKey): Polygon {
  const geometry = OUTLINES.get(key)
  if (!geometry) throw new Error(`fields.geojson has no outline for ${key}`)
  return geometry
}

/**
 * Returns the id of a seeded demo field.
 *
 * @param fields - The seeded fields.
 * @param key - The key of the field.
 * @returns The field id.
 * @throws When the field was not seeded.
 */
function fieldId(fields: DemoFarmIds["fields"], key: DemoFieldKey): string {
  const b_id = fields[key]
  if (!b_id) throw new Error(`The demo field ${key} was not seeded`)
  return b_id
}

/**
 * Returns a date at noon UTC, so it stays on the same calendar day in the Netherlands.
 *
 * @param year - The year.
 * @param month - The month, 1–12.
 * @param day - The day of the month.
 * @returns The date.
 */
function date(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12))
}

/**
 * Signs up a user with a complete profile, so the app does not ask for a name first. Fails when
 * the e-mail address or username is taken.
 *
 * @param fdm - The database connection.
 * @param user - The user to create (default: {@link DEMO_USER}).
 * @returns The user id, used as principal for everything else.
 */
export async function createSeedUser(fdm: Fdm, user: SeedUser = DEMO_USER): Promise<string> {
  // Only the seed signs up with a password; the app itself signs in through magic links.
  const auth = createFdmAuth(fdm, undefined, undefined, undefined, true)
  const { user: created } = await auth.api.signUpEmail({
    body: {
      email: user.email,
      name: `${user.firstname} ${user.surname}`,
      username: user.username,
      password: randomBytes(24).toString("base64url"),
    } as NonNullable<Parameters<typeof auth.api.signUpEmail>[0]>["body"],
  })
  await updateUserProfile(fdm, created.id, user.firstname, user.surname, "nl-NL")
  return created.id
}

/** The fields of the `minimal` variant. */
const MINIMAL_FIELDS: readonly DemoFieldKey[] = ["grasland-huiskavel", "tarwe"]

/** Options of {@link seedFarm}. */
export interface SeedOptions {
  /** `minimal` (two fields) or `demo` (five fields, the default). */
  variant?: SeedVariant
  /** The year of the farm data (default: the current year, see {@link demoYear}). */
  year?: number
  /** The owner of the farm (default: {@link DEMO_USER}). */
  user?: SeedUser
  /**
   * Refuse to seed into a database that already contains farms (default `true`). Tests that
   * create their own user per test, such as the loader and action tests, turn it off.
   */
  requireEmptyDatabase?: boolean
}

/**
 * Seeds a user and its farm.
 *
 * @param fdm - A connection to a migrated database with synced catalogues; empty unless
 *   `requireEmptyDatabase` is `false`.
 * @param options - See {@link SeedOptions}.
 * @returns The ids that the tests need to fill in routes.
 * @throws When `requireEmptyDatabase` is on and the database already contains farms.
 */
export async function seedFarm(fdm: Fdm, options: SeedOptions = {}): Promise<DemoFarmIds> {
  const variant = options.variant ?? "demo"
  const year = options.year ?? demoYear()
  const user = options.user ?? DEMO_USER
  if (options.requireEmptyDatabase ?? true) {
    const existing = await fdm
      .select({ b_id_farm: fdmSchema.farms.b_id_farm })
      .from(fdmSchema.farms)
      .limit(1)
    if (existing.length > 0) {
      throw new Error(
        "The database already contains farms. Seed the demo farm into an empty database only.",
      )
    }
  }

  const principal = await createSeedUser(fdm, user)

  // The same steps as creating a farm in the app (farm.create._index.tsx).
  const b_id_farm = await addFarm(
    fdm,
    principal,
    DEMO_FARM_NAME,
    null,
    DEMO_FARM_ADDRESS.address,
    DEMO_FARM_ADDRESS.postalcode,
  )
  await setGrazingIntention(fdm, principal, b_id_farm, year, true)
  await enableFertilizerCatalogue(fdm, principal, b_id_farm, "baat")
  await enableFertilizerCatalogue(fdm, principal, b_id_farm, b_id_farm)
  await enableCultivationCatalogue(fdm, principal, b_id_farm, "brp")
  await enableMeasureCatalogue(fdm, principal, b_id_farm, "bln")

  const fertilizers = new Map<string, string>()
  for (const fertilizer of await getFertilizersFromCatalogue(fdm, principal, b_id_farm)) {
    const p_id = await addFertilizer(
      fdm,
      principal,
      fertilizer.p_id_catalogue,
      b_id_farm,
      null,
      null,
    )
    fertilizers.set(fertilizer.p_id_catalogue, p_id)
  }
  const fertilizerId = (key: FertilizerKey) => {
    const p_id = fertilizers.get(FERTILIZERS[key])
    if (!p_id) throw new Error(`Fertilizer ${FERTILIZERS[key]} is missing from the catalogue`)
    return p_id
  }

  const fields: DemoFarmIds["fields"] = {}
  const records: DemoFarmIds["records"] = {}
  const seeded = variant === "demo" ? FIELDS : FIELDS.filter((f) => MINIMAL_FIELDS.includes(f.key))
  for (const field of seeded) {
    const b_id = await addField(
      fdm,
      principal,
      b_id_farm,
      field.name,
      null,
      outline(field.key),
      date(year - 5, 1, 1),
      "nl_01",
    )
    fields[field.key] = b_id
    const fieldRecords: SeededFieldRecords = {
      cultivations: [],
      harvests: [],
      applications: [],
      soilAnalyses: [],
    }
    records[field.key] = fieldRecords

    for (const cultivation of field.cultivations) {
      const [startMonth, startDay, startOffset = 0] = cultivation.start
      const end = cultivation.end
      const b_lu = await addCultivation(
        fdm,
        principal,
        cultivation.catalogue,
        b_id,
        date(year + startOffset, startMonth, startDay),
        end ? date(year + (end[2] ?? 0), end[0], end[1]) : undefined,
      )
      fieldRecords.cultivations.push(b_lu)
      for (const harvest of cultivation.harvests ?? []) {
        const b_id_harvesting = await addHarvest(
          fdm,
          principal,
          b_lu,
          date(year, harvest.date[0], harvest.date[1]),
          harvest.properties,
        )
        fieldRecords.harvests.push(b_id_harvesting)
      }
    }

    for (const application of field.applications) {
      const p_app_id = await addFertilizerApplication(
        fdm,
        principal,
        b_id,
        fertilizerId(application.fertilizer),
        application.amount,
        application.method,
        date(year, application.date[0], application.date[1]),
      )
      fieldRecords.applications.push(p_app_id)
    }

    // In the current year: the balances only use soil analyses sampled in the calendar year.
    // Each analysis has its subsample locations and the zone it represents: the whole field, or
    // the western and eastern half of it.
    const fieldOutline = outline(field.key)
    const zones: [Polygon | MultiPolygon, typeof field.soil.data][] = field.soil.eastZone
      ? (() => {
          const [west, east] = splitWestEast(fieldOutline)
          return [
            [west, field.soil.data],
            [east, { ...field.soil.data, ...field.soil.eastZone }],
          ]
        })()
      : [[fieldOutline, field.soil.data]]
    for (const [zone, data] of zones) {
      const a_id = await addSoilAnalysis(
        fdm,
        principal,
        date(year, 1, 20),
        "other",
        b_id,
        field.soil.depthLower,
        date(year, 1, 20),
        { ...data, b_sampling_geometry: samplingPoints(zone), b_sampling_geometry_zone: zone },
      )
      fieldRecords.soilAnalyses.push(a_id)
    }
  }

  if (variant === "demo") {
    for (const measure of MEASURES) {
      await addMeasure(
        fdm,
        principal,
        fieldId(fields, measure.field),
        measure.m_id,
        date(year + measure.startYearOffset, 1, 1),
      )
    }
    // Stored like the app does: a soil analysis with only the visual scores, 25 cm deep.
    for (const assessment of BCS_ASSESSMENTS) {
      const day = date(year, assessment.date[0], assessment.date[1])
      await addSoilAnalysis(
        fdm,
        principal,
        day,
        "other",
        fieldId(fields, assessment.field),
        25,
        day,
        assessment.scores,
      )
    }
  }

  return {
    variant,
    farm: b_id_farm,
    fields,
    records,
    fertilizers: Object.fromEntries(fertilizers),
    year,
    email: user.email,
    principalId: principal,
  }
}
