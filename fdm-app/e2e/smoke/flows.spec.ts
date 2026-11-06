/**
 * Critical flows, clicked through as a user would. They run one after the other and only add
 * data to the seeded farm, so they do not depend on each other or disturb the route crawler.
 *
 * Every flow fails on an error page, a 5xx response or an error in the browser.
 */
import { expect, type Locator, type Page, test } from "@playwright/test"
import { ERROR_TEXTS, guardPage, latestChangelogVersion, type PageGuard } from "../support/app"
import { dismissNotices, signInWithMagicLink } from "../support/auth"
import { SIGNED_OUT_STATE_FILE } from "./paths"
import { readSmokeFarm } from "./smoke-farm"

// No retries: a retry would repeat steps that already changed the data, such as the invitation.
test.describe.configure({ mode: "serial", retries: 0 })

let guard: PageGuard

test.beforeEach(async ({ page }) => {
  guard = await guardPage(page)
})

test.afterEach(async ({ page }) => {
  for (const text of ERROR_TEXTS) {
    await expect(page.getByText(text), "The page should not show an error").toHaveCount(0)
  }
  expect(guard.problems(), "The flow should run without errors").toEqual([])
})

/**
 * Picks an option in one of the app's comboboxes.
 *
 * @param page - The page.
 * @param label - The label of the combobox, such as `Gewas`.
 * @param search - Text to type in the search box.
 * @param option - The option to pick.
 */
async function pickComboboxOption(page: Page, label: string, search: string, option: RegExp) {
  await page.getByRole("combobox").filter({ hasText: /.*/ }).and(page.getByLabel(label)).click()
  await page.getByPlaceholder("Begin met typen...").fill(search)
  await page.getByRole("option", { name: option }).first().click()
}

/**
 * Types a date into one of the app's date pickers.
 *
 * @param input - The text input of the date picker. Its label is not linked to the input, so
 *   find it by its placeholder.
 * @param date - The date as the user types it, such as `15-3-2026`.
 */
async function typeDate(input: Locator, date: string) {
  await input.fill(date)
  await input.blur()
}

test("create a farm", async ({ page }) => {
  await page.goto("/farm/create")
  await page.getByPlaceholder("Bv. Jansen V.O.F.").fill("Rookproefbedrijf")
  await page.getByRole("button", { name: "Volgende" }).click()
  await page.waitForURL(/\/farm\/create\/[^/]+\/\d{4}/)
  await expect(page.getByText("Rookproefbedrijf").first()).toBeVisible()
})

test("add a cultivation to a field", async ({ page }) => {
  const farm = readSmokeFarm()
  const b_id = farm.fields.tarwe
  await page.goto(`/farm/${farm.farm}/${farm.year}/field/${b_id}/cultivation`)
  await page.getByRole("button", { name: "Gewas toevoegen" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await pickComboboxOption(page, "Gewas", "Gras", /Grasland, tijdelijk/i)
  // The first date field is the sowing date. The same crop cannot start twice on one day, so a
  // retry or a run with E2E_REUSE_SEED=1 picks another day in autumn.
  const day = 1 + Math.floor(Math.random() * 28)
  const month = 9 + Math.floor(Math.random() * 3)
  await typeDate(dialog.getByPlaceholder("Kies een datum").first(), `${day}-${month}-${farm.year}`)
  await dialog.getByRole("button", { name: "Voeg toe" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Gewas is toegevoegd!")).toBeVisible()
})

test("add a fertilizer application to a field", async ({ page }) => {
  const farm = readSmokeFarm()
  const b_id = farm.fields["grasland-huiskavel"]
  await page.goto(`/farm/${farm.farm}/${farm.year}/field/${b_id}/fertilizer`)
  await pickComboboxOption(page, "Meststof", "KAS", /^KAS$/)
  await page.getByRole("combobox").filter({ hasText: "Selecteer een methode" }).click()
  await page.getByRole("option").first().click()
  // The labels of these fields are not linked to their inputs.
  await page.getByRole("spinbutton").first().fill("123")
  await typeDate(page.getByPlaceholder("Kies een datum").first(), `14-8-${farm.year}`)
  await page.getByRole("button", { name: "Gift toevoegen" }).click()
  await expect(page.getByText("Bemesting is toegevoegd!")).toBeVisible()
})

test("view the nitrogen balance and the nutrient advice", async ({ page }) => {
  const farm = readSmokeFarm()
  await page.goto(`/farm/${farm.farm}/${farm.year}/balance/nitrogen`)
  await expect(page.getByText("Aanvoer").first()).toBeVisible()
  await expect(page.getByText("Bekijk foutmelding")).toHaveCount(0)

  await page.goto(`/farm/${farm.farm}/${farm.year}/nutrient_advice`)
  // Without an NMI API key the advice is not available, but the page must still render.
  await expect(page.getByText("Lange akker").first()).toBeVisible()
})

test("share a farm and accept the invitation", async ({ page, browser }) => {
  const farm = readSmokeFarm()
  await page.goto(`/farm/${farm.farm}/settings/access`)
  const inviteForm = page
    .getByRole("group")
    .filter({ has: page.getByRole("button", { name: "Uitnodigen" }) })
  await inviteForm.getByRole("combobox").first().fill(farm.invitee)
  // The lookup finds the registered user; pick them and send the invitation.
  await page.getByRole("option", { name: farm.invitee }).click()
  await inviteForm.getByRole("button", { name: "Uitnodigen" }).click()
  await expect(page.getByText(farm.invitee).first()).toBeVisible()

  // The invitee signs in in a separate browser and accepts.
  const context = await browser.newContext({ storageState: SIGNED_OUT_STATE_FILE })
  try {
    const invitee = await context.newPage()
    const inviteeGuard = await guardPage(invitee)
    await dismissNotices(invitee, latestChangelogVersion())
    await signInWithMagicLink(invitee, farm.invitee)
    await invitee.goto("/farm")
    await invitee.getByRole("button", { name: "Accepteren" }).first().click()
    await expect(invitee.getByText("Demobedrijf De Proefhoeve").first()).toBeVisible()
    expect(inviteeGuard.problems(), "The invitee's pages should load without errors").toEqual([])
  } finally {
    await context.close()
  }
})
