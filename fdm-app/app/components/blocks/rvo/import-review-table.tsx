import { getItemId } from "@nmi-agro/fdm-rvo/utils"
import {
  type ColumnDef,
  columnVisibilityFeature,
  FlexRender,
  type Row,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { area } from "@turf/area"
import {
  AlertCircle,
  Archive,
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  type LucideIcon,
  Minus,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { memo, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import { Input } from "~/components/ui/input"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Switch } from "~/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useKeyedState } from "~/hooks/use-keyed-state"
import { useIsMobile } from "~/hooks/use-mobile"
import { clientConfig } from "~/lib/config"
import { cn } from "~/lib/utils"
import { useActiveTableFormStore } from "~/store/active-table-form"
import {
  useRvoFieldToAdd,
  useRvoFieldToRemove,
  useRvoImportReviewStore,
  useRvoUserChoice,
  useRvoUserChoices,
} from "~/store/rvo-import-review"
import { type DifferenceCount, ImportDifferenceSummary } from "./import-review-summary"
import {
  buildImportFormValues,
  createReviewFieldContext,
  formatValue,
  getConflictRowAction,
  getDefaultValue,
  getExpiredRowAction,
  getDiffKeys,
  getExpiredRowValues,
  getImportIssues,
  getItemName,
  getRemoteTarget,
  getRowActionValues,
  getRowFields,
  type ImportReviewFlags,
  isRemoteAvailable,
  type ReviewField,
  type ReviewChoices,
  type ReviewFieldContext,
  type ReviewFieldType,
  type ReviewItem,
  type ReviewOption,
  REVIEW_FIELDS,
  summarizeImportChanges,
  valuesEqual,
  summarizeChangesAgainstRvo,
  ChangeSummaryAgainstRvo,
} from "./review-fields"

export type { ImportReviewFlags }

interface ImportReviewTableMeta {
  ctx: ReviewFieldContext
}

const importReviewTableFeatures = tableFeatures({
  columnVisibilityFeature: columnVisibilityFeature,
  tableMeta: {} as ImportReviewTableMeta,
})

interface RvoImportReviewTableProps {
  data: ReviewItem[]
  calendar: string
  flags?: ImportReviewFlags
  cultivationOptions: ReviewOption[]
  changeSummaryAgainstRvo: ChangeSummaryAgainstRvo
}

function ActionItem({
  label,
  selected,
  badge,
}: {
  label: string
  selected?: boolean
  badge?: string
}) {
  return (
    <>
      {typeof badge === "string" && (
        <Badge
          variant="outline"
          className="text-muted-foreground border-border h-5 min-w-[45px] justify-center px-1 text-xs font-normal"
        >
          {badge}
        </Badge>
      )}
      <span
        className={cn(
          "text-sm",
          typeof selected !== "undefined" &&
            !selected &&
            "decoration-muted-foreground/50 text-muted-foreground line-through",
          typeof selected !== "undefined" && selected && "font-semibold",
        )}
      >
        {label}
      </span>
    </>
  )
}

function ActionInput({
  type,
  options,
  value,
  onChange,
  setInputActive,
  label,
  autoOpen = false,
}: {
  type: ReviewFieldType
  options?: ReviewOption[]
  value: any
  onChange: (value: any) => void
  setInputActive: (active: boolean) => void
  /** Accessible name of the input, naming both the column and the field. */
  label: string
  /** Opens the option list straight away, for when the user just asked to enter a value. */
  autoOpen?: boolean
}) {
  const [selectOpen, setSelectOpen] = useKeyedState(options, () => autoOpen)
  if (type === "enum" && options) {
    return (
      <Select
        open={selectOpen}
        onOpenChange={(open) => {
          setSelectOpen(open)
          if (!open) {
            setInputActive(false)
          }
        }}
        value={typeof value === "string" ? value : ""}
        items={options}
        onValueChange={(value) => {
          onChange?.(value)
          setInputActive(false)
        }}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Kies een optie" />
        </SelectTrigger>
        <SelectContent>
          {options?.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (type === "date") {
    // The date picker has no visible label here, so the group names what the date is for.
    return (
      <div role="group" aria-label={label}>
        <DatePicker
          label={undefined}
          field={{
            onChange: onChange,
            onBlur: () => setInputActive(false),
            value: value,
            disabled: false,
            name: "date",
            ref: () => {},
          }}
          fieldState={{
            invalid: false,
            isTouched: false,
            isDirty: false,
            isValidating: false,
            error: undefined,
          }}
        />
      </div>
    )
  }

  if (type === "boolean") {
    return (
      <label className="text-muted-foreground flex flex-row items-center gap-1">
        <Checkbox
          aria-label={label}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <span className="align-top">{value ? "Ja" : "Nee"}</span>
      </label>
    )
  }

  // A geometry is always taken from FDM or RVO and is never entered by the user.
  if (type === "geometry") {
    return null
  }

  return (
    <Input
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => {
        onChange(e.currentTarget.value)
      }}
    />
  )
}

type CellCandidate = {
  action: "KEEP_LOCAL" | "UPDATE_FROM_REMOTE"
  value: unknown
  label: string
  badge?: string
}

/**
 * Renders one reviewable field of one review item: the values FDM and RVO have, and the value that
 * is going to be used.
 */
function FieldCell({
  field,
  item,
  ctx,
}: {
  field: ReviewField
  item: ReviewItem
  ctx: ReviewFieldContext
}) {
  const id = getItemId(item)
  const userChoice = useRvoUserChoice(id, field.key)
  const showCustomValueButtons = useRvoImportReviewStore((state) => state.showCustomValueButtons)
  const setUserChoice = useRvoImportReviewStore((state) => state.setUserChoice)
  const activeForm = useActiveTableFormStore((store) => store.activeForm)
  const setActiveForm = useActiveTableFormStore((store) => store.setActiveForm)
  const clearActiveForm = useActiveTableFormStore((store) => store.clearActiveForm)
  const cellId = `${id}#${field.key}`
  const inputActive = activeForm === cellId
  const setInputActive = useCallback(
    (value: boolean) => {
      if (value) {
        setActiveForm(cellId)
      } else {
        const current = useActiveTableFormStore.getState().activeForm
        if (current === cellId) {
          clearActiveForm()
        }
      }
    },
    [cellId, setActiveForm, clearActiveForm],
  )

  const options = field.getOptions?.(ctx)
  const value = userChoice !== undefined ? userChoice : getDefaultValue(field, item, ctx)
  const onChange = (next: unknown) => setUserChoice(id, field.key, next)
  const itemName = getItemName(item)
  const label = `${field.label} van ${itemName}`

  // Without RVO information the value is always edited directly.
  if (!isRemoteAvailable(field, ctx)) {
    return (
      <ActionInput
        type={field.type}
        options={options}
        value={value}
        onChange={onChange}
        setInputActive={setInputActive}
        label={label}
      />
    )
  }

  const candidates: CellCandidate[] = []
  if (item.status === "NEW_REMOTE") {
    candidates.push({
      action: "UPDATE_FROM_REMOTE",
      value: getDefaultValue(field, item, ctx),
      label:
        field.formatRemote?.(item) ??
        formatValue(field.type, getDefaultValue(field, item, ctx), options),
    })
  } else {
    const local = field.getLocal(item)
    candidates.push({
      action: "KEEP_LOCAL",
      value: local,
      label: field.formatLocal?.(item) ?? formatValue(field.type, local, options),
    })

    if (item.status === "CONFLICT" || item.status === "EXPIRED_LOCAL") {
      const target = getRemoteTarget(field, item, ctx)
      if (!valuesEqual(field.type, target, local)) {
        candidates.push({
          action: "UPDATE_FROM_REMOTE",
          value: target,
          label: field.formatRemote?.(item) ?? formatValue(field.type, target, options),
        })
      }
    }

    if (item.status === "CONFLICT" && candidates.length > 1) {
      candidates[0].badge = clientConfig.name
      candidates[1].badge = "RVO"
    } else if (item.status === "EXPIRED_LOCAL" && candidates.length > 1) {
      candidates[0].badge = "Huidig"
      candidates[1].badge = "Afsluiten"
    }
  }

  // Prefer the remote candidate, which comes last, when both are the same.
  const matched = [...candidates].reverse().find((c) => valuesEqual(field.type, value, c.value))
  const action = matched?.action ?? "CUSTOM"
  const showInput = inputActive || action === "CUSTOM"
  const showRadio = showInput || candidates.length > 1

  const inputItem = showInput ? (
    <ActionInput
      type={field.type}
      options={options}
      value={value}
      onChange={onChange}
      setInputActive={setInputActive}
      label={label}
      autoOpen={inputActive}
    />
  ) : null

  const editButton = (
    <div>
      {showCustomValueButtons && field.allowCustomValue && !showInput && (
        <Button
          variant="ghost"
          size="icon"
          // Shown only on the row the user works on, or always on touch screens without hover, so
          // a long table is not covered in edit buttons. A focused button is always visible.
          className="size-8 opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          title="Zelf een waarde invullen"
          aria-label={`${label}: zelf een waarde invullen`}
          onClick={() => setInputActive(true)}
        >
          <Pencil />
        </Button>
      )}
    </div>
  )

  if (showRadio) {
    return (
      <div className="flex flex-row items-start gap-1">
        <RadioGroup
          aria-label={label}
          className="flex flex-col gap-1.5"
          value={action}
          onValueChange={(next) => {
            const candidate = candidates.find((c) => c.action === next)
            if (candidate) {
              onChange(candidate.value)
            }
          }}
        >
          {candidates.map((candidate) => {
            const isSelected = candidate.action === action
            return (
              <label key={candidate.action} className="flex items-center gap-1.5">
                <RadioGroupItem value={candidate.action} />
                <ActionItem
                  label={candidate.label}
                  badge={candidate.badge}
                  selected={candidates.length > 1 ? isSelected : isSelected ? undefined : false}
                />
              </label>
            )
          })}
          {inputItem && (
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="CUSTOM" aria-label="Eigen waarde" />
              {inputItem}
            </div>
          )}
        </RadioGroup>
        {editButton}
      </div>
    )
  }

  return (
    <div className="flex flex-row items-start gap-1">
      <div>
        {candidates.map((candidate) => (
          <div key={candidate.action} className="flex items-center">
            <ActionItem label={candidate.label} badge={candidate.badge} />
          </div>
        ))}
      </div>
      {editButton}
    </div>
  )
}

/**
 * Renders the select with which the user picks what happens with a review item.
 */
function ActionsCell({ item, ctx }: { item: ReviewItem; ctx: ReviewFieldContext }) {
  const id = getItemId(item)
  const actionLabel = `Actie voor ${getItemName(item)}`

  const userChoices = useRvoUserChoices(id)
  const setUserChoices = useRvoImportReviewStore((state) => state.setUserChoices)
  const field_to_remove = useRvoFieldToRemove(id)
  const setFieldToRemove = useRvoImportReviewStore((state) => state.setFieldToRemove)
  const field_to_add = useRvoFieldToAdd(id)
  const setFieldToAdd = useRvoImportReviewStore((state) => state.setFieldToAdd)

  if (item.status === "MATCH") {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Check className="h-4 w-4" />
        <span>Geen actie nodig</span>
      </div>
    )
  }

  if (item.status === "CONFLICT") {
    const action = getConflictRowAction(item, ctx, userChoices)
    return (
      <Select
        value={action}
        items={[
          {
            value: "UPDATE_FROM_REMOTE",
            label: "Gebruik RVO",
          },
          {
            value: "KEEP_LOCAL",
            label: `Gebruik ${clientConfig.name}`,
          },
          {
            value: "CUSTOM",
            label: "Aangepast",
          },
        ]}
        onValueChange={(val) => {
          if (val === "KEEP_LOCAL" || val === "UPDATE_FROM_REMOTE") {
            setUserChoices(id, getRowActionValues(val, item, ctx))
          }
        }}
      >
        <SelectTrigger aria-label={actionLabel} className="z-10 h-8 w-[180px] text-xs">
          <SelectValue placeholder="Kies actie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="UPDATE_FROM_REMOTE">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-3 w-3" /> Gebruik RVO
            </div>
          </SelectItem>
          <SelectItem value="KEEP_LOCAL">
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3" /> Gebruik {clientConfig.name}
            </div>
          </SelectItem>
          {action === "CUSTOM" && (
            <SelectItem value="CUSTOM" disabled>
              <div className="flex items-center gap-2">
                <Pencil className="h-3 w-3" /> Aangepast
              </div>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    )
  }

  if (item.status === "NEW_REMOTE") {
    return (
      <Select
        value={field_to_add ? "ADD_REMOTE" : "IGNORE"}
        items={[
          { value: "ADD_REMOTE", label: "Toevoegen" },
          { value: "IGNORE", label: "Negeren" },
        ]}
        onValueChange={(val) => {
          setFieldToAdd(id, val === "ADD_REMOTE")
        }}
      >
        <SelectTrigger aria-label={actionLabel} className="z-10 h-8 w-[180px] text-xs">
          <SelectValue placeholder="Kies actie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ADD_REMOTE">
            <div className="flex items-center gap-2">
              <Plus className="h-3 w-3" /> Toevoegen
            </div>
          </SelectItem>
          <SelectItem value="IGNORE">
            <div className="text-muted-foreground flex items-center gap-2">
              <X className="h-3 w-3" /> Negeren
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    )
  }

  if (item.status === "NEW_LOCAL") {
    return (
      <Select
        value={field_to_remove ? "REMOVE_LOCAL" : "KEEP_LOCAL"}
        items={[
          { value: "REMOVE_LOCAL", label: "Verwijderen" },
          { value: "KEEP_LOCAL", label: "Behouden" },
        ]}
        onValueChange={(val) => {
          setFieldToRemove(id, val === "REMOVE_LOCAL")
        }}
      >
        <SelectTrigger aria-label={actionLabel} className="z-10 h-8 w-[180px] text-xs">
          <SelectValue placeholder="Kies actie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="REMOVE_LOCAL">
            <div className="text-destructive flex items-center gap-2">
              <Trash2 className="h-3 w-3" /> Verwijderen
            </div>
          </SelectItem>
          <SelectItem value="KEEP_LOCAL">
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3" /> Behouden
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    )
  }

  if (item.status === "EXPIRED_LOCAL") {
    return (
      <Select
        value={getExpiredRowAction(item, ctx, userChoices)}
        onValueChange={(val) => {
          if (val === "CLOSE_LOCAL" || val === "KEEP_LOCAL") {
            setUserChoices(id, getExpiredRowValues(val, item, ctx))
          }
        }}
      >
        <SelectTrigger aria-label={actionLabel} className="z-10 h-8 w-[180px] text-xs">
          <SelectValue placeholder="Kies actie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="CLOSE_LOCAL">
            <div className="flex items-center gap-2">
              <Archive className="h-3 w-3" /> Afsluiten
            </div>
          </SelectItem>
          <SelectItem value="KEEP_LOCAL">
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3" /> Behouden
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    )
  }

  return null
}

/**
 * Label, explanation and icon of each review status, in the order in which the table lists them.
 * Statuses whose default action changes the
 * farm's data get a filled badge; the others stay neutral. The icon repeats the meaning, so it does
 * not depend on color alone.
 */
const STATUS_INFO: Record<
  ReviewItem["status"],
  {
    label: string
    /** Follows a count in the difference summary, e.g. "4 met verschillen". */
    summaryLabel: string
    description: string
    icon: LucideIcon
    changesData: boolean
  }
> = {
  CONFLICT: {
    label: "Verschil",
    summaryLabel: "met verschillen",
    description: `Het perceel staat in ${clientConfig.name} en bij RVO, maar de gegevens verschillen. Kies per kolom welke waarde u wilt gebruiken.`,
    icon: ArrowLeftRight,
    changesData: true,
  },
  NEW_REMOTE: {
    label: "Alleen bij RVO",
    summaryLabel: "alleen bij RVO",
    description: `Het perceel staat bij RVO, maar nog niet in ${clientConfig.name}. Het wordt toegevoegd, tenzij u kiest voor Negeren.`,
    icon: Plus,
    changesData: true,
  },
  EXPIRED_LOCAL: {
    label: "Niet meer bij RVO",
    summaryLabel: "niet meer bij RVO",
    description: `Het perceel is in ${clientConfig.name} nog in gebruik, maar staat dit jaar niet meer bij RVO. Het wordt afgesloten op de getoonde einddatum, tenzij u kiest voor Behouden.`,
    icon: Archive,
    changesData: true,
  },
  NEW_LOCAL: {
    label: `Alleen in ${clientConfig.name}`,
    summaryLabel: `alleen in ${clientConfig.name}`,
    description: `Het perceel staat in ${clientConfig.name}, maar niet bij RVO. Het blijft behouden, tenzij u kiest voor Verwijderen.`,
    icon: Minus,
    changesData: false,
  },
  MATCH: {
    label: "Gelijk",
    summaryLabel: "gelijk",
    description: `Het perceel komt in ${clientConfig.name} en bij RVO volledig overeen.`,
    icon: Check,
    changesData: false,
  },
}

/**
 * The order of the statuses in the table, which follows {@link STATUS_INFO}: the fields that need a
 * decision come first.
 */
const STATUS_ORDER = Object.keys(STATUS_INFO) as ReviewItem["status"][]

/** Counts the review items per status and, for items that differ, the columns that differ. */
function countDifferences(
  data: ReviewItem[],
  ctx: ReviewFieldContext,
): { statusCounts: DifferenceCount[]; columnCounts: DifferenceCount[] } {
  const statusCounts = STATUS_ORDER.map((status) => ({
    key: status,
    count: data.filter((item) => item.status === status).length,
    label: STATUS_INFO[status].summaryLabel,
    icon: STATUS_INFO[status].icon,
  }))
  const columnCounts = getRowFields(ctx)
    .map((field) => ({
      key: field.key,
      count: data.filter((item) => item.status === "CONFLICT" && getDiffKeys(item).has(field.key))
        .length,
      label: field.label,
    }))
    .filter((column) => column.count > 0)
    .sort((a, b) => b.count - a.count)
  return { statusCounts, columnCounts }
}

const statusColumn: ColumnDef<typeof importReviewTableFeatures, ReviewItem> = {
  accessorKey: "status",
  // The header explains every status, so keyboard users reach all explanations with a single tab
  // stop instead of one per row.
  header: () => (
    <Tooltip>
      <TooltipTrigger className="flex flex-row items-center gap-1">
        Status
        <Info className="h-4 w-4" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>
        <dl className="max-w-80 space-y-1.5">
          {Object.values(STATUS_INFO).map((info) => (
            <div key={info.label}>
              <dt className="font-medium">{info.label}</dt>
              <dd>{info.description}</dd>
            </div>
          ))}
        </dl>
      </TooltipContent>
    </Tooltip>
  ),
  cell: ({ row }) => {
    const status = row.original.status
    const info = STATUS_INFO[status]
    if (!info) return <Badge variant="secondary">{status}</Badge>
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge
              variant={info.changesData ? "secondary" : "outline"}
              className={cn("gap-1", !info.changesData && "text-muted-foreground")}
            >
              <info.icon className="size-3" aria-hidden="true" />
              {info.label}
            </Badge>
          }
        />
        <TooltipContent>
          <div className="max-w-75">{info.description}</div>
        </TooltipContent>
      </Tooltip>
    )
  },
}

/** Creates the table column for a field of the registry. */
function createFieldColumn(
  field: ReviewField,
): ColumnDef<typeof importReviewTableFeatures, ReviewItem> {
  return {
    id: field.columnId,
    header: ({ table }) => {
      const { ctx } = table.options.meta!
      if (!isRemoteAvailable(field, ctx) && field.unavailableDescription) {
        return (
          <Tooltip>
            <TooltipTrigger className="flex flex-row items-center gap-1">
              {field.label}
              <Info className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>
              <div className="max-w-75 text-center">{field.unavailableDescription}</div>
            </TooltipContent>
          </Tooltip>
        )
      }
      return (
        <Tooltip>
          <TooltipTrigger>{field.label}</TooltipTrigger>
          <TooltipContent>{field.description}</TooltipContent>
        </Tooltip>
      )
    },
    cell: ({ row, table }) => (
      <FieldCell field={field} item={row.original} ctx={table.options.meta!.ctx} />
    ),
  }
}

const actionsColumn: ColumnDef<typeof importReviewTableFeatures, ReviewItem> = {
  id: "actions",
  header: () => (
    <Tooltip>
      <TooltipTrigger>Actie</TooltipTrigger>
      <TooltipContent>Kies wat er met het perceel gebeurt.</TooltipContent>
    </Tooltip>
  ),
  cell: ({ row, table }) => <ActionsCell item={row.original} ctx={table.options.meta!.ctx} />,
}

export const columns: ColumnDef<typeof importReviewTableFeatures, ReviewItem>[] = [
  statusColumn,
  ...REVIEW_FIELDS.map(createFieldColumn),
  actionsColumn,
]

/**
 * Shows a "show custom value buttons" toggle for the RVO import review table.
 */
export function CustomValueButtonsToggle() {
  const showCustomValueButtons = useRvoImportReviewStore((state) => state.showCustomValueButtons)
  const setShowCustomValueButtons = useRvoImportReviewStore(
    (state) => state.setShowCustomValueButtons,
  )
  const isMobile = useIsMobile()
  const switchId = useId()
  const descriptionId = useId()

  return isMobile ? null : (
    <Tooltip>
      <TooltipTrigger
        render={
          <label htmlFor={switchId} className="flex items-center gap-2 self-center text-sm">
            <Switch
              id={switchId}
              aria-describedby={descriptionId}
              checked={showCustomValueButtons}
              onCheckedChange={setShowCustomValueButtons}
            />
            Waarden zelf aanpassen
            <span id={descriptionId} className="sr-only">
              Toont bij elke waarde een knop waarmee u zelf een waarde invult.
            </span>
          </label>
        }
      />
      <TooltipContent>
        Toont bij elke waarde een knop waarmee u zelf een waarde invult.
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Computes the form values to submit for an RVO import review, reactively reading the user's
 * choices from {@link useRvoImportReviewStore}.
 *
 * @param data The review items shown in the table.
 * @param settings The same `calendar` and `flags` that are passed to {@link RvoImportReviewTable}.
 * @returns The form values to submit, a summary of the changes by kind, and the problems that
 *   have to be solved before the review can be submitted.
 */
export function useRvoImportForm(
  data: ReviewItem[],
  { calendar, flags }: { calendar: string; flags?: ImportReviewFlags },
) {
  const userChoices = useRvoImportReviewStore((state) => state.userChoices)
  const fieldsToAdd = useRvoImportReviewStore((state) => state.fieldsToAdd)
  const fieldsToRemove = useRvoImportReviewStore((state) => state.fieldsToRemove)
  const bufferstripInfoAvailable = flags?.b_bufferstrip_info_available

  return useMemo(() => {
    const ctx = createReviewFieldContext({
      calendar,
      flags: { b_bufferstrip_info_available: bufferstripInfoAvailable },
    })
    const formValues = buildImportFormValues(data, userChoices, fieldsToAdd, fieldsToRemove, ctx)
    return {
      formValues,
      summary: summarizeImportChanges(data, formValues),
      changeSummaryAgainstRvo: summarizeChangesAgainstRvo(data, formValues, ctx),
      issues: getImportIssues(data, userChoices, fieldsToAdd, fieldsToRemove, ctx),
    }
  }, [data, userChoices, fieldsToAdd, fieldsToRemove, calendar, bufferstripInfoAvailable])
}

/**
 * Renders one row of the review table. Fields that will be ignored are dimmed, and a problem with
 * the chosen values is shown below the status, so the user can find the row that blocks saving.
 */
function ReviewRow({
  row,
  ctx,
}: {
  row: Row<typeof importReviewTableFeatures, ReviewItem>
  ctx: ReviewFieldContext
}) {
  const item = row.original
  const id = getItemId(item)
  const choices = useRvoUserChoices(id)
  const fieldToAdd = useRvoFieldToAdd(id)
  const fieldToRemove = useRvoFieldToRemove(id)

  const isIgnored = item.status === "NEW_REMOTE" && !fieldToAdd
  const issues = useMemo(
    () =>
      getImportIssues(
        [item],
        choices ? new Map([[id, choices]]) : new Map(),
        fieldToAdd ? new Set([id]) : new Set(),
        fieldToRemove ? new Set([id]) : new Set(),
        ctx,
      ),
    [item, id, choices, fieldToAdd, fieldToRemove, ctx],
  )

  return (
    <TableRow
      className={cn(
        "group/row",
        isIgnored && "[&>td:not(:last-child)]:opacity-50",
        issues.length > 0 && "bg-destructive/5 hover:bg-destructive/10",
      )}
    >
      {row.getVisibleCells().map((cell, index) => (
        <TableCell key={cell.id} className="align-top">
          <FlexRender cell={cell} />
          {index === 0 &&
            issues.map((issue) => (
              <p
                key={issue.message}
                className="text-destructive mt-1.5 flex max-w-40 items-start gap-1 text-xs"
              >
                <AlertCircle className="mt-px size-3 shrink-0" aria-hidden="true" />
                {issue.message}
              </p>
            ))}
        </TableCell>
      ))}
    </TableRow>
  )
}

/**
 * Renders the RVO import review table.
 *
 * The user choice state is driven by {@link useRvoImportReviewStore} which is a
 * Zustand store.
 */
function RvoImportReviewTableComponent({
  data,
  calendar,
  flags,
  cultivationOptions,
  changeSummaryAgainstRvo,
}: RvoImportReviewTableProps) {
  const clearActiveForm = useActiveTableFormStore((store) => store.clearActiveForm)

  const setShowCustomValueButtons = useRvoImportReviewStore(
    (state) => state.setShowCustomValueButtons,
  )
  const isMobile = useIsMobile()
  useLayoutEffect(() => {
    if (isMobile) {
      setShowCustomValueButtons(true)
    }
  }, [isMobile, setShowCustomValueButtons])

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      if (byStatus !== 0) return byStatus
      const getArea = (item: typeof a): number | null => {
        if (item.rvoField?.geometry) {
          return area(item.rvoField.geometry) / 10000
        }
        const localArea = item.localField?.b_area
        if (Number.isFinite(localArea)) {
          return localArea as number
        }
        return null
      }
      const areaA = getArea(a)
      const areaB = getArea(b)
      if (areaA === null && areaB === null) return 0
      if (areaA === null) return 1
      if (areaB === null) return -1
      return areaB - areaA
    })
  }, [data])

  const bufferstripInfoAvailable = flags?.b_bufferstrip_info_available
  const ctx = useMemo(
    () =>
      createReviewFieldContext({
        calendar,
        flags: { b_bufferstrip_info_available: bufferstripInfoAvailable },
        cultivationOptions,
      }),
    [calendar, bufferstripInfoAvailable, cultivationOptions],
  )

  // Keep the latest context in a ref so that the reset below only runs when the data changes.
  // Loaders revalidate after a failed action, which gives `ctx` a new identity (new
  // `cultivationOptions`); resetting then would discard the user's choices.
  const ctxRef = useRef(ctx)
  useLayoutEffect(() => {
    ctxRef.current = ctx
  })

  // Every field starts out following RVO: conflicting fields take the RVO values, expired fields
  // are closed, fields that are new at RVO are added and fields RVO does not report are removed.
  useLayoutEffect(() => {
    clearActiveForm()
    const ctx = ctxRef.current
    const initialChoices = new Map<string, ReviewChoices>()
    const initialFieldsToAdd: string[] = []
    const initialFieldsToRemove: string[] = []
    for (const item of data) {
      if (item.status === "CONFLICT") {
        initialChoices.set(getItemId(item), getRowActionValues("UPDATE_FROM_REMOTE", item, ctx))
      } else if (item.status === "EXPIRED_LOCAL") {
        initialChoices.set(getItemId(item), getExpiredRowValues("CLOSE_LOCAL", item, ctx))
      } else if (item.status === "NEW_REMOTE") {
        initialFieldsToAdd.push(getItemId(item))
      } else if (item.status === "NEW_LOCAL") {
        initialFieldsToRemove.push(getItemId(item))
      }
    }
    useRvoImportReviewStore
      .getState()
      .reset(initialChoices, initialFieldsToAdd, initialFieldsToRemove)
  }, [data, clearActiveForm])

  // Fields that match RVO need no decision, so they are collapsed until the user asks for them.
  const [showMatches, setShowMatches] = useState(false)
  const matchCount = useMemo(() => data.filter((item) => item.status === "MATCH").length, [data])
  const visibleData = useMemo(
    () => (showMatches ? sortedData : sortedData.filter((item) => item.status !== "MATCH")),
    [sortedData, showMatches],
  )
  const differences = useMemo(() => countDifferences(data, ctx), [data, ctx])

  const table = useTable({
    data: visibleData,
    features: importReviewTableFeatures,
    columns,
    meta: { ctx },
  })

  const allRows = table.getRowModel().rows
  const rows = allRows.filter((row) => row.original.status !== "MATCH")
  const matchRows = allRows.filter((row) => row.original.status === "MATCH")
  const toggleMatches = () => setShowMatches((show) => !show)

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <ImportDifferenceSummary
          statusCounts={differences.statusCounts}
          columnCounts={differences.columnCounts}
          changeSummaryAgainstRvo={changeSummaryAgainstRvo}
          matches={{ expanded: showMatches, onToggle: toggleMatches }}
        />
        <div className="bg-card rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        <FlexRender header={header} />
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length > 0 ? (
                rows.map((row) => <ReviewRow key={row.id} row={row} ctx={ctx} />)
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {matchCount > 0
                      ? "Alle percelen komen overeen met RVO. Er hoeft niets te worden aangepast."
                      : "Er zijn geen percelen om te beoordelen."}
                  </TableCell>
                </TableRow>
              )}
              {/* The toggle opens the group of matching fields, so it stays right above them. */}
              {matchCount > 0 && (
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={columns.length} className="py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={showMatches}
                      onClick={toggleMatches}
                    >
                      {showMatches ? (
                        <ChevronUp aria-hidden="true" />
                      ) : (
                        <ChevronDown aria-hidden="true" />
                      )}
                      {showMatches
                        ? "Verberg de percelen die gelijk zijn aan RVO"
                        : matchCount === 1
                          ? "Toon 1 perceel dat gelijk is aan RVO"
                          : `Toon ${matchCount} percelen die gelijk zijn aan RVO`}
                    </Button>
                  </TableCell>
                </TableRow>
              )}
              {matchRows.map((row) => (
                <ReviewRow key={row.id} row={row} ctx={ctx} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  )
}

export const RvoImportReviewTable = memo(RvoImportReviewTableComponent)
