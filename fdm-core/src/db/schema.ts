import type { ApplicationMethods } from "@nmi-agro/fdm-data"
import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { APP_AMOUNT_UNITS } from "../fertilizer-application-unit-conversion"
import { geometry, numericCasted } from "./schema-custom-types"

// Define postgres schema
export const fdmSchema = pgSchema("fdm")
export type fdmSchemaTypeSelect = typeof fdmSchema

// Define farms table
export const farms = fdmSchema.table(
  "farms",
  {
    b_id_farm: text().primaryKey(),
    b_name_farm: text(),
    b_businessid_farm: text(),
    b_address_farm: text(),
    b_postalcode_farm: text(),
    b_farm_livestock: boolean().notNull().default(false),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("b_id_farm_idx").on(table.b_id_farm)],
)

export type farmsTypeSelect = typeof farms.$inferSelect
export type farmsTypeInsert = typeof farms.$inferInsert

// Define farm_managing table
export const acquiringMethodOptions = [
  { value: "nl_01", label: "Eigendom" },
  { value: "nl_02", label: "Reguliere pacht" },
  {
    value: "nl_03",
    label: "In gebruik van een terreinbeherende organisatie",
  },
  {
    value: "nl_04",
    label: "Tijdelijk gebruik in het kader van landinrichting",
  },
  { value: "nl_07", label: "Overige exploitatievormen" },
  { value: "nl_09", label: "Erfpacht" },
  { value: "nl_10", label: "Pacht van geringe oppervlakten" },
  { value: "nl_11", label: "Natuurpacht" },
  { value: "nl_12", label: "Geliberaliseerde pacht, langer dan 6 jaar" },
  { value: "nl_13", label: "Geliberaliseerde pacht, 6 jaar of korter" },
  { value: "nl_61", label: "Reguliere pacht kortlopend" },
  { value: "nl_63", label: "Teeltpacht" },
  { value: "unknown", label: "Onbekend" },
]
export const acquiringMethodEnum = fdmSchema.enum(
  "b_acquiring_method",
  acquiringMethodOptions.map((x) => x.value) as [string, ...string[]],
)

export const fieldAcquiring = fdmSchema.table(
  "field_acquiring",
  {
    b_id: text()
      .notNull()
      .references(() => fields.b_id),
    b_id_farm: text()
      .notNull()
      .references(() => farms.b_id_farm),
    b_start: timestamp({ withTimezone: true }),
    b_acquiring_method: acquiringMethodEnum().notNull().default("unknown"),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => {
    return [primaryKey({ columns: [table.b_id, table.b_id_farm] })]
  },
)

export type fieldAcquiringTypeSelect = typeof fieldAcquiring.$inferSelect
export type fieldAcquiringTypeInsert = typeof fieldAcquiring.$inferInsert

// Define fields table
export const fields = fdmSchema.table(
  "fields",
  {
    b_id: text().primaryKey(),
    b_name: text().notNull(),
    b_geometry: geometry<"Polygon" | "MultiPolygon">("b_geometry", {
      type: "Polygon",
    }), // PGLite does not support PostGIS yet; I expect to be supported in Q4 2024: https://github.com/electric-sql/pglite/issues/11
    b_id_source: text(),
    b_bufferstrip: boolean().notNull().default(false),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex("b_id_idx").on(table.b_id),
    index("b_geom_idx").using("gist", table.b_geometry),
  ],
)

export type fieldsTypeSelect = typeof fields.$inferSelect
export type fieldsTypeInsert = typeof fields.$inferInsert

export const fieldDiscarding = fdmSchema.table("field_discarding", {
  b_id: text()
    .primaryKey()
    .notNull()
    .references(() => fields.b_id),
  b_end: timestamp({ withTimezone: true }),
  created: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated: timestamp({ withTimezone: true }),
})

export type fieldDiscardingTypeSelect = typeof fieldDiscarding.$inferSelect
export type fieldDiscardingTypeInsert = typeof fieldDiscarding.$inferInsert

// Define fertilizers table
export const fertilizers = fdmSchema.table(
  "fertilizers",
  {
    p_id: text().primaryKey(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("p_id_idx").on(table.p_id)],
)

export type fertilizersTypeSelect = typeof fertilizers.$inferSelect
export type fertilizersTypeInsert = typeof fertilizers.$inferInsert

// Define fertilizers acquiring table
export const fertilizerAcquiring = fdmSchema.table("fertilizer_acquiring", {
  b_id_farm: text()
    .notNull()
    .references(() => farms.b_id_farm),
  p_id: text()
    .notNull()
    .references(() => fertilizers.p_id),
  p_acquiring_amount: numericCasted(), //kg
  p_acquiring_date: timestamp({ withTimezone: true }),
  b_id_manurepit: text().references(() => manurePits.b_id_manurepit),
  created: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated: timestamp({ withTimezone: true }),
})

export type fertilizerAcquiringTypeSelect = typeof fertilizerAcquiring.$inferSelect
export type fertilizerAcquiringTypeInsert = typeof fertilizerAcquiring.$inferInsert

// Define fertilizers application table
export const applicationMethodOptions = [
  { value: "slotted coulter", label: "Zodenbemester / Sleepvoet" },
  { value: "incorporation", label: "Onderwerken in 1 werkgang" },
  { value: "incorporation 2 tracks", label: "Onderwerken in 2 werkgangen" },
  { value: "injection", label: "Mestinjectie" },
  { value: "shallow injection", label: "In sleufjes in de grond" },
  { value: "spraying", label: "Spuiten" },
  { value: "broadcasting", label: "Breedwerpig uitstrooien" },
  { value: "spoke wheel", label: "Spaakwiel" },
  { value: "pocket placement", label: "Plantgat" },
  { value: "narrowband", label: "In strookjes op de grond" },
] satisfies { value: ApplicationMethods; label: string }[]
export const applicationMethodEnum = fdmSchema.enum(
  "p_app_method",
  applicationMethodOptions.map((x) => x.value) as [string, ...string[]],
)

export const fertilizerApplication = fdmSchema.table(
  "fertilizer_applying",
  {
    p_app_id: text().primaryKey(),
    b_id: text()
      .notNull()
      .references(() => fields.b_id),
    p_id: text()
      .notNull()
      .references(() => fertilizers.p_id),
    p_app_amount: numericCasted(), // kg / ha
    p_app_method: applicationMethodEnum(),
    p_app_date: timestamp({ withTimezone: true }),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("p_app_idx").on(table.p_app_id)],
)

export type fertilizerApplicationTypeSelect = typeof fertilizerApplication.$inferSelect
export type fertilizerApplicationTypeInsert = typeof fertilizerApplication.$inferInsert

// Define farm_managing table
export const typeRvoOptions = [
  { value: "10", label: "Rundvee - Vaste mest" },
  { value: "11", label: "Rundvee - Filtraat na mestscheiding" },
  { value: "12", label: "Rundvee - Gier" },
  { value: "13", label: "Rundvee - Koek na mestscheiding" },
  { value: "14", label: "Rundvee - Drijfmest behalve van vleeskalveren" },
  { value: "17", label: "Rundvee - Bewerkte kalvergier" },
  { value: "18", label: "Rundvee - Vleeskalveren, witvlees" },
  { value: "19", label: "Rundvee - Vleeskalveren, rosevlees" },
  { value: "23", label: "Kalkoenen - Mest, alle systemen" },
  { value: "30", label: "Kippen - Drijfmest" },
  { value: "31", label: "Kippen - Deeppitstal, kanalenstal" },
  { value: "32", label: "Kippen - Mestband" },
  { value: "33", label: "Kippen - Mestband + nadroog" },
  {
    value: "35",
    label: "Kippen - Geheel of gedeeltelijk strooiselstal (incl. volièrestal/scharrelstal)",
  },
  {
    value: "39",
    label: "Vleeskuikens en parelhoenders - Mest, alle systemen",
  },
  { value: "40", label: "Varkens - Vaste mest" },
  { value: "41", label: "Varkens - Filtraat na mestscheiding" },
  { value: "42", label: "Varkens - Gier" },
  { value: "43", label: "Varkens - Koek na mestscheiding" },
  {
    value: "46",
    label: "Varkens - Drijfmest fokzeugen, incl. biggen, opfokzeugen/-beren, dekberen",
  },
  { value: "50", label: "Varkens - Drijfmest vleesvarkens" },
  { value: "56", label: "Schapen - Mest, alle systemen" },
  { value: "60", label: "Geiten - Drijfmest" },
  { value: "61", label: "Geiten - Vaste mest" },
  { value: "75", label: "Nertsen - Vaste mest" },
  { value: "76", label: "Nertsen - Drijfmest" },
  { value: "80", label: "Eenden - Vaste mest" },
  { value: "81", label: "Eenden - Drijfmest" },
  { value: "90", label: "Konijnen - Vaste mest" },
  {
    value: "91",
    label: "Konijnen - Drijfmest met percentage droge stof < 2,5%",
  },
  { value: "92", label: "Konijnen - Drijfmest" },
  { value: "25", label: "Paarden - Vaste mest" },
  { value: "26", label: "Ezels - Vaste mest" },
  { value: "27", label: "Pony’s - Vaste mest" },
  { value: "95", label: "Herten - Vaste mest" },
  { value: "96", label: "Waterbuffels - Mest, alle systemen" },
  { value: "97", label: "Knobbelgans - Vaste mest" },
  { value: "98", label: "Grauwe gans - Vaste mest" },
  { value: "99", label: "Fazanten en patrijzen - Vaste mest" },
  { value: "100", label: "Struisvogels, emoes en nandoes - Vaste mest" },
  { value: "101", label: "Vleesduif - Vaste mest" },
  { value: "102", label: "Bruine rat - Vaste mest" },
  { value: "103", label: "Tamme muis - Vaste mest" },
  { value: "104", label: "Cavia - Vaste mest" },
  { value: "105", label: "Goudhamster - Vaste mest" },
  { value: "106", label: "Gerbil - Vaste mest" },
  { value: "107", label: "Fase 1 substraat" },
  { value: "108", label: "Fase 2 substraat" },
  { value: "109", label: "Fase 3 substraat" },
  { value: "110", label: "Champost" },
  { value: "111", label: "Compost" },
  { value: "112", label: "Zeer schone compost" },
  { value: "113", label: "Zuiveringsslib vloeibaar" },
  { value: "114", label: "Zuiveringsslib steekvast" },
  { value: "115", label: "Kunstmest" },
  { value: "116", label: "Overige mestsoorten" },
  { value: "117", label: "Gescheiden champost" },
  {
    value: "120",
    label:
      "Mineralenconcentraat (alleen geldig voor 2025 en eerder; Kies Renure-variant voor 2026 en later)",
  },
  { value: "130", label: "Ammoniumsulfaat (Renure)" },
  { value: "131", label: "Ammoniumnitraat (Renure)" },
  { value: "132", label: "Mineralenconcentraat (Renure)" },
  { value: "133", label: "Struviet (Renure)" },
  { value: "134", label: "Ander ammoniumzout (Renure)" },
]
export const typeRvoEnum = fdmSchema.enum(
  "p_type_rvo",
  typeRvoOptions.map((x) => x.value) as [string, ...string[]],
)
export const typeApplicationAmountUnitsEnum = fdmSchema.enum(
  "p_app_amount_unit",
  APP_AMOUNT_UNITS.map((x) => x.value) as [string, ...string[]],
)

// Define fertilizers_catalogue table
export const fertilizersCatalogue = fdmSchema.table(
  "fertilizers_catalogue",
  {
    p_id_catalogue: text().primaryKey(),
    p_source: text().notNull(),
    p_name_nl: text().notNull(),
    p_name_en: text(),
    p_description: text(),
    p_app_method_options: applicationMethodEnum().array(),
    p_app_amount_unit: typeApplicationAmountUnitsEnum().notNull().default("kg/ha"),
    p_dm: numericCasted(),
    p_density: numericCasted(),
    p_om: numericCasted(),
    p_a: numericCasted(),
    p_hc: numericCasted(),
    p_eom: numericCasted(),
    p_eoc: numericCasted(),
    p_c_rt: numericCasted(),
    p_c_of: numericCasted(),
    p_c_if: numericCasted(),
    p_c_fr: numericCasted(),
    p_cn_of: numericCasted(),
    p_n_rt: numericCasted(),
    p_n_if: numericCasted(),
    p_n_of: numericCasted(),
    p_n_wc: numericCasted(),
    p_no3_rt: numericCasted(),
    p_nh4_rt: numericCasted(),
    p_p_rt: numericCasted(),
    p_k_rt: numericCasted(),
    p_mg_rt: numericCasted(),
    p_ca_rt: numericCasted(),
    p_ne: numericCasted(),
    p_s_rt: numericCasted(),
    p_s_wc: numericCasted(),
    p_cu_rt: numericCasted(),
    p_zn_rt: numericCasted(),
    p_na_rt: numericCasted(),
    p_si_rt: numericCasted(),
    p_b_rt: numericCasted(),
    p_mn_rt: numericCasted(),
    p_ni_rt: numericCasted(),
    p_fe_rt: numericCasted(),
    p_mo_rt: numericCasted(),
    p_co_rt: numericCasted(),
    p_as_rt: numericCasted(),
    p_cd_rt: numericCasted(),
    p_cr_rt: numericCasted(),
    p_cr_vi: numericCasted(),
    p_pb_rt: numericCasted(),
    p_hg_rt: numericCasted(),
    p_cl_rt: numericCasted(),
    p_ef_nh3: numericCasted(),
    p_type_manure: boolean(),
    p_type_mineral: boolean(),
    p_type_compost: boolean(),
    p_type_rvo: typeRvoEnum(),
    hash: text(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("p_id_catalogue_idx").on(table.p_id_catalogue)],
)

export type fertilizersCatalogueTypeSelect = typeof fertilizersCatalogue.$inferSelect
export type fertilizersCatalogueTypeInsert = typeof fertilizersCatalogue.$inferInsert

// Define fertilizer_picking table
export const fertilizerPicking = fdmSchema.table("fertilizer_picking", {
  p_id: text()
    .notNull()
    .references(() => fertilizers.p_id),
  p_id_catalogue: text()
    .notNull()
    .references(() => fertilizersCatalogue.p_id_catalogue),
  p_picking_date: timestamp({ withTimezone: true }),
  created: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated: timestamp({ withTimezone: true }),
})

export type fertilizerPickingTypeSelect = typeof fertilizerPicking.$inferSelect
export type fertilizerPickingTypeInsert = typeof fertilizerPicking.$inferInsert

// Define cultivations table
export const cultivations = fdmSchema.table(
  "cultivations",
  {
    b_lu: text().primaryKey(),
    b_lu_catalogue: text()
      .notNull()
      .references(() => cultivationsCatalogue.b_lu_catalogue),
    b_lu_variety: text(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("b_lu_idx").on(table.b_lu)],
)

export type cultivationsTypeSelect = typeof cultivations.$inferSelect
export type cultivationsTypeInsert = typeof cultivations.$inferInsert

// Define cultivation_starting table
export const cultivationStarting = fdmSchema.table(
  "cultivation_starting",
  {
    b_id: text()
      .notNull()
      .references(() => fields.b_id),
    b_lu: text()
      .notNull()
      .references(() => cultivations.b_lu),
    b_lu_start: timestamp({ withTimezone: true }),
    b_sowing_amount: numericCasted(),
    b_sowing_method: text(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => {
    return [primaryKey({ columns: [table.b_id, table.b_lu] })]
  },
)

export type cultivationStartingTypeSelect = typeof cultivationStarting.$inferSelect
export type cultivationStartingTypeInsert = typeof cultivationStarting.$inferInsert

// Define cultivations_catalogue table
export const harvestableEnum = fdmSchema.enum("b_lu_harvestable", ["none", "once", "multiple"])
export const harvestCatEnum = fdmSchema.enum("b_lu_harvestcat", [
  "HC010", // Standard
  "HC020", // Grass
  "HC031", // Maize
  "HC040", // Root crops
  "HC041", // Sugar beets
  "HC042", // Potatoes
  "HC050", // Cereals
])
export const rotationEnum = fdmSchema.enum("b_lu_croprotation", [
  "other",
  "clover",
  "nature",
  "potato",
  "grass",
  "rapeseed",
  "starch",
  "maize",
  "cereal",
  "sugarbeet",
  "alfalfa",
  "catchcrop",
])
export const cultivationsCatalogue = fdmSchema.table(
  "cultivations_catalogue",
  {
    b_lu_catalogue: text().primaryKey(),
    b_lu_source: text().notNull(),
    b_lu_name: text().notNull(),
    b_lu_name_en: text(),
    b_lu_harvestable: harvestableEnum().notNull(),
    b_lu_harvestcat: harvestCatEnum(),
    b_lu_hcat3: text(),
    b_lu_hcat3_name: text(),
    b_lu_croprotation: rotationEnum(),
    b_lu_yield: numericCasted(),
    b_lu_dm: numericCasted(),
    b_lu_hi: numericCasted(),
    b_lu_n_harvestable: numericCasted(),
    b_lu_n_residue: numericCasted(),
    b_n_fixation: numericCasted(),
    b_lu_eom: numericCasted(),
    b_lu_eom_residue: numericCasted(),
    b_lu_rest_oravib: boolean(),
    b_lu_variety_options: text().array(),
    b_lu_start_default: text(), // MM-dd
    b_date_harvest_default: text(), // MM-dd
    hash: text(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex("b_lu_catalogue_idx").on(table.b_lu_catalogue),
    check(
      "b_lu_start_default_format",
      sql`b_lu_start_default IS NULL OR b_lu_start_default ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'`,
    ),
    check(
      "b_date_harvest_default_format",
      sql`b_date_harvest_default IS NULL OR b_date_harvest_default ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'`,
    ),
  ],
)

export type cultivationsCatalogueTypeSelect = typeof cultivationsCatalogue.$inferSelect
export type cultivationsCatalogueTypeInsert = typeof cultivationsCatalogue.$inferInsert

// Define harvestables able
export const harvestables = fdmSchema.table(
  "harvestables",
  {
    b_id_harvestable: text().primaryKey(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("b_id_harvestable_idx").on(table.b_id_harvestable)],
)

export type harvestablesTypeSelect = typeof harvestables.$inferSelect
export type harvestablesTypeInsert = typeof harvestables.$inferInsert

// Define harvestable sampling table
export const harvestableSampling = fdmSchema.table(
  "harvestable_sampling",
  {
    b_id_harvestable: text()
      .notNull()
      .references(() => harvestables.b_id_harvestable),
    b_id_harvestable_analysis: text()
      .notNull()
      .references(() => harvestableAnalyses.b_id_harvestable_analysis),
    b_sampling_date: timestamp({ withTimezone: true }),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => {
    return [
      primaryKey({
        name: "harvestable_sampling_pk",
        columns: [table.b_id_harvestable, table.b_id_harvestable_analysis],
      }),
    ]
  },
)

export type harvestableSamplingTypeSelect = typeof harvestableSampling.$inferSelect
export type harvestableSamplingTypeInsert = typeof harvestableSampling.$inferInsert

// Define harvestable analysis table
export const harvestableAnalyses = fdmSchema.table(
  "harvestable_analyses",
  {
    b_id_harvestable_analysis: text().primaryKey(),
    b_lu_yield: numericCasted(),
    b_lu_yield_fresh: numericCasted(),
    b_lu_yield_bruto: numericCasted(),
    b_lu_tarra: numericCasted(),
    b_lu_dm: numericCasted(),
    b_lu_moist: numericCasted(),
    b_lu_uww: numericCasted(),
    b_lu_cp: numericCasted(),
    b_lu_n_harvestable: numericCasted(),
    b_lu_n_residue: numericCasted(),
    b_lu_p_harvestable: numericCasted(),
    b_lu_p_residue: numericCasted(),
    b_lu_k_harvestable: numericCasted(),
    b_lu_k_residue: numericCasted(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("b_id_harvestable_analyses_idx").on(table.b_id_harvestable_analysis)],
)

export type harvestableAnalysesTypeSelect = typeof harvestableAnalyses.$inferSelect
export type harvestableAnalysesTypeInsert = typeof harvestableAnalyses.$inferInsert

// Define cultivation harvesting able
export const cultivationHarvesting = fdmSchema.table("cultivation_harvesting", {
  b_id_harvesting: text().primaryKey(),
  b_id_harvestable: text()
    .notNull()
    .references(() => harvestables.b_id_harvestable),
  b_lu: text()
    .notNull()
    .references(() => cultivations.b_lu),
  b_lu_harvest_date: timestamp({ withTimezone: true }),
  created: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated: timestamp({ withTimezone: true }),
})

export type cultivationHarvestingTypeSelect = typeof cultivationHarvesting.$inferSelect
export type cultivationHarvestingTypeInsert = typeof cultivationHarvesting.$inferInsert

// Define cultivation ending table
export const cultivationEnding = fdmSchema.table("cultivation_ending", {
  b_lu: text()
    .primaryKey()
    .notNull()
    .references(() => cultivations.b_lu),
  b_lu_end: timestamp({ withTimezone: true }),
  m_cropresidue: boolean(),
  created: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated: timestamp({ withTimezone: true }),
})

export type cultivationEndingTypeSelect = typeof cultivationEnding.$inferSelect
export type cultivationEndingTypeInsert = typeof cultivationEnding.$inferInsert

// Define soil_analyis table
export const soilTypesOptions = [
  { value: "moerige_klei", label: "Moerige klei" },
  { value: "rivierklei", label: "Rivierklei" },
  { value: "dekzand", label: "Dekzand" },
  { value: "zeeklei", label: "Zeeklei" },
  { value: "dalgrond", label: "Dalgrond" },
  { value: "veen", label: "Veen" },
  { value: "loess", label: "Löss" },
  { value: "duinzand", label: "Duinzand" },
  { value: "maasklei", label: "Maasklei" },
]
export type SoilTypes = (typeof soilTypesOptions)[number]["value"]
export const soiltypeEnum = fdmSchema.enum(
  "b_soiltype_agr",
  soilTypesOptions.map((x) => x.value) as [string, ...string[]],
)

export const gwlClassesOptions = [
  { value: "I", label: "I" },
  { value: "Ia", label: "Ia" },
  { value: "Ic", label: "Ic" },
  { value: "II", label: "II" },
  { value: "IIa", label: "IIa" },
  { value: "IIb", label: "IIb" },
  { value: "IIc", label: "IIc" },
  { value: "III", label: "III" },
  { value: "IIIa", label: "IIIa" },
  { value: "IIIb", label: "IIIb" },
  { value: "IV", label: "IV" },
  { value: "IVu", label: "IVu" },
  { value: "IVc", label: "IVc" },
  { value: "V", label: "V" },
  { value: "Va", label: "Va" },
  { value: "Vao", label: "Vao" },
  { value: "Vad", label: "Vad" },
  { value: "Vb", label: "Vb" },
  { value: "Vbo", label: "Vbo" },
  { value: "Vbd", label: "Vbd" },
  { value: "sV", label: "sV" },
  { value: "sVb", label: "sVb" },
  { value: "VI", label: "VI" },
  { value: "VIo", label: "VIo" },
  { value: "VId", label: "VId" },
  { value: "VII", label: "VII" },
  { value: "VIIo", label: "VIIo" },
  { value: "VIId", label: "VIId" },
  { value: "VIII", label: "VIII" },
  { value: "VIIIo", label: "VIIIo" },
  { value: "VIIId", label: "VIIId" },
]
export type GwlClasses = (typeof gwlClassesOptions)[number]["value"]
export const gwlClassEnum = fdmSchema.enum(
  "b_gwl_class",
  gwlClassesOptions.map((x) => x.value) as [string, ...string[]],
)

export const soilAnalysisSourceOptions = [
  {
    value: "nl-rva-l122",
    label: "Eurofins Agro Testing Wageningen B.V.",
  },
  {
    value: "nl-rva-l136",
    label: "Nutrilab B.V.",
  },
  {
    value: "nl-rva-l264",
    label: "Normec Robalab B.V.",
  },
  {
    value: "nl-rva-l320",
    label: "Agrarisch Laboratorium Noord-Nederland/Alnn B.V.",
  },
  {
    value: "nl-rva-l335",
    label: "Normec Groen Agro Control",
  },
  {
    value: "nl-rva-l610",
    label: "Normec Dumea B.V.",
  },
  {
    value: "nl-rva-l648",
    label: "Fertilab B.V.",
  },
  {
    value: "nl-rva-l697",
    label: "Care4Agro B.V.",
  },
  {
    value: "nl-other-nmi",
    label: "NMI BodemSchat",
  },
  {
    value: "other",
    label: "Ander laboratorium",
  },
]
export const soilAnalysisSourceEnum = fdmSchema.enum(
  "a_source",
  soilAnalysisSourceOptions.map((x) => x.value) as [string, ...string[]],
)

export const soilAnalysis = fdmSchema.table("soil_analysis", {
  a_id: text().primaryKey(),
  a_date: timestamp({ withTimezone: true }),
  a_source: soilAnalysisSourceEnum().default("other"),
  a_file_path: text(),
  a_al_ox: numericCasted(),
  a_c_of: numericCasted(),
  a_ca_co: numericCasted(),
  a_ca_co_po: numericCasted(),
  a_caco3_if: numericCasted(),
  a_cec_co: numericCasted(),
  a_clay_mi: numericCasted(),
  a_cn_fr: numericCasted(),
  a_com_fr: numericCasted(),
  a_cu_cc: numericCasted(),
  a_density_sa: numericCasted(),
  a_fe_ox: numericCasted(),
  a_k_cc: numericCasted(),
  a_k_co: numericCasted(),
  a_k_co_po: numericCasted(),
  a_mg_cc: numericCasted(),
  a_mg_co: numericCasted(),
  a_mg_co_po: numericCasted(),
  a_n_pmn: numericCasted(),
  a_n_rt: numericCasted(),
  a_nh4_cc: numericCasted(),
  a_nmin_cc: numericCasted(),
  a_no3_cc: numericCasted(),
  a_p_al: numericCasted(),
  a_p_cc: numericCasted(),
  a_p_ox: numericCasted(),
  a_p_rt: numericCasted(),
  a_p_sg: numericCasted(),
  a_p_wa: numericCasted(),
  a_ph_cc: numericCasted(),
  a_s_rt: numericCasted(),
  a_sand_mi: numericCasted(),
  a_silt_mi: numericCasted(),
  a_som_loi: numericCasted(),
  a_zn_cc: numericCasted(),
  b_gwl_class: gwlClassEnum(),
  b_soiltype_agr: soiltypeEnum(),
  a_ss_bcs: numericCasted(),
  a_sc_bcs: numericCasted(),
  a_rd_bcs: numericCasted(),
  a_ew_bcs: numericCasted(),
  a_cc_bcs: numericCasted(),
  a_gs_bcs: numericCasted(),
  a_p_bcs: numericCasted(),
  a_c_bcs: numericCasted(),
  a_rt_bcs: numericCasted(),
  created: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated: timestamp({ withTimezone: true }),
})

export type soilAnalysisTypeSelect = typeof soilAnalysis.$inferSelect
export type soilAnalysisTypeInsert = typeof soilAnalysis.$inferInsert

// Define soil_sampling table
export const soilSampling = fdmSchema.table("soil_sampling", {
  b_id_sampling: text().primaryKey(),
  b_id: text()
    .notNull()
    .references(() => fields.b_id),
  a_id: text()
    .notNull()
    .references(() => soilAnalysis.a_id),
  a_depth_upper: numericCasted().notNull().default(0),
  a_depth_lower: numericCasted(),
  b_sampling_date: timestamp({ withTimezone: true }),
  b_sampling_geometry: geometry("b_sampling_geometry", {
    type: "MultiPoint",
  }),
  created: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated: timestamp({ withTimezone: true }),
})

export type soilSamplingTypeSelect = typeof soilSampling.$inferSelect
export type soilSamplingTypeInsert = typeof soilSampling.$inferInsert

// Define derogations table
export const derogations = fdmSchema.table("derogations", {
  b_id_derogation: text().primaryKey(),
  b_derogation_year: integer().notNull(),
  created: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated: timestamp({ withTimezone: true }),
})

export type derogationsTypeSelect = typeof derogations.$inferSelect
export type derogationsTypeInsert = typeof derogations.$inferInsert

// Define derogation_applying table
export const derogationApplying = fdmSchema.table(
  "derogation_applying",
  {
    b_id_farm: text()
      .notNull()
      .references(() => farms.b_id_farm),
    b_id_derogation: text()
      .notNull()
      .references(() => derogations.b_id_derogation),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => {
    return [
      primaryKey({
        name: "derogation_applying_pk",
        columns: [table.b_id_farm, table.b_id_derogation],
      }),
      uniqueIndex("derogation_one_per_farm_per").on(table.b_id_derogation),
    ]
  },
)

export type derogationApplyingTypeSelect = typeof derogationApplying.$inferSelect
export type derogationApplyingTypeInsert = typeof derogationApplying.$inferInsert

// Define organics table
export const organicCertifications = fdmSchema.table("organic_certifications", {
  b_id_organic: text().primaryKey(),
  b_organic_traces: text(),
  b_organic_skal: text(),
  b_organic_issued: timestamp({ withTimezone: true }),
  b_organic_expires: timestamp({ withTimezone: true }),
  created: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated: timestamp({ withTimezone: true }),
})

export type organicCertificationsTypeSelect = typeof organicCertifications.$inferSelect
export type organicCertificationsTypeInsert = typeof organicCertifications.$inferInsert

// Define organic_certifications_holding table
export const organicCertificationsHolding = fdmSchema.table(
  "organic_certifications_holding",
  {
    b_id_farm: text()
      .notNull()
      .references(() => farms.b_id_farm),
    b_id_organic: text()
      .notNull()
      .references(() => organicCertifications.b_id_organic),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => {
    return [
      primaryKey({
        columns: [table.b_id_farm, table.b_id_organic],
      }),
      uniqueIndex("organic_one_farm_per_cert").on(table.b_id_organic),
    ]
  },
)

export type organicCertificationsHoldingTypeSelect =
  typeof organicCertificationsHolding.$inferSelect
export type organicCertificationsHoldingTypeInsert =
  typeof organicCertificationsHolding.$inferInsert

// Define intending_grazing table
export const intendingGrazing = fdmSchema.table(
  "intending_grazing",
  {
    b_id_farm: text()
      .notNull()
      .references(() => farms.b_id_farm),
    b_grazing_intention: boolean(),
    b_grazing_intention_year: integer().notNull(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => {
    return [
      primaryKey({
        columns: [table.b_id_farm, table.b_grazing_intention_year],
      }),
    ]
  },
)

export type intendingGrazingTypeSelect = typeof intendingGrazing.$inferSelect
export type intendingGrazingTypeInsert = typeof intendingGrazing.$inferInsert

// Define fertilizer_catalogue_enabling table
export const fertilizerCatalogueEnabling = fdmSchema.table(
  "fertilizer_catalogue_enabling",
  {
    b_id_farm: text()
      .notNull()
      .references(() => farms.b_id_farm),
    p_source: text().notNull(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => {
    return [primaryKey({ columns: [table.b_id_farm, table.p_source] })]
  },
)

export type fertilizerCatalogueEnablingTypeSelect = typeof fertilizerCatalogueEnabling.$inferSelect
export type fertilizerCatalogueEnablingTypeInsert = typeof fertilizerCatalogueEnabling.$inferInsert

// Define cultivation_catalogue_selecting table
export const cultivationCatalogueSelecting = fdmSchema.table(
  "cultivation_catalogue_selecting",
  {
    b_id_farm: text()
      .notNull()
      .references(() => farms.b_id_farm),
    b_lu_source: text().notNull(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => {
    return [primaryKey({ columns: [table.b_id_farm, table.b_lu_source] })]
  },
)

export type cultivationCatalogueSelectingTypeSelect =
  typeof cultivationCatalogueSelecting.$inferSelect
export type cultivationCatalogueSelectingTypeInsert =
  typeof cultivationCatalogueSelecting.$inferInsert

// Define measures_catalogue table
export const stageApplicabilityTypeOptions = [
  { value: "farm", label: "Bedrijf" },
  { value: "field", label: "Perceel" },
] as const
export const stageApplicabilityTypeEnum = fdmSchema.enum(
  "m_stage_applicability",
  stageApplicabilityTypeOptions.map((x) => x.value) as [string, ...string[]],
)

export const measuresCatalogue = fdmSchema.table(
  "measures_catalogue",
  {
    m_id: text().primaryKey(), // "bln_BM1", "bln_BM2", etc.
    m_source: text().notNull(), // "bln"; future: "ANLb", etc.
    m_name: text().notNull(),
    m_description: text(),
    m_summary: text(),
    m_source_url: text(),
    m_conflicts: text().array(), // Conflicting m_id values
    m_stage_applicability: stageApplicabilityTypeEnum(), // "field" | "farm"
    hash: text(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("m_id_idx").on(table.m_id), index("m_source_idx").on(table.m_source)],
)

export type measuresCatalogueTypeSelect = typeof measuresCatalogue.$inferSelect
export type measuresCatalogueTypeInsert = typeof measuresCatalogue.$inferInsert

// Define measures table
export const measures = fdmSchema.table(
  "measures",
  {
    b_id_measure: text().primaryKey(),
    m_id: text()
      .notNull()
      .references(() => measuresCatalogue.m_id),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("b_id_measure_idx").on(table.b_id_measure)],
)

export type measuresTypeSelect = typeof measures.$inferSelect
export type measuresTypeInsert = typeof measures.$inferInsert

// Define measure_adopting table
export const measureAdopting = fdmSchema.table(
  "measure_adopting",
  {
    b_id: text()
      .notNull()
      .references(() => fields.b_id, { onDelete: "cascade" }),
    b_id_measure: text()
      .notNull()
      .references(() => measures.b_id_measure),
    m_start: timestamp({ withTimezone: true }),
    m_end: timestamp({ withTimezone: true }), // NULL = ongoing / doorlopend
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.b_id, table.b_id_measure] })],
)

export type measureAdoptingTypeSelect = typeof measureAdopting.$inferSelect
export type measureAdoptingTypeInsert = typeof measureAdopting.$inferInsert

// Define measure_catalogue_enabling table
export const measureCatalogueEnabling = fdmSchema.table(
  "measure_catalogue_enabling",
  {
    b_id_farm: text()
      .notNull()
      .references(() => farms.b_id_farm, { onDelete: "cascade" }),
    m_source: text().notNull(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => {
    return [primaryKey({ columns: [table.b_id_farm, table.m_source] })]
  },
)

export type measureCatalogueEnablingTypeSelect = typeof measureCatalogueEnabling.$inferSelect
export type measureCatalogueEnablingTypeInsert = typeof measureCatalogueEnabling.$inferInsert

// ─── Soil Image ───────────────────────────────────────────────────────────────

export const visualImageTypeOptions = [
  { value: "profile", label: "Bodemprofiel" },
  { value: "surface", label: "Bodemoppervlak" },
  { value: "roots", label: "Beworteling" },
  { value: "earthworms", label: "Regenwormen" },
  { value: "structure", label: "Bodemstructuur" },
  { value: "other", label: "Overig" },
] as const
export const visualImageTypeEnum = fdmSchema.enum(
  "a_image_type",
  visualImageTypeOptions.map((x) => x.value) as [string, ...string[]],
)

export const annotationTypeOptions = [
  { value: "pin", label: "Pin" },
  { value: "circle", label: "Cirkel" },
  { value: "arrow", label: "Pijl" },
  { value: "freehand", label: "Vrije vorm" },
] as const
export const annotationTypeEnum = fdmSchema.enum(
  "a_image_annotation_type",
  annotationTypeOptions.map((x) => x.value) as [string, ...string[]],
)

export const bcsIndicatorOptions = [
  { value: "a_ss_bcs", label: "Bodemstructuur" },
  { value: "a_sc_bcs", label: "Verdichting ondergrond" },
  { value: "a_rd_bcs", label: "Beworteling" },
  { value: "a_ew_bcs", label: "Regenwormen" },
  { value: "a_cc_bcs", label: "Gewasbedekking" },
  { value: "a_gs_bcs", label: "Gekleurde vlekken" },
  { value: "a_p_bcs", label: "Plasvorming" },
  { value: "a_c_bcs", label: "Scheuren" },
  { value: "a_rt_bcs", label: "Spoorvorming/vertrapping" },
] as const
export const bcsIndicatorEnum = fdmSchema.enum(
  "a_image_annotation_bcs",
  bcsIndicatorOptions.map((x) => x.value) as [string, ...string[]],
)

// Define soil_image table — stores GCS references for soil photos linked to a sampling event.
export const soilImage = fdmSchema.table(
  "soil_image",
  {
    a_id_image: text().primaryKey(),
    b_id_sampling: text()
      .notNull()
      .references(() => soilSampling.b_id_sampling, {
        onDelete: "cascade",
      }),
    a_image_path: text().notNull(),
    a_image_type: visualImageTypeEnum(),
    a_image_order: integer().notNull().default(0),
    a_image_caption: text(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [index("soil_image_b_id_sampling_idx").on(table.b_id_sampling)],
)

export type soilImageTypeSelect = typeof soilImage.$inferSelect
export type soilImageTypeInsert = typeof soilImage.$inferInsert

// Define soil_image_annotating table — action table for annotating soil images.
// data_json holds percentage-based coordinates for device-responsive rendering.
export const soilImageAnnotating = fdmSchema.table(
  "soil_image_annotating",
  {
    a_id_annotation: text().primaryKey(),
    a_id_image: text()
      .notNull()
      .references(() => soilImage.a_id_image, {
        onDelete: "cascade",
      }),
    a_image_annotation_type: annotationTypeEnum().notNull(),
    a_image_annotation_coordinates: jsonb().notNull(),
    a_image_annotation: text(),
    a_image_annotation_bcs: bcsIndicatorEnum(),
    a_image_annotation_order: integer().notNull().default(0),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [index("soil_image_annotating_a_id_image_idx").on(table.a_id_image)],
)

export type soilImageAnnotatingTypeSelect = typeof soilImageAnnotating.$inferSelect
export type soilImageAnnotatingTypeInsert = typeof soilImageAnnotating.$inferInsert

// ─── Livestock Domain ─────────────────────────────────────────────────────────────

// Livestock Enums & Options
export const animalCategoryOptions = [
  // Rund
  { value: "rvo_100", label: "100 - Melk- en kalfkoeien" },
  {
    value: "rvo_101",
    label: "101 - Jongvee <1 jaar (melkveehouderij) / opfokkalveren <1 jaar (vleesveehouderij)",
  },
  {
    value: "rvo_102",
    label:
      "102 - Vrouwelijk jongvee ≥1 jaar (melkveehouderij) / opfokkalveren ≥1 jaar (vleesveehouderij)",
  },
  { value: "rvo_104", label: "104 - Fokstieren ≥1 jaar" },
  { value: "rvo_112", label: "112 - Witvleeskalveren ca. 14 dagen tot ca. 8 maanden" },
  {
    value: "rvo_115",
    label: "115 - Startkalveren voor rosévlees of roodvlees ca. 14 dagen tot ca. 3 maanden",
  },
  { value: "rvo_116", label: "116 - Rosévleeskalveren ca. 3 maanden tot ca. 8 maanden" },
  { value: "rvo_117", label: "117 - Rosévleeskalveren ca. 14 dagen tot ca. 8 maanden" },
  { value: "rvo_120", label: "120 - Weide- en zoogkoeien" },
  { value: "rvo_122", label: "122 - Roodvleesstieren ca. 3 maanden tot de slacht" },

  // Schaap
  { value: "rvo_550", label: "550 - Schapen voor de vlees- en melkproductie" },
  { value: "rvo_551", label: "551 - Vleesschapen tot ca. 4 maanden (niet op geboortebedrijf)" },
  { value: "rvo_552", label: "552 - Opfokooien, weideschapen en vleesschapen ≥ ca. 4 maanden" },

  // Geit
  { value: "rvo_600", label: "600 - Melkgeiten ≥1 jaar" },
  { value: "rvo_601", label: "601 - Opfokgeiten en vleesgeiten tot ca. 4 maanden" },
  { value: "rvo_602", label: "602 - Opfokgeiten ≥ ca. 4 maanden" },

  // Paard
  { value: "rvo_941", label: "941 - Pony's (schofthoogte tot 1,56m)" },
  { value: "rvo_943", label: "943 - Paarden (schofthoogte vanaf 1,56m)" },

  // Ezel
  { value: "rvo_961", label: "961 - Ezels" },

  // Middeneuropees edelhert
  { value: "rvo_971", label: "971 - Hinden (edelhert) voor de fokkerij" },
  { value: "rvo_973", label: "973 - Herten (edelhert) 6 tot 12 maanden voor de slacht" },
  { value: "rvo_974", label: "974 - Herten (edelhert) ≥12 maanden voor de slacht" },

  // Damhert
  { value: "rvo_981", label: "981 - Hinden (damhert) voor de fokkerij" },
  { value: "rvo_982", label: "982 - Herten (damhert) ≥3 maanden voor de slacht" },

  // Waterbuffel
  { value: "rvo_991", label: "991 - Waterbuffelkoeien" },
  { value: "rvo_992", label: "992 - Waterbuffeljongvee (<2 jaar)" },

  // Varken
  { value: "rvo_400", label: "400 - Fokzeugen (gespeende biggen op ander bedrijf)" },
  { value: "rvo_401", label: "401 - Fokzeugen incl. biggen tot ca. 25 kg" },
  {
    value: "rvo_404",
    label: "404 - Opfokzeugen en -beren van ca. 25 kg tot geslachtsrijpheid",
  },
  { value: "rvo_406", label: "406 - Dekberen en zoekberen" },
  {
    value: "rvo_407",
    label: "407 - Gespeende biggen tot ca. 25 kg zonder moederdier op eigen bedrijf",
  },
  { value: "rvo_411", label: "411 - Vleesvarkens" },

  // Kip
  { value: "rvo_300", label: "300 - Leghennen en (groot)ouderdieren <18 weken" },
  { value: "rvo_301", label: "301 - Leghennen en (groot)ouderdieren ≥18 weken" },
  { value: "rvo_310", label: "310 - (Groot)ouderdieren van vleeskuikens <20 weken" },
  { value: "rvo_311", label: "311 - (Groot)ouderdieren van vleeskuikens ≥20 weken" },
  { value: "rvo_312", label: "312 - Vleeskuikens" },

  // Kalkoen
  { value: "rvo_200", label: "200 - Jonge kalkoenen 0-6 weken" },
  { value: "rvo_201", label: "201 - Opfokkalkoenen 6-30 weken" },
  { value: "rvo_202", label: "202 - Kalkoenen ouderdieren ≥30 weken" },
  { value: "rvo_210", label: "210 - Vleeskalkoenen" },

  // Nerts
  { value: "rvo_751", label: "751 - Fokteven (nertsen)" },

  // Konijn
  { value: "rvo_900", label: "900 - Voedsters en fokrammen (konijnen)" },
  { value: "rvo_901", label: "901 - Vleeskonijnen" },

  // Peking eend
  { value: "rvo_801", label: "801 - Vleeseenden" },
  {
    value: "rvo_802",
    label: "802 - Ouderdieren van vleeseenden in opfok (<20 weken)",
  },
  { value: "rvo_803", label: "803 - Ouderdieren van vleeseenden (≥20 weken)" },

  // Overige diersoorten
  {
    value: "rvo_15",
    label: "15 - Bruine rat, tamme muis, cavia, goudhamster, gerbil",
  },
  { value: "rvo_25", label: "25 - Struisvogel, emoe, nandoe" },
  { value: "rvo_28", label: "28 - Knobbelgans, grauwe gans" },
  { value: "rvo_35", label: "35 - Fazant, patrijs" },
  { value: "rvo_37", label: "37 - Vleesduif, helmparelhoen" },
] as const
export const animalCategoryEnum = fdmSchema.enum(
  "l_herd_category",
  animalCategoryOptions.map((x) => x.value) as [string, ...string[]],
)

export const animalSexOptions = [
  { value: "female", label: "Vrouwelijk" },
  { value: "male", label: "Mannelijk" },
] as const
export const animalSexEnum = fdmSchema.enum(
  "l_sex",
  animalSexOptions.map((x) => x.value) as [string, ...string[]],
)

export const animalSpeciesOptions = [
  { value: "cattle", label: "Rundvee" },
  { value: "pig", label: "Varkens" },
  { value: "poultry", label: "Pluimvee" },
  { value: "turkey", label: "Kalkoenen" },
  { value: "duck", label: "Eenden" },
  { value: "goat", label: "Geiten" },
  { value: "sheep", label: "Schapen" },
  { value: "horse", label: "Paarden" },
  { value: "pony", label: "Pony's" },
  { value: "other", label: "Overige diersoorten" },
] as const
export const animalSpeciesEnum = fdmSchema.enum(
  "l_species",
  animalSpeciesOptions.map((x) => x.value) as [string, ...string[]],
)

export const arrivingMethodOptions = [
  { value: "born", label: "Geboren" },
  { value: "purchased", label: "Aangekocht" },
  { value: "imported", label: "Geïmporteerd" },
] as const
export const arrivingMethodEnum = fdmSchema.enum(
  "l_arriving_method",
  arrivingMethodOptions.map((x) => x.value) as [string, ...string[]],
)

export const leavingMethodOptions = [
  { value: "died", label: "Overleden" },
  { value: "sold", label: "Verkocht" },
  { value: "slaughtered", label: "Geslacht" },
  { value: "exported", label: "Geëxporteerd" },
] as const
export const leavingMethodEnum = fdmSchema.enum(
  "l_leaving_method",
  leavingMethodOptions.map((x) => x.value) as [string, ...string[]],
)

export const feedTypeOptions = [
  { value: "grass_silage", label: "Ingekuild gras" },
  { value: "fresh_grass", label: "Vers gras" },
  { value: "maize_silage", label: "Snijmaïs" },
  { value: "concentrate", label: "Brokken / Krachtvoer" },
  { value: "byproduct", label: "Bijproduct" },
  { value: "mineral", label: "Mineralen" },
  { value: "other", label: "Overig" },
] as const
export const feedTypeEnum = fdmSchema.enum(
  "f_batch_type",
  feedTypeOptions.map((x) => x.value) as [string, ...string[]],
)

export const feedOriginOptions = [
  { value: "own_land", label: "Eigen land" },
  { value: "purchased", label: "Aangekocht" },
] as const
export const feedOriginEnum = fdmSchema.enum(
  "f_batch_origin",
  feedOriginOptions.map((x) => x.value) as [string, ...string[]],
)

export const grazingTypeOptions = [
  { value: "full", label: "Volledig weiden" },
  { value: "partial", label: "Gedeeltelijk weiden" },
] as const
export const grazingTypeEnum = fdmSchema.enum(
  "l_grazing_type",
  grazingTypeOptions.map((x) => x.value) as [string, ...string[]],
)

// Herds
export const herds = fdmSchema.table(
  "herds",
  {
    l_id_herd: text().primaryKey(),
    l_herd_name: text(),
    l_herd_category: animalCategoryEnum(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("l_id_herd_idx").on(table.l_id_herd)],
)

export type herdsTypeSelect = typeof herds.$inferSelect
export type herdsTypeInsert = typeof herds.$inferInsert

export const herdStarting = fdmSchema.table(
  "herd_starting",
  {
    l_id_herd: text()
      .notNull()
      .references(() => herds.l_id_herd),
    b_id_farm: text()
      .notNull()
      .references(() => farms.b_id_farm),
    l_start: timestamp({ withTimezone: true }),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.l_id_herd, table.b_id_farm] })],
)

export type herdStartingTypeSelect = typeof herdStarting.$inferSelect
export type herdStartingTypeInsert = typeof herdStarting.$inferInsert

export const herdEnding = fdmSchema.table("herd_ending", {
  l_id_herd: text()
    .primaryKey()
    .notNull()
    .references(() => herds.l_id_herd),
  l_end: timestamp({ withTimezone: true }),
  created: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated: timestamp({ withTimezone: true }),
})

export type herdEndingTypeSelect = typeof herdEnding.$inferSelect
export type herdEndingTypeInsert = typeof herdEnding.$inferInsert

// Animals
export const animals = fdmSchema.table(
  "animals",
  {
    l_id_animal: text().primaryKey(),
    l_id_eartag: text(),
    l_id_worknumber: text(),
    l_species: animalSpeciesEnum().notNull().default("cattle"),
    l_breed: text(),
    l_coatcolor: text(),
    l_birth_date: timestamp({ withTimezone: true }),
    l_sex: animalSexEnum(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("l_id_animal_idx").on(table.l_id_animal)],
)

export type animalsTypeSelect = typeof animals.$inferSelect
export type animalsTypeInsert = typeof animals.$inferInsert

export const animalArriving = fdmSchema.table(
  "animal_arriving",
  {
    l_id_animal: text()
      .notNull()
      .references(() => animals.l_id_animal),
    b_id_farm: text()
      .notNull()
      .references(() => farms.b_id_farm),
    l_arriving_date: timestamp({ withTimezone: true }),
    l_arriving_method: arrivingMethodEnum().notNull().default("born"),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.l_id_animal, table.b_id_farm] })],
)

export type animalArrivingTypeSelect = typeof animalArriving.$inferSelect
export type animalArrivingTypeInsert = typeof animalArriving.$inferInsert

export const animalLeaving = fdmSchema.table("animal_leaving", {
  l_id_animal: text()
    .primaryKey()
    .notNull()
    .references(() => animals.l_id_animal),
  l_leaving_date: timestamp({ withTimezone: true }),
  l_leaving_method: leavingMethodEnum(),
  created: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated: timestamp({ withTimezone: true }),
})

export type animalLeavingTypeSelect = typeof animalLeaving.$inferSelect
export type animalLeavingTypeInsert = typeof animalLeaving.$inferInsert

export const animalAssigning = fdmSchema.table(
  "animal_assigning",
  {
    l_id_animal: text()
      .notNull()
      .references(() => animals.l_id_animal),
    l_id_herd: text()
      .notNull()
      .references(() => herds.l_id_herd),
    l_assigning_start: timestamp({ withTimezone: true }).notNull(),
    l_assigning_end: timestamp({ withTimezone: true }),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({
      columns: [table.l_id_animal, table.l_id_herd, table.l_assigning_start],
    }),
  ],
)

export type animalAssigningTypeSelect = typeof animalAssigning.$inferSelect
export type animalAssigningTypeInsert = typeof animalAssigning.$inferInsert

// Barns & Housing
export const barns = fdmSchema.table(
  "barns",
  {
    b_id_barn: text().primaryKey(),
    b_barn_name: text(),
    b_floor_area: numericCasted(),
    b_barn_geometry: geometry<"Polygon" | "MultiPolygon">("b_barn_geometry", {
      type: "Polygon",
    }),
    // b_milking_system: text(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex("b_id_barn_idx").on(table.b_id_barn),
    index("b_barn_geom_idx").using("gist", table.b_barn_geometry),
  ],
)

export type barnsTypeSelect = typeof barns.$inferSelect
export type barnsTypeInsert = typeof barns.$inferInsert

export const barnConstructing = fdmSchema.table(
  "barn_constructing",
  {
    b_id_barn: text()
      .notNull()
      .references(() => barns.b_id_barn),
    b_id_farm: text()
      .notNull()
      .references(() => farms.b_id_farm),
    b_barn_constructing_date: timestamp({ withTimezone: true }),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.b_id_barn, table.b_id_farm] })],
)

export type barnConstructingTypeSelect = typeof barnConstructing.$inferSelect
export type barnConstructingTypeInsert = typeof barnConstructing.$inferInsert

export const barnDecommissioning = fdmSchema.table("barn_decommissioning", {
  b_id_barn: text()
    .primaryKey()
    .notNull()
    .references(() => barns.b_id_barn),
  b_barn_decommissioning_date: timestamp({ withTimezone: true }),
  created: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated: timestamp({ withTimezone: true }),
})

export type barnDecommissioningTypeSelect = typeof barnDecommissioning.$inferSelect
export type barnDecommissioningTypeInsert = typeof barnDecommissioning.$inferInsert

export const housing = fdmSchema.table(
  "housing",
  {
    l_id_herd: text()
      .notNull()
      .references(() => herds.l_id_herd),
    b_id_barn: text()
      .notNull()
      .references(() => barns.b_id_barn),
    b_housing_start: timestamp({ withTimezone: true }).notNull(),
    b_housing_end: timestamp({ withTimezone: true }),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.l_id_herd, table.b_id_barn, table.b_housing_start] })],
)

export type housingTypeSelect = typeof housing.$inferSelect
export type housingTypeInsert = typeof housing.$inferInsert

// Milk
export const milkTanks = fdmSchema.table(
  "milk_tanks",
  {
    b_id_milktank: text().primaryKey(),
    b_id_farm: text()
      .notNull()
      .references(() => farms.b_id_farm),
    b_milktank_name: text(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("b_id_milktank_idx").on(table.b_id_milktank)],
)

export type milkTanksTypeSelect = typeof milkTanks.$inferSelect
export type milkTanksTypeInsert = typeof milkTanks.$inferInsert

export const milkingHerd = fdmSchema.table(
  "milking_herd",
  {
    l_id_herd: text()
      .notNull()
      .references(() => herds.l_id_herd),
    b_id_milktank: text()
      .notNull()
      .references(() => milkTanks.b_id_milktank),
    b_milking_start: timestamp({ withTimezone: true }).notNull(),
    b_milking_end: timestamp({ withTimezone: true }),
    b_milk_amount: numericCasted(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({
      columns: [table.l_id_herd, table.b_id_milktank, table.b_milking_start],
    }),
  ],
)

export type milkingHerdTypeSelect = typeof milkingHerd.$inferSelect
export type milkingHerdTypeInsert = typeof milkingHerd.$inferInsert

export const milkingAnimal = fdmSchema.table(
  "milking_animal",
  {
    l_id_animal: text()
      .notNull()
      .references(() => animals.l_id_animal),
    b_id_milktank: text()
      .notNull()
      .references(() => milkTanks.b_id_milktank),
    b_milking_start: timestamp({ withTimezone: true }).notNull(),
    b_milking_end: timestamp({ withTimezone: true }),
    b_milk_amount: numericCasted(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({
      columns: [table.l_id_animal, table.b_id_milktank, table.b_milking_start],
    }),
  ],
)

export type milkingAnimalTypeSelect = typeof milkingAnimal.$inferSelect
export type milkingAnimalTypeInsert = typeof milkingAnimal.$inferInsert

export const milkDeliveries = fdmSchema.table(
  "milk_deliveries",
  {
    b_id_milk_delivery: text().primaryKey(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("b_id_milk_delivery_idx").on(table.b_id_milk_delivery)],
)

export type milkDeliveriesTypeSelect = typeof milkDeliveries.$inferSelect
export type milkDeliveriesTypeInsert = typeof milkDeliveries.$inferInsert

export const milkDelivering = fdmSchema.table(
  "milk_delivering",
  {
    b_id_milk_delivering: text().primaryKey(),
    b_id_milktank: text()
      .notNull()
      .references(() => milkTanks.b_id_milktank),
    b_id_milk_delivery: text()
      .notNull()
      .references(() => milkDeliveries.b_id_milk_delivery),
    b_milk_delivery_date: timestamp({ withTimezone: true }),
    b_milk_amount: numericCasted(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("b_id_milk_delivering_idx").on(table.b_id_milk_delivering)],
)

export type milkDeliveringTypeSelect = typeof milkDelivering.$inferSelect
export type milkDeliveringTypeInsert = typeof milkDelivering.$inferInsert

export const milkSampling = fdmSchema.table(
  "milk_sampling",
  {
    b_id_milk_delivery: text()
      .notNull()
      .references(() => milkDeliveries.b_id_milk_delivery),
    b_id_milk_analysis: text()
      .notNull()
      .references(() => milkAnalyses.b_id_milk_analysis),
    b_sampling_date: timestamp({ withTimezone: true }),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.b_id_milk_delivery, table.b_id_milk_analysis] })],
)

export type milkSamplingTypeSelect = typeof milkSampling.$inferSelect
export type milkSamplingTypeInsert = typeof milkSampling.$inferInsert

export const milkAnalyses = fdmSchema.table(
  "milk_analyses",
  {
    b_id_milk_analysis: text().primaryKey(),
    b_milk_fat: numericCasted(),
    b_milk_protein: numericCasted(),
    b_milk_lactose: numericCasted(),
    b_milk_urea: numericCasted(),
    b_milk_scc: numericCasted(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("b_id_milk_analysis_idx").on(table.b_id_milk_analysis)],
)

export type milkAnalysesTypeSelect = typeof milkAnalyses.$inferSelect
export type milkAnalysesTypeInsert = typeof milkAnalyses.$inferInsert

// Manure
export const manurePits = fdmSchema.table(
  "manure_pits",
  {
    b_id_manurepit: text().primaryKey(),
    b_id_farm: text()
      .notNull()
      .references(() => farms.b_id_farm),
    b_manurepit_name: text(),
    b_pit_area: numericCasted(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("b_id_manurepit_idx").on(table.b_id_manurepit)],
)

export type manurePitsTypeSelect = typeof manurePits.$inferSelect
export type manurePitsTypeInsert = typeof manurePits.$inferInsert

export const excreting = fdmSchema.table(
  "excreting",
  {
    l_id_excreting: text().primaryKey(),
    l_id_herd: text()
      .notNull()
      .references(() => herds.l_id_herd),
    b_id_manurepit: text()
      .notNull()
      .references(() => manurePits.b_id_manurepit),
    l_excreting_start: timestamp({ withTimezone: true }),
    l_excreting_end: timestamp({ withTimezone: true }),
    p_excreting_amount: numericCasted(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("l_id_excreting_idx").on(table.l_id_excreting)],
)

export type excretingTypeSelect = typeof excreting.$inferSelect
export type excretingTypeInsert = typeof excreting.$inferInsert

export const manureDeliveries = fdmSchema.table(
  "manure_deliveries",
  {
    p_id_delivery: text().primaryKey(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("p_id_delivery_idx").on(table.p_id_delivery)],
)

export type manureDeliveriesTypeSelect = typeof manureDeliveries.$inferSelect
export type manureDeliveriesTypeInsert = typeof manureDeliveries.$inferInsert

export const manureDisposing = fdmSchema.table(
  "manure_disposing",
  {
    p_id_disposing: text().primaryKey(),
    b_id_manurepit: text()
      .notNull()
      .references(() => manurePits.b_id_manurepit),
    p_id_delivery: text()
      .notNull()
      .references(() => manureDeliveries.p_id_delivery),
    p_disposing_date: timestamp({ withTimezone: true }),
    p_disposing_amount: numericCasted(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("p_id_disposing_idx").on(table.p_id_disposing)],
)

export type manureDisposingTypeSelect = typeof manureDisposing.$inferSelect
export type manureDisposingTypeInsert = typeof manureDisposing.$inferInsert

export const manureSampling = fdmSchema.table(
  "manure_sampling",
  {
    p_id_delivery: text()
      .notNull()
      .references(() => manureDeliveries.p_id_delivery),
    p_id_analysis: text()
      .notNull()
      .references(() => manureAnalyses.p_id_analysis),
    p_sampling_date: timestamp({ withTimezone: true }),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.p_id_delivery, table.p_id_analysis] })],
)

export type manureSamplingTypeSelect = typeof manureSampling.$inferSelect
export type manureSamplingTypeInsert = typeof manureSampling.$inferInsert

export const manureAnalyses = fdmSchema.table(
  "manure_analyses",
  {
    p_id_analysis: text().primaryKey(),
    p_n_rt: numericCasted(),
    p_p_rt: numericCasted(),
    p_dm: numericCasted(),
    p_om: numericCasted(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("p_id_analysis_idx").on(table.p_id_analysis)],
)

export type manureAnalysesTypeSelect = typeof manureAnalyses.$inferSelect
export type manureAnalysesTypeInsert = typeof manureAnalyses.$inferInsert

// Feed
export const feedBatches = fdmSchema.table(
  "feed_batches",
  {
    f_id_batch: text().primaryKey(),
    b_id_farm: text()
      .notNull()
      .references(() => farms.b_id_farm),
    f_batch_name: text(),
    f_batch_type: feedTypeEnum(),
    f_batch_origin: feedOriginEnum(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("f_id_batch_idx").on(table.f_id_batch)],
)

export type feedBatchesTypeSelect = typeof feedBatches.$inferSelect
export type feedBatchesTypeInsert = typeof feedBatches.$inferInsert

export const feedSampling = fdmSchema.table(
  "feed_sampling",
  {
    f_id_batch: text()
      .notNull()
      .references(() => feedBatches.f_id_batch),
    f_id_feed_analysis: text()
      .notNull()
      .references(() => feedAnalyses.f_id_feed_analysis),
    f_sampling_date: timestamp({ withTimezone: true }),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.f_id_batch, table.f_id_feed_analysis] })],
)

export type feedSamplingTypeSelect = typeof feedSampling.$inferSelect
export type feedSamplingTypeInsert = typeof feedSampling.$inferInsert

export const feedAnalyses = fdmSchema.table(
  "feed_analyses",
  {
    f_id_feed_analysis: text().primaryKey(),
    f_dm: numericCasted(),
    f_cp: numericCasted(),
    f_vem: numericCasted(),
    f_oeb: numericCasted(),
    f_ndf: numericCasted(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("f_id_feed_analysis_idx").on(table.f_id_feed_analysis)],
)

export type feedAnalysesTypeSelect = typeof feedAnalyses.$inferSelect
export type feedAnalysesTypeInsert = typeof feedAnalyses.$inferInsert

export const feedingHerd = fdmSchema.table(
  "feeding_herd",
  {
    f_id_batch: text()
      .notNull()
      .references(() => feedBatches.f_id_batch),
    l_id_herd: text()
      .notNull()
      .references(() => herds.l_id_herd),
    f_feeding_start: timestamp({ withTimezone: true }).notNull(),
    f_feeding_end: timestamp({ withTimezone: true }),
    f_amount: numericCasted(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({
      columns: [table.f_id_batch, table.l_id_herd, table.f_feeding_start],
    }),
  ],
)

export type feedingHerdTypeSelect = typeof feedingHerd.$inferSelect
export type feedingHerdTypeInsert = typeof feedingHerd.$inferInsert

export const feedingAnimal = fdmSchema.table(
  "feeding_animal",
  {
    l_id_animal: text()
      .notNull()
      .references(() => animals.l_id_animal),
    f_id_batch: text()
      .notNull()
      .references(() => feedBatches.f_id_batch),
    f_feeding_start: timestamp({ withTimezone: true }).notNull(),
    f_feeding_end: timestamp({ withTimezone: true }),
    f_amount: numericCasted(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({
      columns: [table.l_id_animal, table.f_id_batch, table.f_feeding_start],
    }),
  ],
)

export type feedingAnimalTypeSelect = typeof feedingAnimal.$inferSelect
export type feedingAnimalTypeInsert = typeof feedingAnimal.$inferInsert

// Grazing
export const grazing = fdmSchema.table(
  "grazing",
  {
    b_id: text().references(() => fields.b_id),
    l_id_herd: text()
      .notNull()
      .references(() => herds.l_id_herd),
    l_grazing_start: timestamp({ withTimezone: true }).notNull(),
    l_grazing_end: timestamp({ withTimezone: true }),
    l_grazing_days: integer(),
    l_grazing_hours: numericCasted(),
    l_grazing_area: numericCasted(),
    l_grazing_type: grazingTypeEnum(),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.l_id_herd, table.l_grazing_start] })],
)

export type grazingTypeSelect = typeof grazing.$inferSelect
export type grazingTypeInsert = typeof grazing.$inferInsert
