import { LandPlot, Sprout, Wheat } from "lucide-react"
import { useMemo, useState } from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command"
import type { AddEventContext, AddEventSheetRequest, AddEventType } from "./add-event-types"
import { findActiveCultivationForDate, type TimelineField } from "./gantt-view"

type EventTypeOption = {
  type: AddEventType
  label: string
  icon: typeof Wheat
  /** Only enabled when an active cultivation for the context's field/date can be resolved. */
  requiresCultivation?: boolean
}

const EVENT_TYPE_OPTIONS: EventTypeOption[] = [
  { type: "fertilizer", label: "Bemesting toevoegen", icon: LandPlot },
  { type: "harvest", label: "Oogst registreren", icon: Wheat, requiresCultivation: true },
  { type: "cultivation-start", label: "Gewas starten", icon: Sprout },
]

/**
 * Command menu for adding a fertilizer application or a harvest, or starting or ending a cultivation.
 * @param param0
 * @returns
 */
export function AddEventCommand({
  open,
  onOpenChange,
  context,
  fields,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Prefilled field + date, when triggered from an empty-space row click. `undefined` for the
   *  toolbar's no-context flow (field picked from the list below instead). */
  context?: AddEventContext
  fields: TimelineField[]
  onSelect: (request: AddEventSheetRequest) => void
}) {
  const [pickedField, setPickedField] = useState<TimelineField>()

  const effectiveField = context ? fields.find((field) => field.b_id === context.b_id) : pickedField
  const effectiveDate = context?.date ?? new Date()

  const activeCultivation = useMemo(() => {
    if (!effectiveField) return undefined
    return findActiveCultivationForDate(
      effectiveField.cultivations,
      effectiveDate,
      new Date(8640000000000000),
    )
  }, [effectiveField, effectiveDate])

  const reset = () => setPickedField(undefined)

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSelectType = (type: AddEventType) => {
    if (!effectiveField) return
    handleOpenChange(false)
    onSelect({
      type,
      context: { b_id: effectiveField.b_id, date: effectiveDate, b_lu: activeCultivation?.b_lu },
    } as AddEventSheetRequest)
  }

  return (
    <CommandDialog onOpenChange={handleOpenChange} open={open}>
      <CommandList>
        <CommandEmpty>Geen resultaten gevonden.</CommandEmpty>
        {effectiveField ? (
          <>
            {!context && (
              <>
                <CommandGroup heading="Perceel">
                  <CommandItem onSelect={reset} value={`wijzig-perceel-${effectiveField.b_name}`}>
                    {effectiveField.b_name} — wijzig perceel
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup heading="Type gebeurtenis">
              {EVENT_TYPE_OPTIONS.map(({ type, label, icon: Icon, requiresCultivation }) => {
                const disabled = requiresCultivation && !activeCultivation
                return (
                  <CommandItem
                    disabled={disabled}
                    key={type}
                    onSelect={() => handleSelectType(type)}
                    value={label}
                  >
                    <Icon />
                    <span>{label}</span>
                    {disabled ? (
                      <span className="text-muted-foreground ml-auto text-xs">
                        Geen actief gewas
                      </span>
                    ) : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        ) : (
          <CommandGroup heading="Percelen">
            {fields.map((field) => (
              <CommandItem
                key={field.b_id}
                onSelect={() => setPickedField(field)}
                value={field.b_name}
              >
                {field.b_name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
