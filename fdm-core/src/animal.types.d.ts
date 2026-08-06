import type * as schema from "./db/schema"

export interface Animal {
  l_id_animal: schema.animalsTypeSelect["l_id_animal"]
  l_id_eartag?: schema.animalsTypeSelect["l_id_eartag"]
  l_id_worknumber?: schema.animalsTypeSelect["l_id_worknumber"]
  l_species: schema.animalsTypeSelect["l_species"]
  l_breed?: schema.animalsTypeSelect["l_breed"]
  l_coatcolor?: schema.animalsTypeSelect["l_coatcolor"]
  l_birth_date?: schema.animalsTypeSelect["l_birth_date"]
  l_sex?: schema.animalsTypeSelect["l_sex"]
  b_id_farm: schema.animalArrivingTypeSelect["b_id_farm"]
  l_arriving_method?: schema.animalArrivingTypeSelect["l_arriving_method"]
  l_arriving_date?: schema.animalArrivingTypeSelect["l_arriving_date"]
  l_leaving_date?: schema.animalLeavingTypeSelect["l_leaving_date"]
  l_leaving_method?: schema.animalLeavingTypeSelect["l_leaving_method"]
  l_id_herd?: schema.animalAssigningTypeSelect["l_id_herd"]
  created: schema.animalsTypeSelect["created"]
  updated?: schema.animalsTypeSelect["updated"]
}

export interface HerdCensus {
  l_id_herd: schema.herdsTypeSelect["l_id_herd"]
  l_herd_name?: schema.herdsTypeSelect["l_herd_name"]
  l_herd_category?: schema.herdsTypeSelect["l_herd_category"]
  count: number
}

export interface AnimalAssignmentHistory {
  l_id_herd: schema.animalAssigningTypeSelect["l_id_herd"]
  l_herd_name?: schema.herdsTypeSelect["l_herd_name"]
  l_herd_category?: schema.herdsTypeSelect["l_herd_category"]
  l_assigning_start: schema.animalAssigningTypeSelect["l_assigning_start"]
  l_assigning_end?: schema.animalAssigningTypeSelect["l_assigning_end"]
}
