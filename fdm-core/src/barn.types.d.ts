import type * as schema from "./db/schema"

export interface Barn {
  b_id_barn: schema.barnsTypeSelect["b_id_barn"]
  b_barn_name?: schema.barnsTypeSelect["b_barn_name"]
  b_floor_area?: schema.barnsTypeSelect["b_floor_area"]
  b_barn_geometry?: schema.barnsTypeSelect["b_barn_geometry"]
  // b_milking_system?: schema.barnsTypeSelect["b_milking_system"]
  b_id_farm: schema.barnConstructingTypeSelect["b_id_farm"]
  b_barn_constructing_date?: schema.barnConstructingTypeSelect["b_barn_constructing_date"]
  b_barn_decommissioning_date?: schema.barnDecommissioningTypeSelect["b_barn_decommissioning_date"]
  created: schema.barnsTypeSelect["created"]
  updated?: schema.barnsTypeSelect["updated"]
}

export interface Housing {
  l_id_herd: schema.housingTypeSelect["l_id_herd"]
  b_id_barn: schema.housingTypeSelect["b_id_barn"]
  b_housing_start: schema.housingTypeSelect["b_housing_start"]
  b_housing_end?: schema.housingTypeSelect["b_housing_end"]
  created: schema.housingTypeSelect["created"]
  updated?: schema.housingTypeSelect["updated"]
}
