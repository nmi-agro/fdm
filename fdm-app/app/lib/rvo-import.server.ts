import type { z } from "zod"
import { addSoilParameterEstimatesToField } from "@nmi-agro/fdm-calculator"
import {
  applyRvoImport,
  forEachAddedField,
  type RvoImportPlan,
  type RvoImportResult,
} from "@nmi-agro/fdm-rvo"
import type { ImportReviewChoicesSchema } from "~/components/blocks/rvo/schema"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { fdm } from "~/lib/fdm.server"

/**
 * Saves the reviewed fields of an RVO or shapefile import and adds soil parameter estimates to
 * every new field. The changes themselves are applied by `applyRvoImport` from `fdm-rvo`, which
 * the REST API uses too.
 *
 * Soil estimates are added after the import is saved; when they fail for a field, the field is
 * kept without them.
 *
 * @param principal_id - Principal of the current session.
 * @param b_id_farm - Farm the fields belong to.
 * @param year - Calendar year of the import.
 * @param formValues - The reviewed fields, validated with `ImportReviewChoicesSchema`.
 * @returns The created, updated, closed and removed fields.
 */
export async function saveRvoImport(
  principal_id: string,
  b_id_farm: string,
  year: number,
  formValues: z.infer<typeof ImportReviewChoicesSchema>,
): Promise<RvoImportResult> {
  const result = await applyRvoImport(
    fdm,
    principal_id,
    b_id_farm,
    formValues as unknown as RvoImportPlan,
    year,
  )

  const nmiApiKey = getNmiApiKey()
  if (nmiApiKey) {
    await forEachAddedField(
      result.created,
      async (b_id, geometry) => {
        await addSoilParameterEstimatesToField(fdm, principal_id, b_id, geometry, nmiApiKey)
      },
      (b_id, error) => console.warn(`Failed to fetch soil estimates for field ${b_id}:`, error),
    )
  }

  return result
}
