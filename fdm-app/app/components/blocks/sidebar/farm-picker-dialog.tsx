import { Plus } from "lucide-react"
import { NavLink } from "react-router"
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

/**
 * Dialog shown when the user clicks a farm-scoped sidebar item without a farm selected.
 *
 * Lets the user pick one of their existing farms to continue to the feature they clicked,
 * or, when they have no farms yet, offers a direct path to create one.
 */
export function FarmPickerDialog({
  open,
  onOpenChange,
  farms,
  featureLabel,
  onSelectFarm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  farms: { b_id_farm: string; b_name_farm: string | null }[]
  featureLabel: string
  onSelectFarm: (b_id_farm: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Kies een bedrijf</DialogTitle>
          <DialogDescription>
            {farms.length > 0
              ? `Selecteer een bedrijf om verder te gaan naar ${featureLabel}.`
              : `U heeft nog geen bedrijf. Maak een bedrijf aan om ${featureLabel.toLowerCase()} te kunnen gebruiken.`}
          </DialogDescription>
        </DialogHeader>
        {farms.length > 0 ? (
          <Command>
            <CommandInput placeholder="Zoek bedrijf..." className="border-none focus:ring-0 focus-visible:ring-0" />
            <CommandList className="max-h-[300px] overflow-y-auto p-2">
              <CommandEmpty>Geen bedrijven gevonden.</CommandEmpty>
              <CommandGroup heading="Bedrijven">
                {farms.map((farm) => (
                  <CommandItem
                    key={farm.b_id_farm}
                    value={farm.b_name_farm ?? farm.b_id_farm}
                    onSelect={() => onSelectFarm(farm.b_id_farm)}
                    className="cursor-pointer"
                  >
                    <span>{farm.b_name_farm ?? "Onbekend bedrijf"}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className="flex flex-col gap-4 p-6 pt-2">
            <Button asChild className="w-full">
              <NavLink to="/farm/create">
                <Plus />
                <span>Nieuw bedrijf aanmaken</span>
              </NavLink>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
