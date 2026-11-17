/**
 * Opens pages as the signed-in owner of the seeded farm and checks that their main labels are
 * there, and that pages with other data (a certified farm, a soil structure assessment, a farm
 * without fields) show it. The route crawler only checks that a page loads without errors; this
 * catches pages that load but show the wrong content.
 *
 * Every test fails on an error page, a 5xx response or an error in the browser.
 */
import {
  addFarm,
  addOrganicCertification,
  addSoilAnalysis,
  createFdmServer,
  getCultivation,
} from "@nmi-agro/fdm-core"
import { expect, test } from "@playwright/test"
import { ERROR_TEXTS, guardPage, type PageGuard } from "../support/app"
import { databaseOptions } from "../support/env"
import { SIGNED_OUT_STATE_FILE } from "./paths"
import { readSmokeFarm } from "./smoke-farm"

// Serial: the tests with other data add records to the seeded farm after the label checks.
test.describe.configure({ mode: "serial", retries: 0 })

let guard: PageGuard

test.beforeEach(async ({ page }) => {
  guard = await guardPage(page)
})

test.afterEach(async ({ page }) => {
  for (const text of ERROR_TEXTS) {
    await expect(page.getByText(text), "The page should not show an error").toHaveCount(0)
  }
  expect(guard.problems(), "The page should load without errors").toEqual([])
})

/**
 * Runs `run` with a short-lived connection to the test database.
 *
 * @param run - The work to do with the connection.
 * @returns What `run` returns.
 */
async function withFdm<T>(
  run: (fdm: ReturnType<typeof createFdmServer>) => Promise<T>,
): Promise<T> {
  const { host, port, user, password, database } = databaseOptions()
  const fdm = createFdmServer(host, port, user, password, database, 1)
  try {
    return await run(fdm)
  } finally {
    await (fdm as unknown as { $client: { end: () => Promise<void> } }).$client.end()
  }
}

/** The ids a page path is built from. */
interface Ids {
  farm: string
  year: string
  field: string
  analysis: string
  slug: string
  group: string
  cultivation: string
}

let cultivationCode = ""

test.beforeAll(async () => {
  const farm = readSmokeFarm()
  const b_lu = farm.records["grasland-huiskavel"]?.cultivations[0] ?? ""
  cultivationCode = await withFdm(
    async (fdm) => (await getCultivation(fdm, farm.principalId, b_lu)).b_lu_catalogue,
  )
})

function ids(): Ids {
  const farm = readSmokeFarm()
  return {
    farm: farm.farm,
    year: String(farm.year),
    field: farm.fields["grasland-huiskavel"] ?? "",
    analysis: farm.records["grasland-huiskavel"]?.soilAnalyses[0] ?? "",
    slug: farm.organization.slug,
    group: farm.organization.group,
    cultivation: cultivationCode,
  }
}

/** A page to open: its path and a label it shows. */
interface PageCase {
  name: string
  path: (ids: Ids) => string
  label: string
  /** Open as a signed-out visitor. */
  signedOut?: boolean
}

const farmPath = (i: Ids) => `/farm/${i.farm}/${i.year}`

const pages: PageCase[] = [
  // Farm
  {
    name: "farm overview",

    path: () => "/farm",
    label: "Kies een bedrijf",
  },
  {
    name: "farm dashboard",

    path: (i) => `/farm/${i.farm}`,
    label: "Een overzicht van de bedrijfsgegevens en applicaties",
  },
  {
    name: "farm properties",

    path: (i) => `/farm/${i.farm}/settings/properties`,
    label: "Bedrijfsnaam",
  },
  {
    name: "organic certification",

    path: (i) => `/farm/${i.farm}/settings/organic-certification`,
    label: "Dit bedrijf heeft geen bio-certificaat",
  },
  {
    name: "new fertilizer",

    path: (i) => `/farm/${i.farm}/fertilizers/new`,
    label: "Meststof toevoegen",
  },
  // Farm per year
  {
    name: "fields layout",

    path: (i) => `${farmPath(i)}/field`,
    label: "Nieuw perceel",
  },
  {
    name: "field overview",

    path: (i) => `${farmPath(i)}/field/${i.field}`,
    label: "Perceeldetails",
  },
  {
    name: "field settings",

    path: (i) => `${farmPath(i)}/field/${i.field}/settings`,
    label: "Perceelsnaam",
  },
  {
    name: "field soil",

    path: (i) => `${farmPath(i)}/field/${i.field}/soil`,
    label: "Bodemanalyse toevoegen",
  },
  {
    name: "field soil analysis",

    path: (i) => `${farmPath(i)}/field/${i.field}/soil/analysis/${i.analysis}`,
    label: "N-totale bodemvoorraad",
  },
  {
    name: "new soil analysis",

    path: (i) => `${farmPath(i)}/field/${i.field}/soil/analysis/new`,
    label: "Zelf invoeren",
  },
  {
    name: "new soil analysis by type",

    path: (i) => `${farmPath(i)}/field/${i.field}/soil/analysis/new/standard`,
    label: "Laboratorium dat de analyse heeft gedaan",
  },
  {
    name: "upload soil analysis",

    path: (i) => `${farmPath(i)}/field/${i.field}/soil/analysis/new/upload`,
    label: "PDF uitlezen",
  },
  {
    name: "soil structure (BCS)",

    path: (i) => `${farmPath(i)}/field/${i.field}/bcs`,
    label: "Nog geen BodemConditieScore",
  },
  {
    name: "rotation",

    path: (i) => `${farmPath(i)}/rotation`,
    label: "Oogst toevoegen",
  },
  {
    name: "rotation harvests",

    path: (i) => `${farmPath(i)}/rotation/harvest?cultivationIds=${i.cultivation}`,
    label: "Snede toevoegen",
  },
  {
    name: "mineralization",

    path: (i) => `${farmPath(i)}/mineralization`,
    label: "Aandacht nodig",
  },
  {
    name: "mineralization of a field",

    path: (i) => `${farmPath(i)}/mineralization/${i.field}`,
    label: "Stikstofaanbod, opname door het gewas en uitspoeling door het seizoen heen.",
  },
  {
    name: "norms of a field",

    path: (i) => `${farmPath(i)}/norms/${i.field}`,
    label: "Terug naar gebruiksruimte",
  },
  {
    name: "nutrient advice layout",

    path: (i) => `${farmPath(i)}/nutrient_advice`,
    label: "Bemestingsadvies",
  },
  {
    name: "nutrient advice",

    path: (i) => `${farmPath(i)}/nutrient_advice`,
    label: "Bedrijfsgemiddelde",
  },
  {
    name: "indicators",

    path: (i) => `${farmPath(i)}/indicators`,
    label: "Indicatoren",
  },
  {
    name: "indicators of a field",

    path: (i) => `${farmPath(i)}/indicators/${i.field}`,
    label: "indicatoren",
  },
  {
    name: "measures of a field",

    path: (i) => `${farmPath(i)}/measures/${i.field}`,
    label: "Nog geen maatregelen vastgelegd",
  },
  {
    name: "gerrit",

    path: (i) => `${farmPath(i)}/gerrit`,
    label: "Bedrijfsstrategie",
  },
  {
    name: "rvo",

    path: (i) => `${farmPath(i)}/rvo`,
    label: "Percelen ophalen bij RVO",
  },
  // Atlas
  {
    name: "atlas nutrient advice",
    path: (i) => `${farmPath(i)}/atlas/nutrient-advice`,
    label: "Nog te geven",
  },
  {
    name: "atlas soil analyses",

    path: (i) => `${farmPath(i)}/atlas/soil-analysis`,
    label: "OS (%)",
  },
  {
    name: "atlas soil analyses of a field",

    path: (i) => `${farmPath(i)}/atlas/soil-analysis/${i.field}`,
    label: "Terug naar kaart",
  },
  {
    name: "atlas soil analysis",

    path: (i) => `${farmPath(i)}/atlas/soil-analysis/${i.field}/soil/analysis/${i.analysis}`,
    label: "Bemonsterde zone",
  },
  // Create a farm
  {
    name: "create: farm",

    path: (i) => `/farm/create/${i.farm}/${i.year}`,
    label: "Percelen importeren",
  },
  {
    name: "create: access",

    path: (i) => `/farm/create/${i.farm}/${i.year}/access`,
    label: "Toegang instellen",
  },
  {
    name: "create: fields",

    path: (i) => `/farm/create/${i.farm}/${i.year}/fields`,
    label: "met bodemanalyse",
  },
  {
    name: "create: soil analyses",

    path: (i) => `/farm/create/${i.farm}/${i.year}/fields/${i.field}/soil/analysis`,
    label: "Standaard bodemanalyse",
  },
  {
    name: "create: soil analysis by type",

    path: (i) => `/farm/create/${i.farm}/${i.year}/fields/${i.field}/soil/analysis/standard`,
    label: "Voeg een nieuwe bodemanalyse toe",
  },
  {
    name: "create: rotation",

    path: (i) => `/farm/create/${i.farm}/${i.year}/rotation`,
    label: "Bouwplan van",
  },
  // Organization
  {
    name: "organizations",

    path: () => "/organization",
    label: "Demo Adviesbureau",
  },
  {
    name: "organization dashboard",

    path: (i) => `/organization/${i.slug}`,
    label: "Dashboard van Demo Adviesbureau",
  },
  {
    name: "organization members",

    path: (i) => `/organization/${i.slug}/members`,
    label: "Leden van Demo Adviesbureau",
  },
  {
    name: "organization farms",

    path: (i) => `/organization/${i.slug}/${i.year}/farms`,
    label: "Bedrijven met toegang door Demo Adviesbureau",
  },
  {
    name: "organization groups",

    path: (i) => `/organization/${i.slug}/${i.year}/groups`,
    label: "Groepen van Demo Adviesbureau",
  },
  {
    name: "organization group",

    path: (i) => `/organization/${i.slug}/${i.year}/groups/${i.group}`,
    label: "Demo groep",
  },
  {
    name: "organization indicators",

    path: (i) => `/organization/${i.slug}/${i.year}/indicators`,
    label: "Gemiddelde score van de organisatie",
  },
  {
    name: "organization nitrogen balance",

    path: (i) => `/organization/${i.slug}/${i.year}/balance/nitrogen`,
    label: "Stikstof",
  },
  {
    name: "organization organic matter balance",

    path: (i) => `/organization/${i.slug}/${i.year}/balance/organic-matter`,
    label: "Organische stof",
  },
  // User, support and sign-in
  {
    name: "profile",

    path: () => "/user/settings/profile",
    label: "Jouw gegevens",
  },
  {
    name: "API keys",

    path: () => "/user/settings/api-keys",
    label: "Geen API-sleutels gevonden",
  },
  {
    name: "welcome",

    path: () => "/welcome",
    label: "Profiel voltooien",
  },
  {
    name: "support tickets",

    path: () => "/support",
    label: "Mijn tickets",
  },
  {
    name: "privacy",

    path: () => "/privacy",
    label: "Terug naar aanmelden",
    signedOut: true,
  },
  {
    name: "sign in",

    path: () => "/signin",
    label: "Aanmelden met e-mail",
    signedOut: true,
  },
  {
    name: "check your e-mail",

    path: () => "/signin/check-your-email",
    label: "Controleer je e-mail inbox",
    signedOut: true,
  },
  {
    name: "verify sign-in",

    path: () => "/signin/verify",
    label: "Verifieer je code",
    signedOut: true,
  },
]

for (const signedOut of [false, true]) {
  test.describe(signedOut ? "pages of a signed-out visitor" : "pages", () => {
    if (signedOut) test.use({ storageState: SIGNED_OUT_STATE_FILE })
    for (const { name, path, label } of pages.filter((p) => !!p.signedOut === signedOut)) {
      test(`shows ${name}`, async ({ page }) => {
        const response = await page.goto(path(ids()), { waitUntil: "networkidle" })
        expect(response?.status()).toBe(200)
        await expect(page.getByText(label).first()).toBeVisible()
      })
    }
  })
}

test.describe("pages with other data", () => {
  let certifiedFarm = ""
  let emptyFarm = ""
  let bcsAnalysis = ""

  test.beforeAll(async () => {
    const farm = readSmokeFarm()
    const field = farm.fields.tarwe ?? ""
    await withFdm(async (fdm) => {
      certifiedFarm = await addFarm(fdm, farm.principalId, "Biotestbedrijf", null, null, "6700 AA")
      // Made-up certificate numbers in the formats that fdm-core accepts.
      await addOrganicCertification(
        fdm,
        farm.principalId,
        certifiedFarm,
        "NL-BIO-01.528-0000001.2026.001",
        "012345",
        new Date(Date.UTC(farm.year, 0, 1)),
        new Date(Date.UTC(farm.year + 1, 0, 1)),
      )
      emptyFarm = await addFarm(fdm, farm.principalId, "Leeg testbedrijf", null, null, "6700 AA")
      // A random day, so a run with E2E_REUSE_SEED=1 does not add the same sample twice.
      const sampled = new Date(Date.UTC(farm.year, 3, 1 + Math.floor(Math.random() * 28)))
      bcsAnalysis = await addSoilAnalysis(
        fdm,
        farm.principalId,
        sampled,
        "other",
        field,
        25,
        sampled,
        {
          a_ss_bcs: 1,
          a_sc_bcs: 1,
          a_rd_bcs: 2,
          a_ew_bcs: 1,
          a_cc_bcs: 2,
          a_gs_bcs: 1,
          a_p_bcs: 1,
          a_c_bcs: 1,
          a_rt_bcs: 2,
        },
      )
    })
  })

  test("shows the organic certificate of a certified farm", async ({ page }) => {
    await page.goto(`/farm/${certifiedFarm}/settings/organic-certification`)
    await expect(page.getByText("TRACES-nummer").first()).toBeVisible()
    await expect(page.getByText("SKAL-nummer").first()).toBeVisible()
  })

  test("lists a soil structure (BCS) assessment", async ({ page }) => {
    const farm = readSmokeFarm()
    await page.goto(`/farm/${farm.farm}/${farm.year}/field/${farm.fields.tarwe}/bcs`)
    await expect(page.getByText("Verwijderen").first()).toBeVisible()
    await expect(page.getByText("Nog geen BodemConditieScore")).toHaveCount(0)
  })

  test("shows a soil structure (BCS) assessment", async ({ page }) => {
    const farm = readSmokeFarm()
    await page.goto(`/farm/${farm.farm}/${farm.year}/field/${farm.fields.tarwe}/bcs/${bcsAnalysis}`)
    await expect(page.getByText("Bewerken").first()).toBeVisible()
  })

  test("asks to add fields to the nutrient advice of a farm without fields", async ({ page }) => {
    const farm = readSmokeFarm()
    await page.goto(`/farm/${emptyFarm}/${farm.year}/nutrient_advice`)
    await expect(page.getByText("Naar bedrijfsoverzicht").first()).toBeVisible()
  })

  test("asks to add fields to the mineralization of a farm without fields", async ({ page }) => {
    const farm = readSmokeFarm()
    await page.goto(`/farm/${emptyFarm}/${farm.year}/mineralization`)
    await expect(page.getByText("Percelen toevoegen").first()).toBeVisible()
  })

  test("offers the supported years in the AI assistant for another year", async ({ page }) => {
    const farm = readSmokeFarm()
    await page.goto(`/farm/${farm.farm}/2024/gerrit`)
    await expect(page.getByText("Switch naar 2025").first()).toBeVisible()
  })
})
