import type * as schema from "./db/schema"

export interface FeedBatch {
  f_id_batch: schema.feedBatchesTypeSelect["f_id_batch"]
  b_id_farm: schema.feedBatchesTypeSelect["b_id_farm"]
  f_batch_name?: schema.feedBatchesTypeSelect["f_batch_name"]
  f_batch_type?: schema.feedBatchesTypeSelect["f_batch_type"]
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

export interface Feeding {
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
