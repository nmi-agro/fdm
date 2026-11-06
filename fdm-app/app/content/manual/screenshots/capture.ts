/**
 * How each screenshot of the manual is captured. Every id used as `screenshot:<id>` in a chapter
 * needs an entry here, and every entry must be used; `pnpm --filter @nmi-agro/fdm-app test`
 * checks both. See the README in the manual folder for how to add one and run the capture.
 */
import type { CaptureDefinition } from "../../../lib/manual/capture-types"

export const captures = {
  "bedrijf-dashboard": {
    route: "/farm/{farm}?calendar={year}",
    ready: { role: "heading", name: "Demobedrijf De Proefhoeve" },
  },
  "bedrijf-aanmaken-gegevens": {
    route: "/farm/create",
    ready: { text: "Bedrijf toevoegen", exact: true },
  },
  "perceel-pagina": {
    route: "/farm/{farm}/{year}/field/{field:grasland-huiskavel}",
    ready: { text: "Perceelskaart", exact: true },
    map: true,
  },
  "bouwplan-tabel": {
    route: "/farm/{farm}/{year}/rotation",
    ready: { text: "mais, snij-", exact: true },
    // Expand the maize row to show its fields.
    steps: [
      { click: { selector: 'tbody tr:has-text("mais, snij-") td:first-child button' } },
      { waitFor: { text: "Maïsakker", exact: true } },
    ],
  },
  "bemesting-effect": {
    route: "/farm/{farm}/{year}/field/{field:mais}/fertilizer",
    ready: { text: "Nieuwe gift", exact: true },
    // Fill in a gift; the effect appears next to the form without saving it.
    steps: [
      { click: { role: "combobox", name: "Meststof" } },
      { type: "KAS" },
      { click: { role: "option", name: "KAS", exact: true } },
      { click: { text: "Selecteer een methode", exact: true } },
      { click: { role: "option", name: "Breedwerpig uitstrooien" } },
      { fill: { placeholder: "Bv. " }, value: "200" },
      { fill: { placeholder: "Kies een datum" }, value: "15-04-{year}" },
      { press: "Tab" },
      { waitFor: { text: "Advies perceel", exact: true } },
      { waitForHidden: { text: "Effect berekenen…" } },
    ],
    // The effect is below the list of gifts.
    fullPage: true,
  },
  "meststoffen-lijst": {
    route: "/farm/{farm}/fertilizers",
    ready: { text: "Rundveedrijfmest", exact: true },
  },
  "bodem-perceel": {
    route: "/farm/{farm}/{year}/field/{field:mais}/soil",
    ready: { text: "Ander laboratorium" },
  },
  tijdlijn: {
    route: "/farm/{farm}/{year}/timeline",
    ready: { text: "Maïsakker" },
    // The quarterly view shows the whole year.
    steps: [
      { click: { text: "Maandelijks", exact: true } },
      { click: { role: "option", name: "Kwartaal" } },
    ],
  },
  // The overview only: the details of a clicked parcel show the real crop history from the BRP.
  "atlas-gewaspercelen": {
    route: "/farm/{farm}/{year}/atlas/fields",
    ready: { selector: ".maplibregl-canvas" },
    map: true,
  },
  "balans-stikstof": {
    route: "/farm/{farm}/{year}/balance/nitrogen",
    ready: { text: "Aanvoer" },
    // Fails when a field could not be calculated.
    steps: [{ waitForHidden: { text: "Bekijk foutmelding" } }],
  },
  "gebruiksruimte-bedrijf": {
    route: "/farm/{farm}/{year}/norms",
    ready: { text: "Stikstof" },
  },
  "bemestingsadvies-perceel": {
    route: "/farm/{farm}/{year}/nutrient_advice/{field:mais}",
    ready: { text: "Risico voor opbrengst" },
  },
  "bodemkwaliteit-scores": {
    route: "/farm/{farm}/{year}/indicators",
    ready: { text: "Maïsakker" },
  },
  aanmelden: {
    route: "/signin",
    ready: { role: "button", name: "Aanmelden met e-mail" },
    signedOut: true,
  },
  "mijn-bedrijven": {
    route: "/farm",
    ready: { text: "Demobedrijf De Proefhoeve" },
  },
  "bedrijf-aanmaken-shapefile": {
    route: "/farm/create/{farm}/{year}/upload",
    ready: { role: "button", name: "Uploaden" },
  },
  "bedrijf-aanmaken-kaart": {
    route: "/farm/create/{farm}/{year}/atlas",
    ready: { selector: ".maplibregl-canvas" },
    map: true,
  },
  "bedrijf-aanmaken-percelen": {
    route: "/farm/create/{farm}/{year}/fields",
    ready: { text: "met bodemanalyse" },
  },
  "bedrijf-aanmaken-bouwplan": {
    route: "/farm/create/{farm}/{year}/rotation",
    ready: { text: "mais, snij-", exact: true },
  },
  "bedrijf-aanmaken-toegang": {
    route: "/farm/create/{farm}/{year}/access",
    ready: { text: "Demo Gebruiker" },
  },
  bedrijfsinstellingen: {
    route: "/farm/{farm}/settings",
    ready: { text: "Bedrijfsnaam" },
  },
  "percelen-lijst": {
    route: "/farm/{farm}/{year}/field",
    ready: { text: "Kleiakker" },
  },
  "gewas-toevoegen": {
    route: "/farm/{farm}/{year}/field/{field:tarwe}/cultivation",
    ready: { text: "Gewas toevoegen" },
  },
  "meststof-toevoegen": {
    route: "/farm/{farm}/fertilizers/new/custom",
    ready: { text: "Meststof opslaan" },
  },
  "bodemanalyses-uploaden": {
    route: "/farm/{farm}/soil-analysis/bulk",
    ready: { selector: "input[type=file]" },
  },
  "bodemanalyse-toevoegen": {
    route: "/farm/{farm}/{year}/field/{field:mais}/soil/analysis/new",
    ready: { text: "Standaard bodemanalyse" },
  },
  "atlas-hoogtekaart": {
    route: "/farm/{farm}/{year}/atlas/elevation",
    ready: { selector: ".maplibregl-canvas" },
    map: true,
  },
  "balans-organische-stof": {
    route: "/farm/{farm}/{year}/balance/organic-matter",
    ready: { text: "Aanvoer" },
    // Fails when a field could not be calculated.
    steps: [{ waitForHidden: { text: "Bekijk foutmelding" } }],
  },
  "gebruiksruimte-perceel": {
    route: "/farm/{farm}/{year}/norms/{field:grasland-huiskavel}",
    ready: { text: "Fosfaat" },
  },
  "bemestingsadvies-overzicht": {
    route: "/farm/{farm}/{year}/nutrient_advice",
    ready: { text: "Kleiakker" },
  },
  "bemestingsadvies-grasland": {
    route: "/farm/{farm}/{year}/nutrient_advice/{field:grasland-huiskavel}",
    ready: { text: "Risico voor opbrengst" },
  },
  maatregelen: {
    route: "/farm/{farm}/{year}/measures",
    ready: { text: "Maatregel" },
  },
  "toegang-delen": {
    route: "/farm/{farm}/settings/access",
    ready: { text: "Demo Gebruiker" },
  },
  "account-profiel": {
    route: "/user/settings/profile",
    ready: { text: "demo@example.com" },
  },
  "api-sleutels": {
    route: "/user/settings/api-keys",
    ready: { text: "Nieuwe sleutel" },
  },
} satisfies Record<string, CaptureDefinition>
