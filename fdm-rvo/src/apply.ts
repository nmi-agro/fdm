import {
  acquiringMethodOptions,
  addCultivation,
  addField,
  type FdmType,
  type FieldGeometry,
  getDefaultDatesOfCultivation,
  removeCultivation,
  removeField,
  updateField,
} from "@nmi-agro/fdm-core"
import { z } from "zod"
import { FieldGeometrySchema } from "./types"

/** Acquiring method code of a field, for example `nl_01` (ownership). */
export type AcquiringMethod = (typeof acquiringMethodOptions)[number]["value"]

const AcquiringMethodSchema = z.enum(
  acquiringMethodOptions.map((option) => option.value) as [AcquiringMethod, ...AcquiringMethod[]],
)

/**
 * Zod schema for a field that is added by an import.
 */
export const ImportFieldInitSchema = z.object({
  /** Name of the field. */
  b_name: z.string().trim().min(1),
  /** ID of the field at the source (the RVO `CropFieldID`), or `null`. */
  b_id_source: z.string().nullable(),
  /** Geometry of the field. */
  b_geometry: FieldGeometrySchema,
  /** Cultivation catalogue code of the main cultivation to add, or `null` to add none. */
  b_lu_catalogue: z.string().nullable(),
  /** Start date of the field. */
  b_start: z.coerce.date(),
  /** End date of the field, or `null` when it stays in use. */
  b_end: z.coerce.date().nullable(),
  /** Acquiring method of the field. */
  b_acquiring_method: AcquiringMethodSchema,
  /** Whether the field is a buffer strip. */
  b_bufferstrip: z.boolean(),
})

/**
 * Zod schema for a change to an existing field. Only the values that change are present.
 */
export const ImportFieldUpdateSchema = ImportFieldInitSchema.partial().extend({
  /** ID of the field to update. */
  b_id: z.string(),
  /**
   * ID of the field's current main cultivation. When `b_lu_catalogue` is present, this
   * cultivation is removed first.
   */
  b_lu: z.string().optional(),
})

/**
 * Zod schema for the changes of an import: fields to add, update and remove.
 */
export const RvoImportPlanSchema = z.object({
  fieldsToAdd: z.array(ImportFieldInitSchema),
  fieldsToUpdate: z.array(ImportFieldUpdateSchema),
  fieldsToRemove: z.array(z.string()),
})

/** A field that is added by an import. */
export type ImportFieldInit = z.infer<typeof ImportFieldInitSchema>
/** A change to an existing field. Only the values that change are present. */
export type ImportFieldUpdate = z.infer<typeof ImportFieldUpdateSchema>
/** The changes of an import: fields to add, update and remove. */
export type RvoImportPlan = z.infer<typeof RvoImportPlanSchema>

/** What an import changed. */
export interface RvoImportResult {
  /** Fields that were added, with their geometry. */
  created: { b_id: string; b_geometry: FieldGeometry }[]
  /** IDs of fields that were updated. */
  updated: string[]
  /** IDs of updated fields that received an end date. */
  closed: string[]
  /** IDs of fields that were removed. */
  removed: string[]
}

/** Options for {@link applyRvoImport}. */
export interface ApplyRvoImportOptions {
  /**
   * Called for every added field inside the transaction. When it throws, the whole import is
   * rolled back.
   */
  onFieldAdded?: (tx: FdmType, b_id: string, geometry: FieldGeometry) => Promise<void>
}

async function addMainCultivation(
  tx: FdmType,
  principal_id: string,
  b_id_farm: string,
  b_id: string,
  b_lu_catalogue: string,
  year: number,
) {
  const { b_lu_start, b_lu_end } = await getDefaultDatesOfCultivation(
    tx,
    principal_id,
    b_id_farm,
    b_lu_catalogue,
    year,
  )
  await addCultivation(tx, principal_id, b_lu_catalogue, b_id, b_lu_start, b_lu_end)
}

/**
 * Applies the changes of a field import (from RVO or from a shapefile) in one transaction.
 *
 * - Added fields get their main cultivation (when `b_lu_catalogue` is set), with the default
 *   sowing and end dates of that crop in `year`.
 * - For updated fields, a present `b_lu_catalogue` replaces the main cultivation: the
 *   cultivation `b_lu` is removed and, unless `b_lu_catalogue` is `null`, the new crop is added.
 * - Removed fields are deleted with everything recorded on them.
 *
 * Changes run one after the other, so a failure rolls back everything.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal performing the import.
 * @param b_id_farm - The farm the fields belong to.
 * @param plan - The fields to add, update and remove.
 * @param year - Calendar year of the import, used for the cultivation dates.
 * @param options - Optional hook for added fields.
 * @returns The IDs of the created, updated, closed and removed fields.
 * @example
 * ```ts
 * const result = await applyRvoImport(fdm, principal_id, b_id_farm, plan, 2026)
 * ```
 */
export async function applyRvoImport(
  fdm: FdmType,
  principal_id: string,
  b_id_farm: string,
  plan: RvoImportPlan,
  year: number,
  options: ApplyRvoImportOptions = {},
): Promise<RvoImportResult> {
  const result: RvoImportResult = { created: [], updated: [], closed: [], removed: [] }

  await fdm.transaction(async (tx) => {
    for (const field of plan.fieldsToAdd) {
      const b_id = await addField(
        tx,
        principal_id,
        b_id_farm,
        field.b_name,
        field.b_id_source,
        field.b_geometry,
        field.b_start,
        field.b_acquiring_method,
        field.b_end,
        field.b_bufferstrip,
      )
      result.created.push({ b_id, b_geometry: field.b_geometry })

      if (typeof field.b_lu_catalogue === "string") {
        await addMainCultivation(tx, principal_id, b_id_farm, b_id, field.b_lu_catalogue, year)
      }
      if (options.onFieldAdded) {
        await options.onFieldAdded(tx, b_id, field.b_geometry)
      }
    }

    for (const field of plan.fieldsToUpdate) {
      await updateField(
        tx,
        principal_id,
        field.b_id,
        field.b_name ?? undefined,
        field.b_id_source,
        field.b_geometry,
        field.b_start,
        field.b_acquiring_method,
        field.b_end,
        field.b_bufferstrip,
      )
      result.updated.push(field.b_id)
      if (field.b_end) result.closed.push(field.b_id)

      if (field.b_lu_catalogue !== undefined) {
        if (field.b_lu) {
          await removeCultivation(tx, principal_id, field.b_lu)
        }
        if (field.b_lu_catalogue) {
          await addMainCultivation(
            tx,
            principal_id,
            b_id_farm,
            field.b_id,
            field.b_lu_catalogue,
            year,
          )
        }
      }
    }

    for (const b_id of plan.fieldsToRemove) {
      await removeField(tx, principal_id, b_id)
      result.removed.push(b_id)
    }
  })

  return result
}

/**
 * Runs a task for every added field in chunks, for example to add soil parameter estimates
 * after an import. A failure for one field is passed to `onError` and does not stop the others.
 *
 * @param fields - The added fields, from {@link RvoImportResult.created}.
 * @param task - Task to run per field.
 * @param onError - Called when the task fails for a field.
 * @param chunkSize - Number of fields processed at the same time. Defaults to 10.
 */
export async function forEachAddedField(
  fields: RvoImportResult["created"],
  task: (b_id: string, geometry: FieldGeometry) => Promise<void>,
  onError: (b_id: string, error: unknown) => void,
  chunkSize = 10,
): Promise<void> {
  for (let i = 0; i < fields.length; i += chunkSize) {
    await Promise.all(
      fields.slice(i, i + chunkSize).map(async ({ b_id, b_geometry }) => {
        try {
          await task(b_id, b_geometry)
        } catch (error) {
          onError(b_id, error)
        }
      }),
    )
  }
}
