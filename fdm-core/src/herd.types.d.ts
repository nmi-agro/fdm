import type * as schema from "./db/schema"

export interface Herd {
  l_id_herd: schema.herdsTypeSelect["l_id_herd"]
  l_herd_name: schema.herdsTypeSelect["l_herd_name"]
  l_id_category: schema.herdsTypeSelect["l_id_category"]
  l_category: schema.animalCategoriesCatalogueTypeSelect["l_category"] | null
  l_specie: schema.animalCategoriesCatalogueTypeSelect["l_specie"] | null
  l_sex_options: schema.animalCategoriesCatalogueTypeSelect["l_sex_options"] | null
  l_lsu: schema.animalCategoriesCatalogueTypeSelect["l_lsu"] | null
  b_id_farm: schema.herdStartingTypeSelect["b_id_farm"]
  l_start: schema.herdStartingTypeSelect["l_start"]
  l_end: schema.herdEndingTypeSelect["l_end"] | null
  created: schema.herdsTypeSelect["created"]
  updated: schema.herdsTypeSelect["updated"]
}
