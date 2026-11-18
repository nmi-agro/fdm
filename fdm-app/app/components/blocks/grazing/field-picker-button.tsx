import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

type PickableField = { b_id: string; b_name: string; b_area?: number | null }

/** The fields of a picker: the name, and the area to tell similar names apart. */
function FieldItems({
  fields,
  onPick,
}: {
  fields: PickableField[]
  onPick: (b_id: string) => void
}) {
  // Typing the first letters of a name jumps to that field
  return fields.map((field) => (
    <DropdownMenuItem
      key={field.b_id}
      onClick={() => onPick(field.b_id)}
      className="justify-between gap-4"
    >
      <span>{field.b_name}</span>
      {field.b_area != null && (
        <span className="text-muted-foreground text-xs tabular-nums">
          {field.b_area.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} ha
        </span>
      )}
    </DropdownMenuItem>
  ))
}

/**
 * One menu for the other uses of a grassland field, mowing and fertilizing, each with the field to
 * record it on. Keeps them next to "Beweiding toevoegen" without three buttons of equal weight.
 */
export function OtherUseMenu({
  fields,
  onPick,
}: {
  fields: PickableField[]
  onPick: (type: "harvest" | "fertilizer", b_id: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="gap-1.5 text-xs" />}
      >
        <span>Meer toevoegen</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Maaisnede toevoegen</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Kies een perceel</DropdownMenuLabel>
              <FieldItems fields={fields} onPick={(b_id) => onPick("harvest", b_id)} />
            </DropdownMenuGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Bemesting toevoegen</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Kies een perceel</DropdownMenuLabel>
              <FieldItems fields={fields} onPick={(b_id) => onPick("fertilizer", b_id)} />
            </DropdownMenuGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * A button that asks for the grassland field to record something on, such as a grazing, a mowing
 * or a fertilizer application. Used on the grazing calendar and the Atlas layer Beweiding, so
 * adding works the same on both.
 */
export function FieldPickerButton({
  label,
  icon,
  fields,
  onPick,
  variant = "outline",
  disabled = false,
  className,
}: {
  label: string
  /** Optional icon before the label. */
  icon?: ReactNode
  /** The fields to choose from; the area helps to tell fields with similar names apart. */
  fields: Array<{ b_id: string; b_name: string; b_area?: number | null }>
  onPick: (b_id: string) => void
  variant?: "default" | "outline"
  disabled?: boolean
  className?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={<Button variant={variant} size="sm" className={className ?? "gap-1.5 text-xs"} />}
      >
        {icon}
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Kies een perceel</DropdownMenuLabel>
          <FieldItems fields={fields} onPick={onPick} />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
