import type {
  AnimalCategorySex,
  AnimalCategorySpecies,
  CatalogueAnimalCategories,
  CatalogueAnimalCategory,
} from "../d"

interface RvoAnimalCategory {
  l_id_category: string
  l_category: string
  l_specie: AnimalCategorySpecies
  l_sex_options: readonly AnimalCategorySex[]
  l_lsu: number
}

const female = ["female"] as const
const male = ["male"] as const
const femaleAndMale = ["female", "male"] as const

/**
 * RVO category IDs and labels follow Tabel 4 Diergebonden normen 2026.
 * LSU coefficients follow the closest matching Eurostat livestock-unit
 * category for the stated production stage.
 *
 * @see https://www.rvo.nl/sites/default/files/2026-03/Tabel-4-Diergebonden-normen-2026.pdf"
 * @see https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/1246.pdf
 */
const rvoAnimalCategories: readonly RvoAnimalCategory[] = [
  {
    l_id_category: "rvo_100",
    l_category: "100 - Melk- en kalfkoeien",
    l_specie: "cattle",
    l_sex_options: female,
    l_lsu: 1,
  },
  {
    l_id_category: "rvo_101",
    l_category:
      "101 - Jongvee <1 jaar (melkveehouderij) / opfokkalveren <1 jaar (vleesveehouderij)",
    l_specie: "cattle",
    l_sex_options: femaleAndMale,
    l_lsu: 0.4,
  },
  {
    l_id_category: "rvo_102",
    l_category:
      "102 - Vrouwelijk jongvee ≥1 jaar (melkveehouderij) / opfokkalveren ≥1 jaar (vleesveehouderij)",
    l_specie: "cattle",
    l_sex_options: female,
    l_lsu: 0.8,
  },
  {
    l_id_category: "rvo_104",
    l_category: "104 - Fokstieren ≥1 jaar",
    l_specie: "cattle",
    l_sex_options: male,
    l_lsu: 1,
  },
  {
    l_id_category: "rvo_112",
    l_category: "112 - Witvleeskalveren ca. 14 dagen tot ca. 8 maanden",
    l_specie: "cattle",
    l_sex_options: femaleAndMale,
    l_lsu: 0.4,
  },
  {
    l_id_category: "rvo_115",
    l_category: "115 - Startkalveren voor rosévlees of roodvlees ca. 14 dagen tot ca. 3 maanden",
    l_specie: "cattle",
    l_sex_options: femaleAndMale,
    l_lsu: 0.4,
  },
  {
    l_id_category: "rvo_116",
    l_category: "116 - Rosévleeskalveren ca. 3 maanden tot ca. 8 maanden",
    l_specie: "cattle",
    l_sex_options: femaleAndMale,
    l_lsu: 0.4,
  },
  {
    l_id_category: "rvo_117",
    l_category: "117 - Rosévleeskalveren ca. 14 dagen tot ca. 8 maanden",
    l_specie: "cattle",
    l_sex_options: femaleAndMale,
    l_lsu: 0.4,
  },
  {
    l_id_category: "rvo_120",
    l_category: "120 - Weide- en zoogkoeien",
    l_specie: "cattle",
    l_sex_options: female,
    l_lsu: 0.8,
  },
  {
    l_id_category: "rvo_122",
    l_category: "122 - Roodvleesstieren ca. 3 maanden tot de slacht",
    l_specie: "cattle",
    l_sex_options: male,
    l_lsu: 0.7,
  },
  {
    l_id_category: "rvo_550",
    l_category: "550 - Schapen voor de vlees- en melkproductie",
    l_specie: "sheep",
    l_sex_options: femaleAndMale,
    l_lsu: 0.1,
  },
  {
    l_id_category: "rvo_551",
    l_category: "551 - Vleesschapen tot ca. 4 maanden (niet op geboortebedrijf)",
    l_specie: "sheep",
    l_sex_options: femaleAndMale,
    l_lsu: 0.1,
  },
  {
    l_id_category: "rvo_552",
    l_category: "552 - Opfokooien, weideschapen en vleesschapen ≥ ca. 4 maanden",
    l_specie: "sheep",
    l_sex_options: femaleAndMale,
    l_lsu: 0.1,
  },
  {
    l_id_category: "rvo_600",
    l_category: "600 - Melkgeiten ≥1 jaar",
    l_specie: "goat",
    l_sex_options: female,
    l_lsu: 0.1,
  },
  {
    l_id_category: "rvo_601",
    l_category: "601 - Opfokgeiten en vleesgeiten tot ca. 4 maanden",
    l_specie: "goat",
    l_sex_options: femaleAndMale,
    l_lsu: 0.1,
  },
  {
    l_id_category: "rvo_602",
    l_category: "602 - Opfokgeiten ≥ ca. 4 maanden",
    l_specie: "goat",
    l_sex_options: female,
    l_lsu: 0.1,
  },
  {
    l_id_category: "rvo_941",
    l_category: "941 - Pony's (schofthoogte tot 1,56m)",
    l_specie: "pony",
    l_sex_options: femaleAndMale,
    l_lsu: 0.8,
  },
  {
    l_id_category: "rvo_943",
    l_category: "943 - Paarden (schofthoogte vanaf 1,56m)",
    l_specie: "horse",
    l_sex_options: femaleAndMale,
    l_lsu: 0.8,
  },
  {
    l_id_category: "rvo_961",
    l_category: "961 - Ezels",
    l_specie: "other",
    l_sex_options: femaleAndMale,
    l_lsu: 0.8,
  },
  {
    l_id_category: "rvo_971",
    l_category: "971 - Hinden (edelhert) voor de fokkerij",
    l_specie: "other",
    l_sex_options: female,
    l_lsu: 0,
  },
  {
    l_id_category: "rvo_973",
    l_category: "973 - Herten (edelhert) 6 tot 12 maanden voor de slacht",
    l_specie: "other",
    l_sex_options: femaleAndMale,
    l_lsu: 0,
  },
  {
    l_id_category: "rvo_974",
    l_category: "974 - Herten (edelhert) ≥12 maanden voor de slacht",
    l_specie: "other",
    l_sex_options: femaleAndMale,
    l_lsu: 0,
  },
  {
    l_id_category: "rvo_981",
    l_category: "981 - Hinden (damhert) voor de fokkerij",
    l_specie: "other",
    l_sex_options: female,
    l_lsu: 0,
  },
  {
    l_id_category: "rvo_982",
    l_category: "982 - Herten (damhert) ≥3 maanden voor de slacht",
    l_specie: "other",
    l_sex_options: femaleAndMale,
    l_lsu: 0,
  },
  {
    l_id_category: "rvo_991",
    l_category: "991 - Waterbuffelkoeien",
    l_specie: "cattle",
    l_sex_options: female,
    l_lsu: 1,
  },
  {
    l_id_category: "rvo_992",
    l_category: "992 - Waterbuffeljongvee (<2 jaar)",
    l_specie: "cattle",
    l_sex_options: femaleAndMale,
    l_lsu: 0.7,
  },
  {
    l_id_category: "rvo_400",
    l_category: "400 - Fokzeugen (gespeende biggen op ander bedrijf)",
    l_specie: "pig",
    l_sex_options: female,
    l_lsu: 0.5,
  },
  {
    l_id_category: "rvo_401",
    l_category: "401 - Fokzeugen incl. biggen tot ca. 25 kg",
    l_specie: "pig",
    l_sex_options: female,
    l_lsu: 0.5,
  },
  {
    l_id_category: "rvo_404",
    l_category: "404 - Opfokzeugen en -beren van ca. 25 kg tot geslachtsrijpheid",
    l_specie: "pig",
    l_sex_options: femaleAndMale,
    l_lsu: 0.3,
  },
  {
    l_id_category: "rvo_406",
    l_category: "406 - Dekberen en zoekberen",
    l_specie: "pig",
    l_sex_options: male,
    l_lsu: 0.3,
  },
  {
    l_id_category: "rvo_407",
    l_category: "407 - Gespeende biggen tot ca. 25 kg zonder moederdier op eigen bedrijf",
    l_specie: "pig",
    l_sex_options: femaleAndMale,
    l_lsu: 0.027,
  },
  {
    l_id_category: "rvo_411",
    l_category: "411 - Vleesvarkens",
    l_specie: "pig",
    l_sex_options: femaleAndMale,
    l_lsu: 0.3,
  },
  {
    l_id_category: "rvo_300",
    l_category: "300 - Leghennen en (groot)ouderdieren <18 weken",
    l_specie: "poultry",
    l_sex_options: femaleAndMale,
    l_lsu: 0.014,
  },
  {
    l_id_category: "rvo_301",
    l_category: "301 - Leghennen en (groot)ouderdieren ≥18 weken",
    l_specie: "poultry",
    l_sex_options: femaleAndMale,
    l_lsu: 0.014,
  },
  {
    l_id_category: "rvo_310",
    l_category: "310 - (Groot)ouderdieren van vleeskuikens <20 weken",
    l_specie: "poultry",
    l_sex_options: femaleAndMale,
    l_lsu: 0.014,
  },
  {
    l_id_category: "rvo_311",
    l_category: "311 - (Groot)ouderdieren van vleeskuikens ≥20 weken",
    l_specie: "poultry",
    l_sex_options: femaleAndMale,
    l_lsu: 0.014,
  },
  {
    l_id_category: "rvo_312",
    l_category: "312 - Vleeskuikens",
    l_specie: "poultry",
    l_sex_options: femaleAndMale,
    l_lsu: 0.007,
  },
  {
    l_id_category: "rvo_200",
    l_category: "200 - Jonge kalkoenen 0-6 weken",
    l_specie: "turkey",
    l_sex_options: femaleAndMale,
    l_lsu: 0.03,
  },
  {
    l_id_category: "rvo_201",
    l_category: "201 - Opfokkalkoenen 6-30 weken",
    l_specie: "turkey",
    l_sex_options: femaleAndMale,
    l_lsu: 0.03,
  },
  {
    l_id_category: "rvo_202",
    l_category: "202 - Kalkoenen ouderdieren ≥30 weken",
    l_specie: "turkey",
    l_sex_options: femaleAndMale,
    l_lsu: 0.03,
  },
  {
    l_id_category: "rvo_210",
    l_category: "210 - Vleeskalkoenen",
    l_specie: "turkey",
    l_sex_options: femaleAndMale,
    l_lsu: 0.03,
  },
  {
    l_id_category: "rvo_751",
    l_category: "751 - Fokteven (nertsen)",
    l_specie: "other",
    l_sex_options: female,
    l_lsu: 0,
  },
  {
    l_id_category: "rvo_900",
    l_category: "900 - Voedsters en fokrammen (konijnen)",
    l_specie: "other",
    l_sex_options: femaleAndMale,
    l_lsu: 0.02,
  },
  {
    l_id_category: "rvo_901",
    l_category: "901 - Vleeskonijnen",
    l_specie: "other",
    l_sex_options: femaleAndMale,
    l_lsu: 0,
  },
  {
    l_id_category: "rvo_801",
    l_category: "801 - Vleeseenden",
    l_specie: "duck",
    l_sex_options: femaleAndMale,
    l_lsu: 0.01,
  },
  {
    l_id_category: "rvo_802",
    l_category: "802 - Ouderdieren van vleeseenden in opfok (<20 weken)",
    l_specie: "duck",
    l_sex_options: femaleAndMale,
    l_lsu: 0.01,
  },
  {
    l_id_category: "rvo_803",
    l_category: "803 - Ouderdieren van vleeseenden (≥20 weken)",
    l_specie: "duck",
    l_sex_options: femaleAndMale,
    l_lsu: 0.01,
  },
  {
    l_id_category: "rvo_15",
    l_category: "15 - Bruine rat, tamme muis, cavia, goudhamster, gerbil",
    l_specie: "other",
    l_sex_options: femaleAndMale,
    l_lsu: 0,
  },
  {
    l_id_category: "rvo_25",
    l_category: "25 - Struisvogel, emoe, nandoe",
    l_specie: "other",
    l_sex_options: femaleAndMale,
    l_lsu: 0.35,
  },
  {
    l_id_category: "rvo_28",
    l_category: "28 - Knobbelgans, grauwe gans",
    l_specie: "poultry",
    l_sex_options: femaleAndMale,
    l_lsu: 0.02,
  },
  {
    l_id_category: "rvo_35",
    l_category: "35 - Fazant, patrijs",
    l_specie: "poultry",
    l_sex_options: femaleAndMale,
    l_lsu: 0.001,
  },
  {
    l_id_category: "rvo_37",
    l_category: "37 - Vleesduif, helmparelhoen",
    l_specie: "poultry",
    l_sex_options: femaleAndMale,
    l_lsu: 0.001,
  },
]

export async function getCatalogueRvo(): Promise<CatalogueAnimalCategories> {
  return rvoAnimalCategories.map(
    (category): CatalogueAnimalCategory => ({
      l_category_source: "rvo",
      l_id_category: category.l_id_category,
      l_category: category.l_category,
      l_specie: category.l_specie,
      l_sex_options: [...category.l_sex_options],
      l_lsu: category.l_lsu,
    }),
  )
}
