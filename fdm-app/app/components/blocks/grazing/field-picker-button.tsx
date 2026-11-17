import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

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
  icon: ReactNode
  fields: Array<{ b_id: string; b_name: string }>
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
          {fields.map((field) => (
            <DropdownMenuItem key={field.b_id} onClick={() => onPick(field.b_id)}>
              {field.b_name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
