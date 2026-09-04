import type * as schema from "./db/schema"

export interface MilkTank {
  l_id_milktank: schema.milkTanksTypeSelect["l_id_milktank"]
  b_id_farm: schema.milkTanksTypeSelect["b_id_farm"]
  l_milktank_name?: schema.milkTanksTypeSelect["l_milktank_name"]
  created: schema.milkTanksTypeSelect["created"]
  updated?: schema.milkTanksTypeSelect["updated"]
}

export interface MilkingHerd {
  l_id_herd: schema.milkingHerdTypeSelect["l_id_herd"]
  l_id_milktank: schema.milkingHerdTypeSelect["l_id_milktank"]
  l_milking_start: schema.milkingHerdTypeSelect["l_milking_start"]
  l_milking_end?: schema.milkingHerdTypeSelect["l_milking_end"]
  l_milking_amount?: schema.milkingHerdTypeSelect["l_milking_amount"]
  created: schema.milkingHerdTypeSelect["created"]
  updated?: schema.milkingHerdTypeSelect["updated"]
}

export interface MilkingAnimal {
  l_id_animal: schema.milkingAnimalTypeSelect["l_id_animal"]
  l_id_milktank: schema.milkingAnimalTypeSelect["l_id_milktank"]
  l_milking_start: schema.milkingAnimalTypeSelect["l_milking_start"]
  l_milking_end?: schema.milkingAnimalTypeSelect["l_milking_end"]
  l_milking_amount?: schema.milkingAnimalTypeSelect["l_milking_amount"]
  created: schema.milkingAnimalTypeSelect["created"]
  updated?: schema.milkingAnimalTypeSelect["updated"]
}

export interface MilkDelivery {
  l_id_milkdelivery: schema.milkDeliveriesTypeSelect["l_id_milkdelivery"]
  l_id_milktank?: schema.milkDeliveriesTypeSelect["l_id_milktank"]
  l_id_milkdelivery?: schema.milkDeliveriesTypeSelect["l_id_milkdelivery"]
  l_milkdelivery_date?: schema.milkDeliveriesTypeSelect["l_milkdelivery_date"]
  l_milkdelivery_amount?: schema.milkDeliveriesTypeSelect["l_milkdelivery_amount"]
  l_id_milkanalysis?: schema.milkAnalysesTypeSelect["l_id_milkanalysis"]
  l_milk_fat?: schema.milkAnalysesTypeSelect["l_milk_fat"]
  l_milk_protein?: schema.milkAnalysesTypeSelect["l_milk_protein"]
  l_milk_lactose?: schema.milkAnalysesTypeSelect["l_milk_lactose"]
  l_milk_urea?: schema.milkAnalysesTypeSelect["l_milk_urea"]
  l_milk_scc?: schema.milkAnalysesTypeSelect["l_milk_scc"]
  b_sampling_date?: schema.milkSamplingTypeSelect["b_sampling_date"]
  created: schema.milkDeliveriesTypeSelect["created"]
  updated?: schema.milkDeliveriesTypeSelect["updated"]
}

export interface MilkingEventFromHerd {
  type: "herd"
  l_id_herd: schema.milkingHerdTypeSelect["l_id_herd"]
  l_id_milktank: schema.milkingHerdTypeSelect["l_id_milktank"]
  l_milking_start: schema.milkingHerdTypeSelect["l_milking_start"]
  l_milking_end?: schema.milkingHerdTypeSelect["l_milking_end"]
  l_milking_amount?: schema.milkingHerdTypeSelect["l_milking_amount"]
  created: schema.milkingHerdTypeSelect["created"]
  updated?: schema.milkingHerdTypeSelect["updated"]
}

export interface MilkingEventFromAnimal {
  type: "animal"
  l_id_animal: schema.milkingAnimalTypeSelect["l_id_animal"]
  l_id_milktank: schema.milkingAnimalTypeSelect["l_id_milktank"]
  l_milking_start: schema.milkingAnimalTypeSelect["l_milking_start"]
  l_milking_end?: schema.milkingAnimalTypeSelect["l_milking_end"]
  l_milking_amount?: schema.milkingAnimalTypeSelect["l_milking_amount"]
  created: schema.milkingAnimalTypeSelect["created"]
  updated?: schema.milkingAnimalTypeSelect["updated"]
}

export type MilkingEventForAnimal = MilkingEventFromHerd | MilkingEventFromAnimal
export type Milking = MilkingEventFromHerd | MilkingEventFromAnimal

export interface MilkingSummaryForAnimal {
  l_milking_amount: number | null
  l_milk_fat: number | null
  l_milk_protein: number | null
  l_milk_lactose: number | null
  l_milk_urea: number | null
  l_milk_scc: number | null
}
