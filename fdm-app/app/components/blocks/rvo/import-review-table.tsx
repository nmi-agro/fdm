import { getItemId } from "@nmi-agro/fdm-rvo/utils"
import {
  type ColumnDef,
  columnVisibilityFeature,
  FlexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { area } from "@turf/area"
import { Archive, ArrowLeftRight, Check, Info, Pencil, Plus, Trash2, X } from "lucide-react"
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
import {
  buildImportFormValues,
  createReviewFieldContext,
  formatValue,
  getConflictRowAction,
  getDefaultValue,
  getExpiredRowAction,
  getExpiredRowValues,
  getRemoteTarget,
  getRowActionValues,
  type ImportReviewFlags,
  isRemoteAvailable,
  type ReviewField,
  type ReviewChoices,
  type ReviewFieldContext,
  type ReviewFieldType,
  type ReviewItem,
  type ReviewOption,
  REVIEW_FIELDS,
  valuesEqual,
} from "./review-fields"

export type { ImportReviewFlags }

interface ImportReviewTableMeta {
  canModify: boolean
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
          className="text-muted-foreground border-border h-5 min-w-[45px] justify-center px-1 text-[10px]"
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
          typeof selected !== "undefined" && selected && "font-bold",
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
}: {
  type: ReviewFieldType
  options?: ReviewOption[]
  value: any
  onChange: (value: any) => void
  setInputActive: (active: boolean) => void
}) {
  const [selectOpen, setSelectOpen] = useKeyedState(options, () => true)
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
        onValueChange={(value) => {
          onChange?.(value)
          setInputActive(false)
        }}
      >
        <SelectTrigger>
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
    return (
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
    )
  }

  if (type === "boolean") {
    return (
      <label className="text-muted-foreground flex flex-row items-center gap-1">
        <Checkbox
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <span className="align-top">{value ? "Ja" : "Nee"}</span>
      </label>
    )
  }

  if (type === "geometry") {
    return "niet geïmplementeerd"
  }

  return (
    <Input
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

  // Without RVO information the value is always edited directly.
  if (!isRemoteAvailable(field, ctx)) {
    return (
      <ActionInput
        type={field.type}
        options={options}
        value={value}
        onChange={onChange}
        setInputActive={setInputActive}
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
    />
  ) : null

  const editButton = (
    <div>
      {showCustomValueButtons && field.allowCustomValue && !showInput && (
        <Button
          variant="ghost"
          className={"size-auto has-[>svg]:p-1"}
          title="Aanpassen..."
          onClick={() => setInputActive(true)}
        >
          <Pencil />
        </Button>
      )}
    </div>
  )

  if (showRadio) {
    return (
      <div className="group flex flex-row items-start gap-1">
        <RadioGroup
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
              <label key={candidate.action} className="flex items-center">
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
            <div className="flex items-center">
              <RadioGroupItem value="CUSTOM" />
              {inputItem}
            </div>
          )}
        </RadioGroup>
        {editButton}
      </div>
    )
  }

  return (
    <div className="group flex flex-row items-start gap-1">
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

  const userChoices = useRvoUserChoices(id)
  const setUserChoices = useRvoImportReviewStore((state) => state.setUserChoices)
  const field_to_remove = useRvoFieldToRemove(id)
  const setFieldToRemove = useRvoImportReviewStore((state) => state.setFieldToRemove)
  const field_to_add = useRvoFieldToAdd(id)
  const setFieldToAdd = useRvoImportReviewStore((state) => state.setFieldToAdd)

  if (item.status === "MATCH") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check className="h-4 w-4" />
        <span>Aanwezig</span>
      </div>
    )
  }

  if (item.status === "CONFLICT") {
    const action = getConflictRowAction(item, ctx, userChoices)

    return (
      <Select
        value={action}
        onValueChange={(val) => {
          if (val === "KEEP_LOCAL" || val === "UPDATE_FROM_REMOTE") {
            setUserChoices(id, getRowActionValues(val, item, ctx))
          }
        }}
      >
        <SelectTrigger className="z-10 h-8 w-[180px] text-xs">
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
        onValueChange={(val) => {
          setFieldToAdd(id, val === "ADD_REMOTE")
        }}
      >
        <SelectTrigger className="z-10 h-8 w-[180px] text-xs">
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
        onValueChange={(val) => {
          setFieldToRemove(id, val === "REMOVE_LOCAL")
        }}
      >
        <SelectTrigger className="z-10 h-8 w-[180px] text-xs">
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
        <SelectTrigger className="z-10 h-8 w-[180px] text-xs">
          <SelectValue placeholder="Kies actie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="CLOSE_LOCAL">
            <div className="flex items-center gap-2 text-orange-700">
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

const statusColumn: ColumnDef<typeof importReviewTableFeatures, ReviewItem> = {
  accessorKey: "status",
  header: () => (
    <Tooltip>
      <TooltipTrigger>Status</TooltipTrigger>
      <TooltipContent>
        Geeft de vergelijkingsstatus weer tussen {clientConfig.name} en RVO.
      </TooltipContent>
    </Tooltip>
  ),
  cell: ({ row }) => {
    const status = row.getValue("status") as string
    switch (status) {
      case "MATCH":
        return (
          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
            <Tooltip>
              <TooltipTrigger>Gelijk</TooltipTrigger>
              <TooltipContent>
                Perceel komt in {clientConfig.name} en bij RVO volledig overeen.
              </TooltipContent>
            </Tooltip>
          </Badge>
        )
      case "NEW_REMOTE":
        return (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            <Tooltip>
              <TooltipTrigger>Nieuw (RVO)</TooltipTrigger>
              <TooltipContent>
                Perceel bestaat bij RVO, maar niet in {clientConfig.name}.
              </TooltipContent>
            </Tooltip>
          </Badge>
        )
      case "NEW_LOCAL":
        return (
          <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700">
            <Tooltip>
              <TooltipTrigger>Nieuw ({clientConfig.name})</TooltipTrigger>
              <TooltipContent>
                Perceel bestaat in {clientConfig.name}, maar niet bij RVO.
              </TooltipContent>
            </Tooltip>
          </Badge>
        )
      case "EXPIRED_LOCAL":
        return (
          <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
            <Tooltip>
              <TooltipTrigger>Niet meer actief</TooltipTrigger>
              <TooltipContent>
                Perceel is in {clientConfig.name} nog actief, maar komt niet meer voor bij RVO.
              </TooltipContent>
            </Tooltip>
          </Badge>
        )
      case "CONFLICT":
        return (
          <Badge variant="destructive" className="border-red-200 bg-red-50 text-red-700">
            <Tooltip>
              <TooltipTrigger>Verschil</TooltipTrigger>
              <TooltipContent>
                Perceel bestaat in beide, maar met verschillende gegevens.
              </TooltipContent>
            </Tooltip>
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
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
      <TooltipContent>Kies welke actie moet worden uitgevoerd voor dit perceel.</TooltipContent>
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
      <TooltipTrigger asChild>
        <label htmlFor={switchId} className="flex items-center gap-2 self-center text-sm">
          <Switch
            id={switchId}
            aria-describedby={descriptionId}
            checked={showCustomValueButtons}
            onCheckedChange={setShowCustomValueButtons}
          />
          Aanpasknopjes tonen
          <span id={descriptionId} className="sr-only">
            Hiermee kun je voor elke kolom een aangepaste waarde toevoegen.
          </span>
        </label>
      </TooltipTrigger>
      <TooltipContent>
        {showCustomValueButtons
          ? "Klik om de potloodknopjes te verbergen."
          : "Hiermee kun je voor elke kolom een aangepaste waarde toevoegen."}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Works like setState, however only allows a next value argument, and resets the state whenever
 * `key` changes.
 *
 * Here it is used to reset the user choices when the table data changes.
 *
 * @param key Key used to decide when to reset the state.
 * @param initial Function to compute the state reset value.
 * @returns a tuple of the current state, and a setter function.
 */
export function useKeyedState<K, V>(
  key: K,
  initial: (key: K) => V,
): [V, (next: V | ((prev: V) => V)) => void] {
  const [stored, setStored] = useState<{ key: K; value: V } | null>(null)
  const value = stored !== null && Object.is(stored.key, key) ? stored.value : initial(key)

  const latestRef = useRef({ key, initial })
  useLayoutEffect(() => {
    latestRef.current = { key, initial }
  })

  const setValue = useCallback((next: V | ((prev: V) => V)) => {
    setStored((prev) => {
      const { key, initial } = latestRef.current
      const current = prev !== null && Object.is(prev.key, key) ? prev.value : initial(key)
      return { key, value: typeof next === "function" ? (next as (prev: V) => V)(current) : next }
    })
  }, [])

  return [value, setValue]
}

/**
 * Computes the form values to submit for an RVO import review, reactively reading the user's
 * choices from {@link useRvoImportReviewStore}.
 *
 * @param data The review items shown in the table.
 * @param settings The same `calendar` and `flags` that are passed to {@link RvoImportReviewTable}.
 */
export function useRvoImportForm(
  data: ReviewItem[],
  { calendar, flags }: { calendar: string; flags?: ImportReviewFlags },
) {
  const userChoices = useRvoImportReviewStore((state) => state.userChoices)
  const fieldsToAdd = useRvoImportReviewStore((state) => state.fieldsToAdd)
  const fieldsToRemove = useRvoImportReviewStore((state) => state.fieldsToRemove)
  const bufferstripInfoAvailable = flags?.b_bufferstrip_info_available

  const formValues = useMemo(
    () =>
      buildImportFormValues(
        data,
        userChoices,
        fieldsToAdd,
        fieldsToRemove,
        createReviewFieldContext({
          calendar,
          flags: { b_bufferstrip_info_available: bufferstripInfoAvailable },
        }),
      ),
    [data, userChoices, fieldsToAdd, fieldsToRemove, calendar, bufferstripInfoAvailable],
  )

  return { formValues }
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

  // Conflicting and expired fields start out with the RVO values selected.
  useLayoutEffect(() => {
    clearActiveForm()
    const initialChoices = new Map<string, ReviewChoices>()
    for (const item of data) {
      if (item.status === "CONFLICT") {
        initialChoices.set(getItemId(item), getRowActionValues("UPDATE_FROM_REMOTE", item, ctx))
      } else if (item.status === "EXPIRED_LOCAL") {
        initialChoices.set(getItemId(item), getExpiredRowValues("CLOSE_LOCAL", item, ctx))
      }
    }
    useRvoImportReviewStore.getState().reset(initialChoices)
  }, [data, ctx, clearActiveForm])

  const table = useTable({
    data: sortedData,
    features: importReviewTableFeatures,
    columns,
    meta: {
      canModify: true,
      ctx,
    },
  })

  return (
    <TooltipProvider>
      <div className="rounded-md border bg-white">
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Geen resultaten.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}

export const RvoImportReviewTable = memo(RvoImportReviewTableComponent)
