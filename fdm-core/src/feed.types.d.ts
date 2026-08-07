import type * as schema from "./db/schema"

export interface FeedCatalogue {
  f_id_catalogue: schema.feedsCatalogueTypeSelect["f_id_catalogue"]
  f_source: schema.feedsCatalogueTypeSelect["f_source"]
  f_name_nl: schema.feedsCatalogueTypeSelect["f_name_nl"]
  f_type_rvo: schema.feedsCatalogueTypeSelect["f_type_rvo"]
  f_dm: schema.feedsCatalogueTypeSelect["f_dm"]
  f_n_dm: schema.feedsCatalogueTypeSelect["f_n_dm"]
  f_p_dm: schema.feedsCatalogueTypeSelect["f_p_dm"]
  hash: schema.feedsCatalogueTypeSelect["hash"]
  created: schema.feedsCatalogueTypeSelect["created"]
  updated?: schema.feedsCatalogueTypeSelect["updated"]
}

export interface FeedBatch {
  f_id_batch: schema.feedBatchesTypeSelect["f_id_batch"]
  b_id_farm: schema.feedBatchesTypeSelect["b_id_farm"]
  f_batch_name?: schema.feedBatchesTypeSelect["f_batch_name"]
  f_id_catalogue: schema.feedBatchesTypeSelect["f_id_catalogue"]
  f_batch_type?: schema.feedsCatalogueTypeSelect["f_type_rvo"] | null
  f_batch_origin?: schema.feedBatchesTypeSelect["f_batch_origin"]
  f_id_feed_analysis?: schema.feedAnalysesTypeSelect["f_id_feed_analysis"]
  f_dm?: schema.feedAnalysesTypeSelect["f_dm"]
  f_cp?: schema.feedAnalysesTypeSelect["f_cp"]
  f_vem?: schema.feedAnalysesTypeSelect["f_vem"]
  f_oeb?: schema.feedAnalysesTypeSelect["f_oeb"]
  f_ndf?: schema.feedAnalysesTypeSelect["f_ndf"]
  f_sampling_date?: schema.feedSamplingTypeSelect["f_sampling_date"]
  created: schema.feedBatchesTypeSelect["created"]
  updated?: schema.feedBatchesTypeSelect["updated"]
}

export interface FeedingHerd {
  f_id_batch: schema.feedingHerdTypeSelect["f_id_batch"]
  l_id_herd: schema.feedingHerdTypeSelect["l_id_herd"]
  f_feeding_start: schema.feedingHerdTypeSelect["f_feeding_start"]
  f_feeding_end?: schema.feedingHerdTypeSelect["f_feeding_end"]
  f_amount?: schema.feedingHerdTypeSelect["f_amount"]
  created: schema.feedingHerdTypeSelect["created"]
  updated?: schema.feedingHerdTypeSelect["updated"]
}

export interface FeedingAnimal {
  l_id_animal: schema.feedingAnimalTypeSelect["l_id_animal"]
  f_id_batch: schema.feedingAnimalTypeSelect["f_id_batch"]
  f_feeding_start: schema.feedingAnimalTypeSelect["f_feeding_start"]
  f_feeding_end?: schema.feedingAnimalTypeSelect["f_feeding_end"]
  f_amount?: schema.feedingAnimalTypeSelect["f_amount"]
  created: schema.feedingAnimalTypeSelect["created"]
  updated?: schema.feedingAnimalTypeSelect["updated"]
}

export interface FeedingEventFromHerd {
  l_feeding_type: "herd"
  l_id_herd: schema.feedingHerdTypeSelect["l_id_herd"]
  f_id_batch: schema.feedingHerdTypeSelect["f_id_batch"]
  f_feeding_start: schema.feedingHerdTypeSelect["f_feeding_start"]
  f_feeding_end?: schema.feedingHerdTypeSelect["f_feeding_end"]
  f_amount?: schema.feedingHerdTypeSelect["f_amount"]
  created: schema.feedingHerdTypeSelect["created"]
  updated?: schema.feedingHerdTypeSelect["updated"]
}

export interface FeedingEventFromAnimal {
  l_feeding_type: "animal"
  l_id_animal: schema.feedingAnimalTypeSelect["l_id_animal"]
  f_id_batch: schema.feedingAnimalTypeSelect["f_id_batch"]
  f_feeding_start: schema.feedingAnimalTypeSelect["f_feeding_start"]
  f_feeding_end?: schema.feedingAnimalTypeSelect["f_feeding_end"]
  f_amount?: schema.feedingAnimalTypeSelect["f_amount"]
  created: schema.feedingAnimalTypeSelect["created"]
  updated?: schema.feedingAnimalTypeSelect["updated"]
}

export type FeedingEventForAnimal = FeedingEventFromHerd | FeedingEventFromAnimal
export type Feeding = FeedingHerd | FeedingAnimal

export interface FeedingSummaryForAnimal {
  f_amount: number | null
  f_dm: number | null
  f_cp: number | null
  f_vem: number | null
  f_oeb: number | null
  f_ndf: number | null
}
