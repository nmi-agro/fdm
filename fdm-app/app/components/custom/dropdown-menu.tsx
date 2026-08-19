import { Check } from "lucide-react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { ComponentProps } from "react"
import { cn } from "@/app/lib/utils"

/**
 * Dropdown menu radio item but displays a checkmark when selected instead of a dot.
 */
export function DropdownMenuCheckedRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm transition-colors outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}
DropdownMenuCheckedRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName
