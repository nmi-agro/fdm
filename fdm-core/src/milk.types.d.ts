import type * as schema from "./db/schema"

export interface MilkTank {
  b_id_milktank: schema.milkTanksTypeSelect["b_id_milktank"]
  b_milktank_name?: schema.milkTanksTypeSelect["b_milktank_name"]
  created: schema.milkTanksTypeSelect["created"]
  updated?: schema.milkTanksTypeSelect["updated"]
}

export interface Milking {
  l_id_herd: schema.milkingHerdTypeSelect["l_id_herd"]
  b_id_milktank: schema.milkingHerdTypeSelect["b_id_milktank"]
  b_milking_start: schema.milkingHerdTypeSelect["b_milking_start"]
  b_milking_end?: schema.milkingHerdTypeSelect["b_milking_end"]
  b_milk_amount?: schema.milkingHerdTypeSelect["b_milk_amount"]
  created: schema.milkingHerdTypeSelect["created"]
  updated?: schema.milkingHerdTypeSelect["updated"]
}

export interface MilkingAnimal {
  l_id_animal: schema.milkingAnimalTypeSelect["l_id_animal"]
  b_id_milktank: schema.milkingAnimalTypeSelect["b_id_milktank"]
  b_milking_start: schema.milkingAnimalTypeSelect["b_milking_start"]
  b_milking_end?: schema.milkingAnimalTypeSelect["b_milking_end"]
  b_milk_amount?: schema.milkingAnimalTypeSelect["b_milk_amount"]
  created: schema.milkingAnimalTypeSelect["created"]
  updated?: schema.milkingAnimalTypeSelect["updated"]
}

export interface MilkDelivery {
  b_id_milk_delivery: schema.milkDeliveriesTypeSelect["b_id_milk_delivery"]
  b_id_milktank?: schema.milkDeliveringTypeSelect["b_id_milktank"]
  b_id_milk_delivering?: schema.milkDeliveringTypeSelect["b_id_milk_delivering"]
  b_milk_delivering_date?: schema.milkDeliveringTypeSelect["b_milk_delivering_date"]
  b_milk_amount?: schema.milkDeliveringTypeSelect["b_milk_amount"]
  b_id_milk_analysis?: schema.milkAnalysesTypeSelect["b_id_milk_analysis"]
  b_milk_fat?: schema.milkAnalysesTypeSelect["b_milk_fat"]
  b_milk_protein?: schema.milkAnalysesTypeSelect["b_milk_protein"]
  b_milk_lactose?: schema.milkAnalysesTypeSelect["b_milk_lactose"]
  b_milk_urea?: schema.milkAnalysesTypeSelect["b_milk_urea"]
  b_milk_scc?: schema.milkAnalysesTypeSelect["b_milk_scc"]
  b_sampling_date?: schema.milkSamplingTypeSelect["b_sampling_date"]
  created: schema.milkDeliveriesTypeSelect["created"]
  updated?: schema.milkDeliveriesTypeSelect["updated"]
}
