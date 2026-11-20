/**
 * The synthetic demo user and farm for the end-to-end tests and the manual screenshots.
 *
 * The user, the farm, the field names and all farm data are made up. Only the field outlines are
 * real: public BRP parcels near Wageningen (`fields.geojson`), so the maps look realistic.
 */

/** The demo user. `example.com` is reserved for examples and never receives e-mail. */
export const DEMO_USER = {
  email: "demo@example.com",
  username: "demo",
  firstname: "Demo",
  surname: "Gebruiker",
} as const

/** The name of the demo farm. */
export const DEMO_FARM_NAME = "Demobedrijf De Proefhoeve"

/** A made-up address. The farm has no KvK number, because a made-up one could be real. */
export const DEMO_FARM_ADDRESS = {
  address: "Proefhoeveweg 1, Wageningen",
  postalcode: "6700 AA",
} as const

/**
 * The year of the demo data and of every captured page: always the current year in the
 * Netherlands, so the manual shows what users see now.
 *
 * @param now - The moment to take the year from (default: now).
 * @returns The year, such as 2026.
 */
export function demoYear(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en", { timeZone: "Europe/Amsterdam", year: "numeric" }).format(now),
  )
}

/** Keys of the demo fields, as used in `{field:<key>}` placeholders of capture definitions. */
export type DemoFieldKey =
  | "grasland-huiskavel"
  | "grasland-achter"
  | "mais"
  | "tarwe"
  | "aardappelen"

/** Which data the seed creates: `minimal` for smoke tests, `demo` for the manual screenshots. */
export type SeedVariant = "minimal" | "demo"

/** The user that the seed signs up and that owns the farm. */
export interface SeedUser {
  email: string
  username: string
  firstname: string
  surname: string
}

/** The records seeded on one field, by type. Each list follows the order of the seed data. */
export interface SeededFieldRecords {
  /** Cultivation ids (`b_lu`). */
  cultivations: string[]
  /** Harvest ids (`b_id_harvesting`) of all cultivations. */
  harvests: string[]
  /** Fertilizer application ids (`p_app_id`). */
  applications: string[]
  /** Soil analysis ids (`a_id`). */
  soilAnalyses: string[]
}

/** What the seed created, read by the tests to fill in routes. */
export interface DemoFarmIds {
  variant: SeedVariant
  farm: string
  /** Field ids by key; the `minimal` variant has only some of the fields. */
  fields: Partial<Record<DemoFieldKey, string>>
  /** Records on each seeded field, by field key. */
  records: Partial<Record<DemoFieldKey, SeededFieldRecords>>
  /** Fertilizer ids (`p_id`) of the farm, by catalogue id (`p_id_catalogue`). */
  fertilizers: Record<string, string>
  year: number
  /** The e-mail address of the demo user. */
  email: string
  /** The id of the demo user, which is also its principal id. */
  principalId: string
}
