import { Plus } from "lucide-react"
import { NavLink } from "react-router"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Button } from "~/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"

/**
 * Dialog that lets the user pick a field within a specific farm, then hands the chosen
 * field back to the caller so it can navigate straight to that field's page.
 *
 * Used after a farm has been picked via FarmPickerDialog for sidebar items that need a
 * concrete field (e.g. "Kies een perceel") rather than the fields overview page.
 */
export function FieldPickerDialog({
  open,
  onOpenChange,
  farmName,
  loading,
  fields,
  createFieldLink,
  onSelectField,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  farmName: string
  loading: boolean
  fields: {
    b_id: string
    b_name: string
    b_area: number
    b_lu_name?: string
    b_lu_croprotation?: string
  }[]
  createFieldLink: string
  onSelectField: (b_id: string) => void
}) {
  const sortedFields = [...fields].sort(
    (a, b) => (b.b_area ?? 0) - (a.b_area ?? 0) || a.b_name.localeCompare(b.b_name),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Kies een perceel</DialogTitle>
          <DialogDescription>
            {loading
              ? `Percelen van ${farmName} worden geladen...`
              : fields.length > 0
                ? `Selecteer een perceel van ${farmName}.`
                : `${farmName} heeft nog geen percelen. Maak een perceel aan om verder te gaan.`}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="text-muted-foreground p-6 pt-2 text-sm">Even geduld...</div>
        ) : fields.length > 0 ? (
          <TooltipProvider>
            <Command>
              <CommandInput
                placeholder="Zoek perceel..."
                className="border-none focus:ring-0 focus-visible:ring-0"
              />
              <CommandList className="max-h-[300px] overflow-y-auto p-2">
                <CommandEmpty>Geen percelen gevonden.</CommandEmpty>
                <CommandGroup heading="Percelen">
                  {sortedFields.map((field) => {
                    const content = (
                      <div className="flex w-full min-w-0 items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {field.b_lu_name ? (
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor: getCultivationColor(field.b_lu_croprotation),
                              }}
                            />
                          ) : null}
                          <span className="truncate">{field.b_name}</span>
                        </div>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {field.b_area} ha
                        </span>
                      </div>
                    )

                    return (
                      <CommandItem
                        key={field.b_id}
                        value={`${field.b_name} ${field.b_id}`}
                        onSelect={() => onSelectField(field.b_id)}
                        className="flex cursor-pointer items-center justify-between"
                      >
                        {field.b_lu_name ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{content}</TooltipTrigger>
                            <TooltipContent side="top">
                              <p>{field.b_lu_name}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          content
                        )}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </TooltipProvider>
        ) : (
          <div className="flex flex-col gap-4 p-6 pt-2">
            <Button asChild className="w-full">
              <NavLink to={createFieldLink}>
                <Plus />
                <span>Nieuw perceel aanmaken</span>
              </NavLink>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
