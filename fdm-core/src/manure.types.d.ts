import type * as schema from "./db/schema"

export interface ManurePit {
  b_id_manurepit: schema.manurePitsTypeSelect["b_id_manurepit"]
  b_manurepit_name?: schema.manurePitsTypeSelect["b_manurepit_name"]
  b_pit_area?: schema.manurePitsTypeSelect["b_pit_area"]
  created: schema.manurePitsTypeSelect["created"]
  updated?: schema.manurePitsTypeSelect["updated"]
}

export interface Excreting {
  l_id_excreting: schema.excretingTypeSelect["l_id_excreting"]
  l_id_herd: schema.excretingTypeSelect["l_id_herd"]
  b_id_manurepit: schema.excretingTypeSelect["b_id_manurepit"]
  l_excreting_start?: schema.excretingTypeSelect["l_excreting_start"]
  l_excreting_end?: schema.excretingTypeSelect["l_excreting_end"]
  p_amount?: schema.excretingTypeSelect["p_amount"]
  created: schema.excretingTypeSelect["created"]
  updated?: schema.excretingTypeSelect["updated"]
}

export interface ManureDelivery {
  p_id_delivery: schema.manureDeliveriesTypeSelect["p_id_delivery"]
  b_id_manurepit?: schema.manureDisposingTypeSelect["b_id_manurepit"]
  p_id_disposing?: schema.manureDisposingTypeSelect["p_id_disposing"]
  p_disposing_date?: schema.manureDisposingTypeSelect["p_disposing_date"]
  p_amount?: schema.manureDisposingTypeSelect["p_amount"]
  p_id_analysis?: schema.manureAnalysesTypeSelect["p_id_analysis"]
  p_n_rt?: schema.manureAnalysesTypeSelect["p_n_rt"]
  p_p_rt?: schema.manureAnalysesTypeSelect["p_p_rt"]
  p_dm?: schema.manureAnalysesTypeSelect["p_dm"]
  p_om?: schema.manureAnalysesTypeSelect["p_om"]
  p_sampling_date?: schema.manureSamplingTypeSelect["p_sampling_date"]
  created: schema.manureDeliveriesTypeSelect["created"]
  updated?: schema.manureDeliveriesTypeSelect["updated"]
}
