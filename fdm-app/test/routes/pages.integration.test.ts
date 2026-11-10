/**
 * Renders pages with the data of their loader, as the server does, and checks that the main
 * labels are there. This catches pages that fail to render with real data, such as a component
 * that expects a prop or context it does not get.
 */
import {
  addFarm,
  addOrganicCertification,
  addSoilAnalysis,
  getCultivation,
} from "@nmi-agro/fdm-core"
import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import { fdm } from "~/lib/fdm.server"
import { seedOrganization, type SeededOrganization } from "../../e2e/seed/organization"
import {
  type PageModule,
  renderPage,
  type SeededUser,
  seedUserWithFarm,
  sessionCookie,
} from "../helpers"
import { signInAs } from "../session"

let owner: SeededUser
let organization: SeededOrganization
let cookie: string
let cultivationCode: string

beforeAll(async () => {
  owner = await seedUserWithFarm("viewer")
  const slug = `test-adviesbureau-${randomUUID().slice(0, 8)}`
  organization = await seedOrganization(
    fdm as unknown as Parameters<typeof seedOrganization>[0],
    owner.user.id,
    owner.ids.farm,
    owner.ids.year,
    { name: "Test Adviesbureau", slug },
  )
  cookie = await sessionCookie(owner.user)
  const b_lu = owner.ids.records["grasland-huiskavel"]?.cultivations[0] ?? ""
  cultivationCode = (await getCultivation(fdm, owner.user.id, b_lu)).b_lu_catalogue
})

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

function ids(): Ids {
  const records = owner.ids.records["grasland-huiskavel"]
  return {
    farm: owner.ids.farm,
    year: String(owner.ids.year),
    field: owner.ids.fields["grasland-huiskavel"] ?? "",
    analysis: records?.soilAnalyses[0] ?? "",
    slug: organization.slug,
    group: organization.group,
    cultivation: cultivationCode,
  }
}

/** A page to render: its module, route pattern, path and a label it shows. */
interface PageCase {
  name: string
  page: () => Promise<PageModule>
  pattern: string
  path: (ids: Ids) => string
  label: string
  /** Render as a signed-out visitor. */
  signedOut?: boolean
}

const farm = "/farm/:b_id_farm/:calendar"
const farmPath = (i: Ids) => `/farm/${i.farm}/${i.year}`
const org = "/organization/:slug"

const pages: PageCase[] = [
  // Farm
  {
    name: "farm overview",
    page: () => import("~/routes/farm._index"),
    pattern: "/farm",
    path: () => "/farm",
    label: "Kies een bedrijf",
  },
  {
    name: "farm dashboard",
    page: () => import("~/routes/farm.$b_id_farm._index"),
    pattern: "/farm/:b_id_farm",
    path: (i) => `/farm/${i.farm}`,
    label: "Een overzicht van de bedrijfsgegevens en applicaties",
  },
  {
    name: "farm properties",
    page: () => import("~/routes/farm.$b_id_farm.settings.properties"),
    pattern: "/farm/:b_id_farm/settings/properties",
    path: (i) => `/farm/${i.farm}/settings/properties`,
    label: "Bedrijfsnaam",
  },
  {
    name: "organic certification",
    page: () => import("~/routes/farm.$b_id_farm.settings.organic-certification"),
    pattern: "/farm/:b_id_farm/settings/organic-certification",
    path: (i) => `/farm/${i.farm}/settings/organic-certification`,
    label: "Dit bedrijf heeft geen bio-certificaat",
  },
  {
    name: "new fertilizer",
    page: () => import("~/routes/farm.$b_id_farm.fertilizers.new._index"),
    pattern: "/farm/:b_id_farm/fertilizers/new",
    path: (i) => `/farm/${i.farm}/fertilizers/new`,
    label: "Meststof toevoegen",
  },
  // Farm per year
  {
    name: "fields layout",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.field"),
    pattern: `${farm}/field`,
    path: (i) => `${farmPath(i)}/field`,
    label: "Nieuw perceel",
  },
  {
    name: "field overview",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.field.$b_id._index"),
    pattern: `${farm}/field/:b_id`,
    path: (i) => `${farmPath(i)}/field/${i.field}`,
    label: "Perceeldetails",
  },
  {
    name: "field settings",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.field.$b_id.settings"),
    pattern: `${farm}/field/:b_id/settings`,
    path: (i) => `${farmPath(i)}/field/${i.field}/settings`,
    label: "Perceelsnaam",
  },
  {
    name: "field soil",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.field.$b_id.soil._index"),
    pattern: `${farm}/field/:b_id/soil`,
    path: (i) => `${farmPath(i)}/field/${i.field}/soil`,
    label: "Bodemanalyse toevoegen",
  },
  {
    name: "field soil analysis",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.field.$b_id.soil.analysis.$a_id"),
    pattern: `${farm}/field/:b_id/soil/analysis/:a_id`,
    path: (i) => `${farmPath(i)}/field/${i.field}/soil/analysis/${i.analysis}`,
    label: "N-totale bodemvoorraad",
  },
  {
    name: "new soil analysis",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.field.$b_id.soil.analysis.new._index"),
    pattern: `${farm}/field/:b_id/soil/analysis/new`,
    path: (i) => `${farmPath(i)}/field/${i.field}/soil/analysis/new`,
    label: "PDF-rapport uploaden",
  },
  {
    name: "new soil analysis by type",
    page: () =>
      import("~/routes/farm.$b_id_farm.$calendar.field.$b_id.soil.analysis.new.$analysis_type"),
    pattern: `${farm}/field/:b_id/soil/analysis/new/:analysis_type`,
    path: (i) => `${farmPath(i)}/field/${i.field}/soil/analysis/new/standard`,
    label: "Laboratorium dat de analyse heeft gedaan",
  },
  {
    name: "upload soil analysis",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.field.$b_id.soil.analysis.new.upload"),
    pattern: `${farm}/field/:b_id/soil/analysis/new/upload`,
    path: (i) => `${farmPath(i)}/field/${i.field}/soil/analysis/new/upload`,
    label: "PDF uitlezen",
  },
  {
    name: "soil structure (BCS)",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.field.$b_id.bcs._index"),
    pattern: `${farm}/field/:b_id/bcs`,
    path: (i) => `${farmPath(i)}/field/${i.field}/bcs`,
    label: "Nog geen BodemConditieScore",
  },
  {
    name: "rotation",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.rotation"),
    pattern: `${farm}/rotation`,
    path: (i) => `${farmPath(i)}/rotation`,
    label: "Oogst toevoegen",
  },
  {
    name: "rotation harvests",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.rotation_.harvest._index"),
    pattern: `${farm}/rotation/harvest`,
    path: (i) => `${farmPath(i)}/rotation/harvest?cultivationIds=${i.cultivation}`,
    label: "Snede toevoegen",
  },
  {
    name: "mineralization",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.mineralization._index"),
    pattern: `${farm}/mineralization`,
    path: (i) => `${farmPath(i)}/mineralization`,
    label: "Aandacht nodig",
  },
  {
    name: "mineralization of a field",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.mineralization.$b_id._index"),
    pattern: `${farm}/mineralization/:b_id`,
    path: (i) => `${farmPath(i)}/mineralization/${i.field}`,
    label: "De stikstof door het seizoen wordt berekend",
  },
  {
    name: "norms of a field",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.norms.$b_id"),
    pattern: `${farm}/norms/:b_id`,
    path: (i) => `${farmPath(i)}/norms/${i.field}`,
    label: "Terug naar gebruiksruimte",
  },
  {
    name: "nutrient advice layout",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.nutrient_advice"),
    pattern: `${farm}/nutrient_advice`,
    path: (i) => `${farmPath(i)}/nutrient_advice`,
    label: "Bemestingsadvies",
  },
  {
    name: "nutrient advice",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.nutrient_advice._index"),
    pattern: `${farm}/nutrient_advice`,
    path: (i) => `${farmPath(i)}/nutrient_advice`,
    label: "Bedrijfsgemiddelde",
  },
  {
    name: "indicators",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.indicators._index"),
    pattern: `${farm}/indicators`,
    path: (i) => `${farmPath(i)}/indicators`,
    label: "Bedrijfsgemiddelde score",
  },
  {
    name: "indicators of a field",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.indicators.$b_id"),
    pattern: `${farm}/indicators/:b_id`,
    path: (i) => `${farmPath(i)}/indicators/${i.field}`,
    label: "Perceelsscore",
  },
  {
    name: "measures of a field",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.measures.$b_id"),
    pattern: `${farm}/measures/:b_id`,
    path: (i) => `${farmPath(i)}/measures/${i.field}`,
    label: "Nog geen maatregelen vastgelegd",
  },
  {
    name: "gerrit",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.gerrit"),
    pattern: `${farm}/gerrit`,
    path: (i) => `${farmPath(i)}/gerrit`,
    label: "Bedrijfsstrategie",
  },
  {
    name: "rvo",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.rvo"),
    pattern: `${farm}/rvo`,
    path: (i) => `${farmPath(i)}/rvo`,
    label: "Percelen ophalen bij RVO",
  },
  // Atlas
  {
    name: "atlas field details",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.atlas.fields.$centroid"),
    pattern: `${farm}/atlas/fields/:centroid`,
    path: (i) => `${farmPath(i)}/atlas/fields/5.6633,51.9692`,
    label: "Gewashistorie",
  },
  {
    name: "atlas nutrient advice",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.atlas.nutrient-advice._index"),
    pattern: `${farm}/atlas/nutrient-advice`,
    path: (i) => `${farmPath(i)}/atlas/nutrient-advice`,
    label: "Nog te geven",
  },
  {
    name: "atlas soil analyses",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.atlas.soil-analysis._index"),
    pattern: `${farm}/atlas/soil-analysis`,
    path: (i) => `${farmPath(i)}/atlas/soil-analysis`,
    label: "OS (%)",
  },
  {
    name: "atlas soil analyses of a field",
    page: () => import("~/routes/farm.$b_id_farm.$calendar.atlas_.soil-analysis.$b_id"),
    pattern: `${farm}/atlas/soil-analysis/:b_id`,
    path: (i) => `${farmPath(i)}/atlas/soil-analysis/${i.field}`,
    label: "Terug naar kaart",
  },
  {
    name: "atlas soil analysis",
    page: () =>
      import("~/routes/farm.$b_id_farm.$calendar.atlas_.soil-analysis.$b_id.soil.analysis.$a_id"),
    pattern: `${farm}/atlas/soil-analysis/:b_id/soil/analysis/:a_id`,
    path: (i) => `${farmPath(i)}/atlas/soil-analysis/${i.field}/soil/analysis/${i.analysis}`,
    label: "Bemonsterde zone",
  },
  // Create a farm
  {
    name: "create: farm",
    page: () => import("~/routes/farm.create.$b_id_farm.$calendar._index"),
    pattern: "/farm/create/:b_id_farm/:calendar",
    path: (i) => `/farm/create/${i.farm}/${i.year}`,
    label: "Percelen importeren",
  },
  {
    name: "create: access",
    page: () => import("~/routes/farm.create.$b_id_farm.$calendar.access"),
    pattern: "/farm/create/:b_id_farm/:calendar/access",
    path: (i) => `/farm/create/${i.farm}/${i.year}/access`,
    label: "Toegang instellen",
  },
  {
    name: "create: fields",
    page: () => import("~/routes/farm.create.$b_id_farm.$calendar.fields"),
    pattern: "/farm/create/:b_id_farm/:calendar/fields",
    path: (i) => `/farm/create/${i.farm}/${i.year}/fields`,
    label: "met bodemanalyse",
  },
  {
    name: "create: soil analyses",
    page: () =>
      import("~/routes/farm.create.$b_id_farm.$calendar.fields.$b_id.soil.analysis._index"),
    pattern: "/farm/create/:b_id_farm/:calendar/fields/:b_id/soil/analysis",
    path: (i) => `/farm/create/${i.farm}/${i.year}/fields/${i.field}/soil/analysis`,
    label: "Standaard bodemanalyse",
  },
  {
    name: "create: soil analysis by type",
    page: () =>
      import("~/routes/farm.create.$b_id_farm.$calendar.fields.$b_id.soil.analysis.$analysis_type"),
    pattern: "/farm/create/:b_id_farm/:calendar/fields/:b_id/soil/analysis/:analysis_type",
    path: (i) => `/farm/create/${i.farm}/${i.year}/fields/${i.field}/soil/analysis/standard`,
    label: "Voeg een nieuwe bodemanalyse toe",
  },
  {
    name: "create: rotation",
    page: () => import("~/routes/farm.create.$b_id_farm.$calendar.rotation"),
    pattern: "/farm/create/:b_id_farm/:calendar/rotation",
    path: (i) => `/farm/create/${i.farm}/${i.year}/rotation`,
    label: "Bouwplan van",
  },
  // Organization
  {
    name: "organizations",
    page: () => import("~/routes/organization._index"),
    pattern: "/organization",
    path: () => "/organization",
    label: "Test Adviesbureau",
  },
  {
    name: "organization dashboard",
    page: () => import("~/routes/organization.$slug._index"),
    pattern: org,
    path: (i) => `/organization/${i.slug}`,
    label: "Dashboard van Test Adviesbureau",
  },
  {
    name: "organization members",
    page: () => import("~/routes/organization.$slug.members"),
    pattern: `${org}/members`,
    path: (i) => `/organization/${i.slug}/members`,
    label: "Leden van Test Adviesbureau",
  },
  {
    name: "organization farms",
    page: () => import("~/routes/organization.$slug.$calendar.farms._index"),
    pattern: `${org}/:calendar/farms`,
    path: (i) => `/organization/${i.slug}/${i.year}/farms`,
    label: "Bedrijven met toegang door Test Adviesbureau",
  },
  {
    name: "organization groups",
    page: () => import("~/routes/organization.$slug.$calendar.groups._index"),
    pattern: `${org}/:calendar/groups`,
    path: (i) => `/organization/${i.slug}/${i.year}/groups`,
    label: "Groepen van Test Adviesbureau",
  },
  {
    name: "organization group",
    page: () => import("~/routes/organization.$slug.$calendar.groups.$b_id_group"),
    pattern: `${org}/:calendar/groups/:b_id_group`,
    path: (i) => `/organization/${i.slug}/${i.year}/groups/${i.group}`,
    label: "Demo groep",
  },
  {
    name: "organization indicators",
    page: () => import("~/routes/organization.$slug.$calendar.indicators"),
    pattern: `${org}/:calendar/indicators`,
    path: (i) => `/organization/${i.slug}/${i.year}/indicators`,
    label: "Gemiddelde score van de organisatie",
  },
  {
    name: "organization nitrogen balance",
    page: () => import("~/routes/organization.$slug.$calendar.balance.nitrogen._index"),
    pattern: `${org}/:calendar/balance/nitrogen`,
    path: (i) => `/organization/${i.slug}/${i.year}/balance/nitrogen`,
    label: "Stikstof",
  },
  {
    name: "organization organic matter balance",
    page: () => import("~/routes/organization.$slug.$calendar.balance.organic-matter._index"),
    pattern: `${org}/:calendar/balance/organic-matter`,
    path: (i) => `/organization/${i.slug}/${i.year}/balance/organic-matter`,
    label: "Organische stof",
  },
  // User, support and sign-in
  {
    name: "profile",
    page: () => import("~/routes/user.settings.profile._index"),
    pattern: "/user/settings/profile",
    path: () => "/user/settings/profile",
    label: "Jouw gegevens",
  },
  {
    name: "API keys",
    page: () => import("~/routes/user.settings.api-keys"),
    pattern: "/user/settings/api-keys",
    path: () => "/user/settings/api-keys",
    label: "Geen API-sleutels gevonden",
  },
  {
    name: "welcome",
    page: () => import("~/routes/welcome"),
    pattern: "/welcome",
    path: () => "/welcome",
    label: "Profiel voltooien",
  },
  {
    name: "support tickets",
    page: () => import("~/routes/support._ticketviewer._index"),
    pattern: "/support",
    path: () => "/support",
    label: "Mijn tickets",
  },
  {
    name: "privacy",
    page: () => import("~/routes/privacy._index"),
    pattern: "/privacy",
    path: () => "/privacy",
    label: "Terug naar aanmelden",
    signedOut: true,
  },
  {
    name: "sign in",
    page: () => import("~/routes/signin._index"),
    pattern: "/signin",
    path: () => "/signin",
    label: "Aanmelden met e-mail",
    signedOut: true,
  },
  {
    name: "check your e-mail",
    page: () => import("~/routes/signin.check-your-email"),
    pattern: "/signin/check-your-email",
    path: () => "/signin/check-your-email",
    label: "Controleer je e-mail inbox",
    signedOut: true,
  },
  {
    name: "verify sign-in",
    page: () => import("~/routes/signin.verify"),
    pattern: "/signin/verify",
    path: () => "/signin/verify",
    label: "Verifieer je code",
    signedOut: true,
  },
]

describe("pages", () => {
  it.each(pages)("renders $name", async ({ page, pattern, path, label, signedOut }) => {
    signInAs(signedOut ? null : owner.user)
    const html = await renderPage(await page(), pattern, path(ids()), {
      cookie: signedOut ? undefined : cookie,
    })
    expect(html).toContain(label)
  })
})

describe("pages with other data", () => {
  let user: SeededUser
  let field: string
  let bcsAnalysis: string
  let emptyFarm: string

  beforeAll(async () => {
    user = await seedUserWithFarm("variant")
    field = user.ids.fields["grasland-huiskavel"] ?? ""
    // Made-up certificate numbers in the formats that fdm-core accepts.
    await addOrganicCertification(
      fdm,
      user.user.id,
      user.ids.farm,
      "NL-BIO-01.528-0000001.2026.001",
      "012345",
      new Date(Date.UTC(user.ids.year, 0, 1)),
      new Date(Date.UTC(user.ids.year + 1, 0, 1)),
    )
    const sampled = new Date(Date.UTC(user.ids.year, 3, 15))
    bcsAnalysis = await addSoilAnalysis(fdm, user.user.id, sampled, "other", field, 25, sampled, {
      a_ss_bcs: 1,
      a_sc_bcs: 1,
      a_rd_bcs: 2,
      a_ew_bcs: 1,
      a_cc_bcs: 2,
      a_gs_bcs: 1,
      a_p_bcs: 1,
      a_c_bcs: 1,
      a_rt_bcs: 2,
    })
    emptyFarm = await addFarm(fdm, user.user.id, "Leeg testbedrijf", null, null, "6700 AA")
  })

  const render = (page: PageModule, pattern: string, path: string) => {
    signInAs(user.user)
    return renderPage(page, pattern, path)
  }

  it("shows the organic certificate of a certified farm", async () => {
    const html = await render(
      await import("~/routes/farm.$b_id_farm.settings.organic-certification"),
      "/farm/:b_id_farm/settings/organic-certification",
      `/farm/${user.ids.farm}/settings/organic-certification`,
    )
    expect(html).toContain("TRACES-nummer")
    expect(html).toContain("SKAL-nummer")
  })

  it("lists a soil structure (BCS) assessment", async () => {
    const html = await render(
      await import("~/routes/farm.$b_id_farm.$calendar.field.$b_id.bcs._index"),
      `${farm}/field/:b_id/bcs`,
      `/farm/${user.ids.farm}/${user.ids.year}/field/${field}/bcs`,
    )
    expect(html).toContain("Verwijderen")
    expect(html).not.toContain("Nog geen BodemConditieScore")
  })

  it("shows a soil structure (BCS) assessment", async () => {
    const html = await render(
      await import("~/routes/farm.$b_id_farm.$calendar.field.$b_id.bcs.$a_id"),
      `${farm}/field/:b_id/bcs/:a_id`,
      `/farm/${user.ids.farm}/${user.ids.year}/field/${field}/bcs/${bcsAnalysis}`,
    )
    expect(html).toContain("Bewerken")
  })

  it("asks to add fields to the nutrient advice of a farm without fields", async () => {
    const html = await render(
      await import("~/routes/farm.$b_id_farm.$calendar.nutrient_advice._index"),
      `${farm}/nutrient_advice`,
      `/farm/${emptyFarm}/${user.ids.year}/nutrient_advice`,
    )
    expect(html).toContain("Naar bedrijfsoverzicht")
  })

  it("asks to add fields to the mineralization of a farm without fields", async () => {
    const html = await render(
      await import("~/routes/farm.$b_id_farm.$calendar.mineralization._index"),
      `${farm}/mineralization`,
      `/farm/${emptyFarm}/${user.ids.year}/mineralization`,
    )
    expect(html).toContain("Percelen toevoegen")
  })

  it("offers the supported years in the AI assistant for another year", async () => {
    const html = await render(
      await import("~/routes/farm.$b_id_farm.$calendar.gerrit"),
      `${farm}/gerrit`,
      `/farm/${user.ids.farm}/2024/gerrit`,
    )
    expect(html).toContain("Switch naar 2025")
  })
})
