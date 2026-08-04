import type * as schema from "./db/schema"

export interface Grazing {
  b_id?: schema.grazingTypeSelect["b_id"]
  l_id_herd: schema.grazingTypeSelect["l_id_herd"]
  l_grazing_start: schema.grazingTypeSelect["l_grazing_start"]
  l_grazing_end?: schema.grazingTypeSelect["l_grazing_end"]
  l_grazing_days?: schema.grazingTypeSelect["l_grazing_days"]
  l_grazing_hours?: schema.grazingTypeSelect["l_grazing_hours"]
  l_grazing_area?: schema.grazingTypeSelect["l_grazing_area"]
  l_grazing_type?: schema.grazingTypeSelect["l_grazing_type"]
  created: schema.grazingTypeSelect["created"]
  updated?: schema.grazingTypeSelect["updated"]
}
