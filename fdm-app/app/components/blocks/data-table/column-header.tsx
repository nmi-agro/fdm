import {
  type rowSortingFeature,
  type Column,
  type RowData,
  columnVisibilityFeature,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { cn } from "~/lib/utils"

type AssumedTableFeatures = {
  rowSortingFeature: typeof rowSortingFeature
  columnVisibilityFeature: typeof columnVisibilityFeature
}

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  className,
}: {
  title: string
  className?: string
  column: Partial<
    Pick<
      Column<AssumedTableFeatures, TData, TValue>,
      "getCanSort" | "getIsSorted" | "toggleSorting" | "getCanHide" | "toggleVisibility"
    >
  >
}) {
  if (!column.getCanSort?.()) {
    return <div className={cn(className)}>{title}</div>
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="data-[state=open]:bg-accent -ml-3 h-8">
            <span>{title}</span>
            {column.getIsSorted?.() === "desc" ? (
              <ArrowDown />
            ) : column.getIsSorted?.() === "asc" ? (
              <ArrowUp />
            ) : (
              <ChevronsUpDown />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => column.toggleSorting?.(false)}>
            <ArrowUp className="text-muted-foreground/70 h-3.5 w-3.5" />
            Oplopend
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting?.(true)}>
            <ArrowDown className="text-muted-foreground/70 h-3.5 w-3.5" />
            Aflopend
          </DropdownMenuItem>
          {column.getCanHide?.() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility?.(false)}>
                <EyeOff className="text-muted-foreground/70 h-3.5 w-3.5" />
                Verberg
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
