import type { Field, FieldGeometry } from "@nmi-agro/fdm-core"
import type { FieldDiff, RvoImportReviewItem } from "@nmi-agro/fdm-rvo/types"
import { getItemId } from "@nmi-agro/fdm-rvo/utils"
import { area } from "@turf/area"
import { format as formatDateFns, parseISO } from "date-fns"
import { adjustEndDateAtYearStart } from "@/app/lib/calendar"
import { acquiringMethodOptions } from "~/lib/constants"

export type ReviewItem = RvoImportReviewItem<Field>
export type ReviewOption = { value: string; label: string }

/** Flags that describe what the source of the review data is able to tell us. */
export interface ImportReviewFlags {
  /**
   * Whether the data source knows if a field is a buffer strip. Defaults to `true`. Shapefile
   * uploads do not contain this information, so there the user edits the value directly.
   */
  b_bufferstrip_info_available?: boolean
}

/** Everything the registry needs to know about the surrounding review, resolved once. */
export interface ReviewFieldContext {
  calendar: string
  bufferstripInfoAvailable: boolean
  cultivationOptions: ReviewOption[]
}

/**
 * Resolves the defaults of the review settings once, so every consumer agrees on them.
 */
export function createReviewFieldContext({
  calendar,
  flags,
  cultivationOptions = [],
}: {
  calendar: string
  flags?: ImportReviewFlags
  cultivationOptions?: ReviewOption[]
}): ReviewFieldContext {
  return {
    calendar,
    bufferstripInfoAvailable: flags?.b_bufferstrip_info_available ?? true,
    cultivationOptions,
  }
}

/** Tests whether the value is null or undefined. */
function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined
}

/** Reduces a date-like value to its UTC calendar day, or `null` when it is missing or invalid. */
function toDay(value: unknown): string | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().split("T")[0]
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) return "-"
  try {
    return formatDateFns(typeof value === "string" ? parseISO(value) : value, "dd-MM-yyyy")
  } catch {
    return String(value)
  }
}

interface ReviewFieldTypeHandler {
  /** Compares two values; a missing value (`null`/`undefined`) equals another missing value. */
  equals(a: unknown, b: unknown): boolean
  /**
   * Formats the given value. Passing an array of enum options will just return the label
   * corresponding to the value.
   */
  format(value: unknown, options?: ReviewOption[]): string
}

/** Comparison and display behaviour for each kind of reviewable value. */
export const REVIEW_FIELD_TYPES = {
  string: {
    equals: (a, b) => a === b,
    format: (value) => (typeof value === "string" && value !== "" ? value : "-"),
  },
  enum: {
    equals: (a, b) => a === b,
    format: (value, options) =>
      typeof value === "string" ? (options?.find((x) => x.value === value)?.label ?? value) : "-",
  },
  date: {
    equals: (a, b) => toDay(a) === toDay(b),
    format: formatDate,
  },
  boolean: {
    equals: (a, b) => a === b,
    format: (value) => (typeof value === "boolean" ? (value ? "Ja" : "Nee") : "-"),
  },
  geometry: {
    // Geometry values only ever originate from the local or the remote field, never from the user.
    equals: (a, b) => a === b,
    format: () => "Perceelgeometrie",
  },
} as const satisfies Record<string, ReviewFieldTypeHandler>

export type ReviewFieldType = keyof typeof REVIEW_FIELD_TYPES

/** Compares two values of the given type. */
export function valuesEqual(type: ReviewFieldType, a: unknown, b: unknown): boolean {
  if (isNullish(a) || isNullish(b)) return isNullish(a) && isNullish(b)
  return REVIEW_FIELD_TYPES[type].equals(a, b)
}

/** Formats a value of the given type for display. */
export function formatValue(type: ReviewFieldType, value: unknown, options?: ReviewOption[]) {
  return REVIEW_FIELD_TYPES[type].format(value, options)
}

export interface ReviewFieldDefinition<K extends FieldDiff = FieldDiff> {
  /** Name of the field, as used by fdm-core and in the user choices. */
  key: K
  type: ReviewFieldType
  /** Id of the table column. */
  columnId: string
  label: string
  description: string
  /** Whether the user may type in a value other than the local or the RVO one. */
  allowCustomValue: boolean
  /** The value currently stored in FDM, `undefined` when there is none. */
  getLocal(item: ReviewItem): unknown
  /**
   * The value RVO reports, `undefined` when RVO has no (usable) value for this item. `null` is a
   * real value: RVO says the field is empty.
   */
  getRemote(item: ReviewItem, ctx: ReviewFieldContext): unknown
  /** Value for a field that is new from RVO when `getRemote` has no value. */
  fallback?: unknown
  /** Returns the options for an enum field. */
  getOptions?(ctx: ReviewFieldContext): ReviewOption[] | undefined
  /**
   * Formats the local value. If no local field is available or the value is missing, returns "-".
   * Defaults to using `format` for the field type.
   */
  formatLocal?(item: ReviewItem): string | undefined
  /**
   * Formats the remote value. If no remote field is available or the value is missing, returns "-".
   * Defaults to using `format` for the field type.
   */
  formatRemote?(item: ReviewItem): string | undefined
  /**
   * When this returns `false`, the data source cannot tell the RVO value. The value is then a
   * direct user edit, is left out of the "Gebruik RVO"/"Gebruik FDM" row action, and `getRemote`
   * only provides the default for fields that are new.
   */
  isRemoteAvailable?(ctx: ReviewFieldContext): boolean
  /** Explains in the column header why the remote value is not available. */
  unavailableDescription?: string
}

/**
 * Formats the field area and returns it as a string with the unit "ha".
 */
function formatHectares(hectares: number) {
  return `${hectares.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
}

/** RVO reports `J` or `N`; anything else means there is no information. */
function parseBufferstrip(value: string | undefined): boolean | undefined {
  if (value === "J") return true
  if (value === "N") return false
  return undefined
}

/** The date on which a local field which RVO no longer reports is closed: the end of last year. */
function getCloseDate(ctx: ReviewFieldContext): string | undefined {
  const year = Number(ctx.calendar)
  if (!Number.isInteger(year)) return undefined
  return new Date(Date.UTC(year - 1, 11, 31)).toISOString()
}

/**
 * Info for each field in a reviewed field init object, mostly corresponding to the fields of
 * `Field` in fdm-core.
 */
const definitions = [
  {
    key: "b_name",
    type: "string",
    columnId: "perceel",
    label: "Perceel",
    description: "De naam en het RVO ID van het perceel.",
    allowCustomValue: true,
    getLocal: (item) => item.localField?.b_name,
    getRemote: (item) =>
      item.rvoField
        ? item.rvoField.properties.CropFieldDesignator ||
          `RVO Perceel ${item.rvoField.properties.CropFieldID}`
        : undefined,
  },
  {
    key: "b_geometry",
    type: "geometry",
    columnId: "oppervlakte",
    label: "Oppervlakte",
    description: "De oppervlakte van het perceel in hectaren.",
    allowCustomValue: false,
    getLocal: (item) => item.localField?.b_geometry,
    getRemote: (item) => item.rvoField?.geometry,
    formatLocal: (item) =>
      item.localField ? formatHectares(item.localField.b_area ?? 0) : undefined,
    formatRemote: (item) =>
      item.rvoField ? formatHectares(area(item.rvoField.geometry) / 10000) : undefined,
  },
  {
    key: "b_lu_catalogue",
    type: "enum",
    columnId: "gewas",
    label: "Gewas",
    description: "Het gewas dat op 15 mei wordt geteeld.",
    allowCustomValue: true,
    getLocal: (item) => item.localCultivation?.b_lu_catalogue,
    // Without a crop code there is nothing to import; keep the local cultivation untouched.
    getRemote: (item) =>
      item.rvoField?.properties.CropTypeCode
        ? `nl_${item.rvoField.properties.CropTypeCode}`
        : undefined,
    fallback: null,
    getOptions: (ctx) => ctx.cultivationOptions,
  },
  {
    key: "b_start",
    type: "date",
    columnId: "ingangsdatum",
    label: "Ingangsdatum",
    description: "De datum vanaf wanneer het perceel actief is.",
    allowCustomValue: true,
    getLocal: (item) => item.localField?.b_start,
    getRemote: (item) => item.rvoField?.properties.BeginDate,
  },
  {
    key: "b_end",
    type: "date",
    columnId: "einddatum",
    label: "Einddatum",
    description: "De datum waarop het perceel niet meer actief is.",
    allowCustomValue: true,
    getLocal: (item) => item.localField?.b_end,
    getRemote: (item, ctx) =>
      item.status === "EXPIRED_LOCAL"
        ? getCloseDate(ctx)
        : item.rvoField
          ? (item.rvoField.properties.EndDate ?? null)
          : undefined,
    formatRemote: (item) =>
      item.rvoField?.properties.EndDate
        ? formatDate(adjustEndDateAtYearStart(parseISO(item.rvoField.properties.EndDate)))
        : "-",
  },
  {
    key: "b_acquiring_method",
    type: "enum",
    columnId: "gebruikstitel",
    label: "Gebruikstitel",
    description: "De vorm van gebruikstitel (bv. eigendom, pacht).",
    allowCustomValue: true,
    getLocal: (item) => item.localField?.b_acquiring_method,
    getRemote: (item) => {
      if (!item.rvoField) return undefined
      const candidate = `nl_${item.rvoField.properties.UseTitleCode}`
      return acquiringMethodOptions.some((option) => option.value === candidate)
        ? candidate
        : "unknown"
    },
    getOptions: () => acquiringMethodOptions,
  },
  {
    key: "b_bufferstrip",
    type: "boolean",
    columnId: "bufferstrook",
    label: "Bufferstrook",
    description: "Geeft aan of het perceel bij RVO geregistreerd staat als bufferstrook.",
    allowCustomValue: true,
    getLocal: (item) => item.localField?.b_bufferstrip,
    // For shapefile uploads this is the estimate from `determineIfFieldIsBuffer`, which the
    // server stores in `mestData` because a shapefile has no buffer strip information.
    getRemote: (item) => parseBufferstrip(item.rvoField?.properties.mestData?.IndBufferstrook),
    fallback: false,
    isRemoteAvailable: (ctx) => ctx.bufferstripInfoAvailable,
    unavailableDescription:
      "Shapefile bevat geen informatie over bufferstroken. De getoonde waarden zijn schattingen of de huidige ingevulde status voor het perceel.",
  },
] as const satisfies readonly ReviewFieldDefinition[]

export type ReviewItemFieldKey = (typeof definitions)[number]["key"]
export type ReviewField = ReviewFieldDefinition<ReviewItemFieldKey>
export type ReviewChoices = Partial<Record<ReviewItemFieldKey, unknown>>

// ---------------------------------------------------------------------------
// Derivation helpers
// ---------------------------------------------------------------------------

/**
 * The central registry of fields that can be reviewed during an RVO import. The table columns,
 * the row action and the values that are submitted are all derived from it.
 */
export const REVIEW_FIELDS: readonly ReviewField[] = definitions

/** Whether the RVO value of the field is offered to the user as an alternative. */
export function isRemoteAvailable(field: ReviewField, ctx: ReviewFieldContext): boolean {
  return field.isRemoteAvailable?.(ctx) !== false
}

/** The fields that take part in the "Gebruik RVO"/"Gebruik FDM" row action. */
export function getRowFields(ctx: ReviewFieldContext): ReviewField[] {
  return REVIEW_FIELDS.filter((field) => isRemoteAvailable(field, ctx))
}

/** The fields which differ between FDM and RVO. An expired field always has a different end date. */
export function getDiffKeys(item: ReviewItem): ReadonlySet<FieldDiff> {
  const keys = new Set<FieldDiff>(item.diffs)
  if (item.status === "EXPIRED_LOCAL") keys.add("b_end")
  return keys
}

/** The value shown when the user has made no choice. */
export function getDefaultValue(field: ReviewField, item: ReviewItem, ctx: ReviewFieldContext) {
  if (item.status === "NEW_REMOTE") {
    const remote = field.getRemote(item, ctx)
    return remote === undefined ? field.fallback : remote
  }
  return field.getLocal(item)
}

/** The value that applies: the user's choice, or else the default. */
export function getEffectiveValue(
  field: ReviewField,
  item: ReviewItem,
  ctx: ReviewFieldContext,
  choices: ReviewChoices | undefined,
) {
  const choice = choices?.[field.key]
  return choice !== undefined ? choice : getDefaultValue(field, item, ctx)
}

/**
 * The value that "Gebruik RVO" applies. RVO only replaces the local value when it actually
 * differs, or when there is no local value, so that incomplete RVO data never erases local data.
 */
export function getRemoteTarget(field: ReviewField, item: ReviewItem, ctx: ReviewFieldContext) {
  const local = field.getLocal(item)
  if (!isRemoteAvailable(field, ctx)) return local
  const remote = field.getRemote(item, ctx)
  if (remote === undefined) return local
  return getDiffKeys(item).has(field.key) || isNullish(local) ? remote : local
}

/** The action that corresponds with the choices made for a field that exists in both FDM and RVO. */
export function getConflictRowAction(
  item: ReviewItem,
  ctx: ReviewFieldContext,
  choices: ReviewChoices | undefined,
): "UPDATE_FROM_REMOTE" | "KEEP_LOCAL" | "CUSTOM" {
  const fields = getRowFields(ctx)
  const matches = (pick: (field: ReviewField) => unknown) =>
    fields.every((field) =>
      valuesEqual(field.type, getEffectiveValue(field, item, ctx, choices), pick(field)),
    )

  if (matches((field) => getRemoteTarget(field, item, ctx))) return "UPDATE_FROM_REMOTE"
  if (matches((field) => field.getLocal(item))) return "KEEP_LOCAL"
  return "CUSTOM"
}

/** The values to store as user choices when applying a row action. */
export function getRowActionValues(
  action: "UPDATE_FROM_REMOTE" | "KEEP_LOCAL",
  item: ReviewItem,
  ctx: ReviewFieldContext,
): ReviewChoices {
  const values: Record<string, unknown> = {}
  for (const field of getRowFields(ctx)) {
    values[field.key] =
      action === "UPDATE_FROM_REMOTE" ? getRemoteTarget(field, item, ctx) : field.getLocal(item)
  }
  return values as ReviewChoices
}

const END_DATE_FIELD = REVIEW_FIELDS.find((field) => field.key === "b_end")!

/** The action that corresponds with the choices made for a field that is no longer in RVO. */
export function getExpiredRowAction(
  item: ReviewItem,
  ctx: ReviewFieldContext,
  choices: ReviewChoices | undefined,
): "CLOSE_LOCAL" | "KEEP_LOCAL" {
  return valuesEqual(
    END_DATE_FIELD.type,
    getEffectiveValue(END_DATE_FIELD, item, ctx, choices),
    getRemoteTarget(END_DATE_FIELD, item, ctx),
  )
    ? "CLOSE_LOCAL"
    : "KEEP_LOCAL"
}

/** The values to store as user choices when applying an action to a field that is no longer in RVO. */
export function getExpiredRowValues(
  action: "CLOSE_LOCAL" | "KEEP_LOCAL",
  item: ReviewItem,
  ctx: ReviewFieldContext,
): ReviewChoices {
  return {
    b_end:
      action === "CLOSE_LOCAL"
        ? getRemoteTarget(END_DATE_FIELD, item, ctx)
        : END_DATE_FIELD.getLocal(item),
  }
}

// ---------------------------------------------------------------------------
// Form values
// ---------------------------------------------------------------------------

/** The values submitted for a field that is added. */
export type SubmittedFieldInit = {
  b_name: string
  b_id_source: string
  b_geometry: FieldGeometry
  b_lu_catalogue: string | null
  b_start: Date | string
  b_end: Date | string | null
  b_acquiring_method: (typeof acquiringMethodOptions)[number]["value"]
  b_bufferstrip: boolean
}

export type SubmittedFieldUpdate = Partial<SubmittedFieldInit> & { b_id: string; b_lu?: string }

/**
 * Computes the values to submit for an RVO import review from the review data and the choices the
 * user made.
 */
export function buildImportFormValues(
  data: ReviewItem[],
  userChoices: ReadonlyMap<string, ReviewChoices>,
  fieldsToAdd: ReadonlySet<string>,
  fieldsToRemove: ReadonlySet<string>,
  ctx: ReviewFieldContext,
) {
  const formFieldsToAdd: SubmittedFieldInit[] = []
  const formFieldsToRemove: string[] = []
  const formFieldsToUpdate: SubmittedFieldUpdate[] = []

  for (const item of data) {
    const id = getItemId(item)
    const choices = userChoices.get(id)

    if (item.status === "NEW_LOCAL") {
      if (!item.localField) {
        console.warn("Review item with status=NEW_LOCAL but no local field.")
        continue
      }
      if (fieldsToRemove.has(id)) {
        formFieldsToRemove.push(item.localField.b_id)
        continue
      }
    }

    if (item.status === "NEW_REMOTE") {
      if (!item.rvoField) {
        console.warn("Review item with status=NEW_REMOTE but no remote field.")
        continue
      }
      // Nothing to do when the field is ignored.
      if (fieldsToAdd.has(id)) {
        const init: Record<string, unknown> = { b_id_source: item.rvoField.properties.CropFieldID }
        for (const field of REVIEW_FIELDS) {
          init[field.key] = getEffectiveValue(field, item, ctx, choices)
        }
        formFieldsToAdd.push(init as SubmittedFieldInit)
      }
      continue
    }

    // We have already warned.
    if (!item.localField || !choices) continue

    const update: Record<string, unknown> = {}
    for (const field of REVIEW_FIELDS) {
      const choice = choices[field.key]
      if (choice !== undefined && !valuesEqual(field.type, choice, field.getLocal(item))) {
        update[field.key] = choice
      }
    }

    // Add b_id_source too if it is different now.
    if (item.rvoField && item.rvoField.properties.CropFieldID !== item.localField.b_id_source) {
      update.b_id_source = item.rvoField.properties.CropFieldID
    }

    if (Object.keys(update).length > 0) {
      formFieldsToUpdate.push({
        ...(update as Partial<SubmittedFieldInit>),
        b_id: item.localField.b_id,
        b_lu: item.localCultivation?.b_lu,
      })
    }
  }

  return {
    fieldsToAdd: formFieldsToAdd,
    fieldsToRemove: formFieldsToRemove,
    fieldsToUpdate: formFieldsToUpdate,
  }
}
