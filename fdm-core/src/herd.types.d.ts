import type * as schema from "./db/schema"

export interface Herd {
  l_id_herd: schema.herdsTypeSelect["l_id_herd"]
  l_herd_name?: schema.herdsTypeSelect["l_herd_name"]
  l_herd_category?: schema.herdsTypeSelect["l_herd_category"]
  b_id_farm: schema.herdStartingTypeSelect["b_id_farm"]
  l_start?: schema.herdStartingTypeSelect["l_start"]
  l_end?: schema.herdEndingTypeSelect["l_end"]
  created: schema.herdsTypeSelect["created"]
  updated?: schema.herdsTypeSelect["updated"]
}
