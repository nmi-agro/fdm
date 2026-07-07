import {
  FieldDashboardBcsTile,
  FieldDashboardBlnTile,
  FieldDashboardCultivationHistoryTile,
  FieldDashboardCurrentCultivationTile,
  FieldDashboardFertilizerApplicationsTile,
  FieldDashboardIdentityTile,
  FieldDashboardMapTile,
  FieldDashboardMeasuresTile,
  FieldDashboardNitrogenBalanceTile,
  FieldDashboardNormsTile,
  FieldDashboardNutrientAdviceTile,
  FieldDashboardOrganicMatterBalanceTile,
  FieldDashboardSoilAnalysesTile,
  FieldDashboardSoilParametersTile,
} from "./tiles"
import type { FieldDashboardSectionDefinition, FieldDashboardTileDefinition } from "./types"

export const FIELD_DASHBOARD_SECTIONS: FieldDashboardSectionDefinition[] = [
  {
    id: "anchor",
    title: "",
    gridClassName: "grid gap-6 xl:grid-cols-12",
    showHeading: false,
  },
  {
    id: "teelt",
    title: "Teelt",
    gridClassName: "grid gap-6 xl:grid-cols-12",
  },
  {
    id: "bemesting",
    title: "Bemesting",
    gridClassName: "grid gap-6 xl:grid-cols-3",
  },
  {
    id: "balansen",
    title: "Balansen",
    gridClassName: "grid gap-6 xl:grid-cols-2",
  },
  {
    id: "bodem",
    title: "Bodem",
    gridClassName: "grid gap-6 md:grid-cols-2 xl:grid-cols-12",
  },
  {
    id: "bodemindicatoren",
    title: "Bodemindicatoren & maatregelen",
    gridClassName: "grid gap-6 xl:grid-cols-2",
  },
]

export function buildFieldDashboardRegistry({
  b_id,
  b_id_farm,
  calendar,
}: {
  b_id: string
  b_id_farm: string
  calendar: string
}): FieldDashboardTileDefinition[] {
  const fieldIndicatorsHref = `/farm/${b_id_farm}/${calendar}/indicators/${b_id}`
  const fieldMeasuresHref = `/farm/${b_id_farm}/${calendar}/measures/${b_id}`
  const fieldAtlasHref = `/farm/${b_id_farm}/${calendar}/atlas/fields`

  return [
    {
      id: "map",
      section: "anchor",
      title: "Perceelskaart",
      span: "xl:col-span-8",
      detailHref: fieldAtlasHref,
      dataKey: "map",
      Component: FieldDashboardMapTile,
    },
    {
      id: "identity",
      section: "anchor",
      title: "Perceeldetails",
      span: "xl:col-span-4",
      permissionGate: "field-write",
      detailHref: "./settings",
      dataKey: "field",
      Component: FieldDashboardIdentityTile,
    },
    {
      id: "cultivation-main",
      section: "teelt",
      title: "Huidige teelt",
      span: "xl:col-span-7",
      permissionGate: "field-write",
      detailHref: "./cultivation",
      dataKey: "cultivation.active",
      Component: FieldDashboardCurrentCultivationTile,
    },
    {
      id: "cultivation-history",
      section: "teelt",
      title: "Teelthistorie",
      span: "xl:col-span-5",
      detailHref: "./cultivation",
      dataKey: "asyncInsights.cultivationHistory",
      Component: FieldDashboardCultivationHistoryTile,
    },
    {
      id: "fertilizer-applications",
      section: "bemesting",
      title: "Bemestingen",
      span: "",
      permissionGate: "field-write",
      detailHref: "./fertilizer",
      dataKey: "fertilizer",
      Component: FieldDashboardFertilizerApplicationsTile,
    },
    {
      id: "fertilizer-advice",
      section: "bemesting",
      title: "Bemestingsadvies",
      span: "",
      detailHref: `/farm/${b_id_farm}/${calendar}/nutrient_advice/${b_id}`,
      dataKey: "asyncInsights.fertilizer.advice",
      Component: FieldDashboardNutrientAdviceTile,
    },
    {
      id: "fertilizer-norms",
      section: "bemesting",
      title: "Gebruiksruimte",
      span: "",
      detailHref: `/farm/${b_id_farm}/${calendar}/norms/${b_id}`,
      dataKey: "asyncInsights.fertilizer.norms",
      Component: FieldDashboardNormsTile,
    },
    {
      id: "nitrogen-balance",
      section: "balansen",
      title: "Stikstofbalans",
      span: "",
      detailHref: `/farm/${b_id_farm}/${calendar}/balance/nitrogen/${b_id}`,
      dataKey: "asyncInsights.nitrogenBalance",
      Component: FieldDashboardNitrogenBalanceTile,
    },
    {
      id: "organic-matter-balance",
      section: "balansen",
      title: "Organische stofbalans",
      span: "",
      detailHref: `/farm/${b_id_farm}/${calendar}/balance/organic-matter/${b_id}`,
      dataKey: "asyncInsights.organicMatterBalance",
      Component: FieldDashboardOrganicMatterBalanceTile,
    },
    {
      id: "soil-parameters",
      section: "bodem",
      title: "Basisparameters",
      span: "xl:col-span-6",
      detailHref: "./soil",
      dataKey: "soil.parameterCards",
      Component: FieldDashboardSoilParametersTile,
    },
    {
      id: "soil-analyses",
      section: "bodem",
      title: "Analyses",
      span: "xl:col-span-3",
      detailHref: "./soil",
      dataKey: "soil.analysisCount",
      Component: FieldDashboardSoilAnalysesTile,
    },
    {
      id: "soil-bcs",
      section: "bodem",
      title: "BodemConditieScore",
      span: "xl:col-span-3",
      detailHref: "./bcs",
      dataKey: "soil.bcs",
      Component: FieldDashboardBcsTile,
    },
    {
      id: "bln",
      section: "bodemindicatoren",
      title: "BLN",
      span: "xl:col-span-1",
      detailHref: fieldIndicatorsHref,
      dataKey: "asyncInsights.bln",
      Component: FieldDashboardBlnTile,
    },
    {
      id: "measures",
      section: "bodemindicatoren",
      title: "Maatregelen",
      span: "xl:col-span-1",
      permissionGate: "field-write",
      detailHref: fieldMeasuresHref,
      dataKey: "measures",
      Component: FieldDashboardMeasuresTile,
    },
  ]
}
