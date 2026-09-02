import { PrincipalId } from "./authorization.types"
import * as schema from "./db/schema"
import { FdmType } from "./fdm.types"

type OmittedPlanColumns = "created" | "updated"
type OmittedEstablishingColumns = "p_id_plan" | "created" | "updated"

/** A saved fertilizer plan. */
export type FertilizerPlan = Omit<schema.fertilizerPlanEstablishingTypeSelect, OmittedEstablishingColumns> & Omit<
  schema.fertilizerPlansTypeSelect,
  OmittedPlanColumns
>

/** A saved fertilizer plan. Information about the related farm may be unknown. */
export type FoundFertilizerPlan = Omit<
  {
    [k in keyof schema.fertilizerPlanEstablishingTypeSelect]:
      | schema.fertilizerPlanEstablishingTypeSelect[k]
      | null
  },
  OmittedEstablishingColumns
> &
  Omit<schema.fertilizerPlansTypeSelect, OmittedPlanColumns>