import type { Field, FieldGeometry } from "@nmi-agro/fdm-core"
import { acquiringMethodOptions, determineIfFieldIsBuffer } from "@nmi-agro/fdm-core"
import area from "@turf/area"
import { lineString } from "@turf/helpers"
import { length } from "@turf/length"
import { createHash } from "node:crypto"
import type { AcquiringMethod, ImportFieldInit, ImportFieldUpdate, RvoImportPlan } from "./apply"
import { compareFields, type FieldWithCultivations } from "./compare"
import {
  type FieldDiff,
  type ImportReviewAction,
  type RvoField,
  type RvoImportReviewItem,
  RvoImportReviewStatus,
} from "./types"
import { getItemId } from "./utils"

type CultivationCatalogue = Parameters<typeof compareFields>[3]

/**
 * Perimeter of a field geometry in meters (outer rings only).
 */
function perimeter(geometry: FieldGeometry): number {
  if (geometry.type === "Polygon") {
    return length(lineString(geometry.coordinates[0] ?? []), { units: "meters" })
  }
  return geometry.coordinates
    .map((polygon) => length(lineString(polygon[0] ?? []), { units: "meters" }))
    .reduce((a, b) => a + b, 0)
}

/**
 * Compares fields read from an RVO Mijn Percelen shapefile with the farm's fields.
 *
 * A shapefile has no buffer strip information, so it is estimated from the area, perimeter and
 * name of each shapefile field (`determineIfFieldIsBuffer`). Because that is an estimate, a
 * buffer strip difference is never reported for fields that already exist: their local value is
 * kept, and an item that only differed in its buffer strip becomes a `MATCH`.
 *
 * @param localFields - The farm's fields with their cultivations.
 * @param rvoFields - Fields read with `getRvoFieldsFromShapefile`. Their `mestData` is set by this function.
 * @param year - Calendar year of the import.
 * @param cultivationsCatalogue - Cultivation catalogue, used for crop names.
 * @returns The review items.
 */
export function compareShapefileFields(
  localFields: FieldWithCultivations[],
  rvoFields: RvoField[],
  year: number,
  cultivationsCatalogue: CultivationCatalogue = [],
): RvoImportReviewItem<Field>[] {
  const items = compareFields(localFields, rvoFields, year, cultivationsCatalogue)

  for (const rvoField of rvoFields) {
    rvoField.properties.mestData = {
      IndBufferstrook: determineIfFieldIsBuffer(
        area(rvoField.geometry) / 10000,
        perimeter(rvoField.geometry),
        rvoField.properties.CropFieldDesignator,
      )
        ? "J"
        : "N",
    }
  }

  for (const item of items) {
    item.diffs = item.diffs.filter((diff) => diff !== "b_bufferstrip")
    if (item.diffs.length === 0 && item.status === RvoImportReviewStatus.CONFLICT) {
      item.status = RvoImportReviewStatus.MATCH
    }
    if (item.localField && item.rvoField?.properties.mestData) {
      item.rvoField.properties.mestData.IndBufferstrook = item.localField.b_bufferstrip ? "J" : "N"
    }
  }

  return items
}

/**
 * Returns the actions that can be chosen for a review item with the given status.
 *
 * @param status - Status of the review item.
 * @returns The allowed actions. `IGNORE` is always allowed and means "change nothing".
 */
export function getAllowedImportActions(status: RvoImportReviewStatus): ImportReviewAction[] {
  switch (status) {
    case RvoImportReviewStatus.NEW_REMOTE:
      return ["ADD_REMOTE", "IGNORE"]
    case RvoImportReviewStatus.NEW_LOCAL:
      return ["KEEP_LOCAL", "REMOVE_LOCAL", "IGNORE"]
    case RvoImportReviewStatus.EXPIRED_LOCAL:
      return ["CLOSE_LOCAL", "KEEP_LOCAL", "IGNORE"]
    case RvoImportReviewStatus.MATCH:
    case RvoImportReviewStatus.CONFLICT:
      return ["UPDATE_FROM_REMOTE", "KEEP_LOCAL", "IGNORE"]
  }
}

/**
 * Computes a stable hash of review items: their IDs, statuses and differences. A client can send
 * it back when applying choices, so the server can detect that the farm changed in between.
 *
 * @param items - The review items.
 * @returns A hex-encoded SHA-256 hash.
 */
export function getReviewHash(items: RvoImportReviewItem<unknown>[]): string {
  const normalized = items
    .map((item) => [getItemId(item), item.status, [...item.diffs].sort()] as const)
    .sort((a, b) => a[0].localeCompare(b[0]))
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex")
}

/**
 * Values a client can set for a review item, overriding the value the action would otherwise use.
 * The geometry can only be chosen, not supplied: `"local"` keeps the current geometry and
 * `"remote"` takes the geometry from RVO or the shapefile.
 */
export interface ImportChoiceValues {
  b_name?: string
  b_geometry?: "local" | "remote"
  b_lu_catalogue?: string | null
  b_start?: Date
  b_end?: Date | null
  b_acquiring_method?: AcquiringMethod
  b_bufferstrip?: boolean
}

/** The choice for one review item. */
export interface ImportChoice {
  /** What to do with the item. */
  action: ImportReviewAction
  /** Values that override the values of the action. */
  values?: ImportChoiceValues
}

/**
 * A problem with the choices for a review item.
 *
 * - `unknown_item`: there is no review item with this ID.
 * - `action_not_allowed`: the action does not fit the status of the item.
 * - `invalid_value`: a value is missing or invalid, for example an empty name or an end date before the start date.
 */
export interface ImportChoiceIssue {
  item_id: string
  code: "unknown_item" | "action_not_allowed" | "invalid_value"
  message: string
}

/**
 * Thrown by {@link resolveImportChoices} when choices do not fit the review items.
 */
export class ImportChoiceError extends Error {
  /** The problems found. */
  readonly issues: ImportChoiceIssue[]

  /**
   * @param issues - The problems found.
   */
  constructor(issues: ImportChoiceIssue[]) {
    super(`Invalid import choices: ${issues.map((i) => `${i.item_id}: ${i.message}`).join("; ")}`)
    this.name = "ImportChoiceError"
    this.issues = issues
  }
}

function parseBufferstrip(value: string | undefined): boolean | undefined {
  if (value === "J") return true
  if (value === "N") return false
  return undefined
}

function remoteAcquiringMethod(useTitleCode: string | undefined): AcquiringMethod {
  const candidate = `nl_${useTitleCode}`
  return acquiringMethodOptions.some((option) => option.value === candidate)
    ? (candidate as AcquiringMethod)
    : "unknown"
}

type ComparableValue = string | number | boolean | null | undefined

function toComparable(value: unknown): ComparableValue {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (value && typeof value === "object") return JSON.stringify(value)
  return value as ComparableValue
}

function sameValue(a: unknown, b: unknown): boolean {
  return toComparable(a ?? null) === toComparable(b ?? null)
}

/**
 * The values of a review item as stored locally and as reported by RVO or the shapefile.
 */
function getItemValues(item: RvoImportReviewItem<Field>, year: number) {
  const local = item.localField
  const rvo = item.rvoField
  const closeDate = new Date(Date.UTC(year - 1, 11, 31))

  const localValues = local
    ? {
        b_name: local.b_name,
        b_geometry: local.b_geometry as FieldGeometry,
        b_lu_catalogue: item.localCultivation?.b_lu_catalogue ?? null,
        b_start: local.b_start ? new Date(local.b_start) : undefined,
        b_end: local.b_end ? new Date(local.b_end) : null,
        b_acquiring_method: local.b_acquiring_method as AcquiringMethod,
        b_bufferstrip: local.b_bufferstrip,
      }
    : undefined

  const remoteValues = rvo
    ? {
        b_name: rvo.properties.CropFieldDesignator || `RVO Perceel ${rvo.properties.CropFieldID}`,
        b_geometry: rvo.geometry as FieldGeometry,
        b_lu_catalogue: rvo.properties.CropTypeCode
          ? `nl_${rvo.properties.CropTypeCode}`
          : undefined,
        b_start: new Date(rvo.properties.BeginDate),
        b_end: rvo.properties.EndDate ? new Date(rvo.properties.EndDate) : null,
        b_acquiring_method: remoteAcquiringMethod(rvo.properties.UseTitleCode),
        b_bufferstrip: parseBufferstrip(rvo.properties.mestData?.IndBufferstrook),
      }
    : item.status === RvoImportReviewStatus.EXPIRED_LOCAL
      ? { b_end: closeDate }
      : undefined

  return { localValues, remoteValues }
}

const VALUE_KEYS = [
  "b_name",
  "b_geometry",
  "b_lu_catalogue",
  "b_start",
  "b_end",
  "b_acquiring_method",
  "b_bufferstrip",
] as const

/**
 * Turns the choices of a client into the changes to apply with `applyRvoImport`.
 *
 * Per item:
 * - `ADD_REMOTE` adds the field with the values from RVO or the shapefile.
 * - `UPDATE_FROM_REMOTE` takes the RVO value for every value that differs, or that is missing
 *   locally. RVO never erases a local value it does not have.
 * - `KEEP_LOCAL` keeps the local values.
 * - `CLOSE_LOCAL` sets the end date to 31 December of the year before the import year.
 * - `REMOVE_LOCAL` removes the field.
 * - `IGNORE` and `NO_ACTION` change nothing, and so does an item without a choice.
 *
 * Values in {@link ImportChoice.values} override the values of the action, so a client can make
 * the same per-field choices as the review screen of the web app.
 *
 * @param items - The review items from the comparison.
 * @param choices - The choice per item ID (see `getItemId`).
 * @param year - Calendar year of the import.
 * @returns The changes to apply.
 * @throws {ImportChoiceError} When a choice refers to an unknown item, uses an action that does
 * not fit the item's status, or contains an invalid value.
 */
export function resolveImportChoices(
  items: RvoImportReviewItem<Field>[],
  choices: Record<string, ImportChoice>,
  year: number,
): RvoImportPlan {
  const issues: ImportChoiceIssue[] = []
  const itemsById = new Map(items.map((item) => [getItemId(item), item]))

  for (const [item_id, choice] of Object.entries(choices)) {
    const item = itemsById.get(item_id)
    if (!item) {
      issues.push({ item_id, code: "unknown_item", message: "No review item with this ID." })
    } else if (
      choice.action !== "NO_ACTION" &&
      !getAllowedImportActions(item.status).includes(choice.action)
    ) {
      issues.push({
        item_id,
        code: "action_not_allowed",
        message: `Action ${choice.action} is not allowed for status ${item.status}.`,
      })
    }
  }
  if (issues.length > 0) throw new ImportChoiceError(issues)

  const plan: RvoImportPlan = { fieldsToAdd: [], fieldsToUpdate: [], fieldsToRemove: [] }

  for (const item of items) {
    const item_id = getItemId(item)
    const choice = choices[item_id]
    if (!choice || choice.action === "IGNORE" || choice.action === "NO_ACTION") continue

    const { localValues, remoteValues } = getItemValues(item, year)
    const overrides = choice.values ?? {}

    if (choice.action === "REMOVE_LOCAL") {
      if (localValues && item.localField) plan.fieldsToRemove.push(item.localField.b_id)
      continue
    }

    if (choice.action === "ADD_REMOTE") {
      if (!item.rvoField || !remoteValues) continue
      const remote = remoteValues as Required<NonNullable<typeof remoteValues>>
      const init: ImportFieldInit = {
        b_name: overrides.b_name ?? remote.b_name,
        b_id_source: item.rvoField.properties.CropFieldID,
        b_geometry: remote.b_geometry,
        b_lu_catalogue:
          overrides.b_lu_catalogue !== undefined
            ? overrides.b_lu_catalogue
            : (remote.b_lu_catalogue ?? null),
        b_start: overrides.b_start ?? remote.b_start,
        b_end: overrides.b_end !== undefined ? overrides.b_end : remote.b_end,
        b_acquiring_method: overrides.b_acquiring_method ?? remote.b_acquiring_method,
        b_bufferstrip: overrides.b_bufferstrip ?? remote.b_bufferstrip ?? false,
      }
      validateName(item_id, init.b_name, issues)
      validatePeriod(item_id, init.b_start, init.b_end, issues)
      plan.fieldsToAdd.push(init)
      continue
    }

    // KEEP_LOCAL, UPDATE_FROM_REMOTE and CLOSE_LOCAL change an existing field.
    if (!item.localField || !localValues) continue
    const diffs = new Set<FieldDiff>(item.diffs)
    const target: Record<string, unknown> = {}

    for (const key of VALUE_KEYS) {
      const local = localValues[key]
      const remote = remoteValues?.[key as keyof typeof remoteValues]
      let value: unknown = local
      if (choice.action === "UPDATE_FROM_REMOTE" && remote !== undefined) {
        const isMissingLocally = local === null || local === undefined
        if (diffs.has(key) || isMissingLocally) value = remote
      }
      if (choice.action === "CLOSE_LOCAL" && key === "b_end" && remote !== undefined) {
        value = remote
      }
      const override = overrides[key]
      if (override !== undefined) {
        if (key === "b_geometry") {
          value = override === "remote" ? (remoteValues?.b_geometry ?? local) : local
        } else {
          value = override
        }
      }
      target[key] = value
    }

    const update: Record<string, unknown> = {}
    for (const key of VALUE_KEYS) {
      if (!sameValue(target[key], localValues[key])) update[key] = target[key]
    }

    // Only check what changes: fdm-core checks a changed date against the stored other date.
    if ("b_name" in update) validateName(item_id, target.b_name as string | undefined, issues)
    if (("b_start" in update || "b_end" in update) && target.b_start) {
      validatePeriod(item_id, target.b_start as Date, target.b_end as Date | null, issues)
    }
    if (
      choice.action === "UPDATE_FROM_REMOTE" &&
      item.rvoField &&
      item.rvoField.properties.CropFieldID !== item.localField.b_id_source
    ) {
      update.b_id_source = item.rvoField.properties.CropFieldID
    }
    if (Object.keys(update).length > 0) {
      plan.fieldsToUpdate.push({
        ...(update as Partial<ImportFieldUpdate>),
        b_id: item.localField.b_id,
        b_lu: item.localCultivation?.b_lu,
      })
    }
  }

  if (issues.length > 0) throw new ImportChoiceError(issues)
  return plan
}

function validateName(item_id: string, b_name: string | undefined, issues: ImportChoiceIssue[]) {
  if (!b_name || b_name.trim() === "") {
    issues.push({ item_id, code: "invalid_value", message: "The field name must not be empty." })
  }
}

function validatePeriod(
  item_id: string,
  b_start: Date | undefined,
  b_end: Date | null | undefined,
  issues: ImportChoiceIssue[],
) {
  if (!b_start || Number.isNaN(b_start.getTime())) {
    issues.push({ item_id, code: "invalid_value", message: "The field needs a start date." })
  } else if (b_end && b_end.getTime() <= b_start.getTime()) {
    issues.push({
      item_id,
      code: "invalid_value",
      message: "The end date must be after the start date.",
    })
  }
}
