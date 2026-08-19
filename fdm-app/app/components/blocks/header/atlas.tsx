import { ChevronDown } from "lucide-react"
import { NavLink } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import {
  AvailableAtlasLayerInfo,
  useAvailableAtlasLayers,
  useCurrentAtlasLayer,
} from "~/components/blocks/atlas/atlas-layer"
import { DropdownMenuCheckedRadioItem } from "~/components/custom/dropdown-menu"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

export function HeaderAtlas({ b_id_farm }: { b_id_farm: string | undefined }) {
  const calendar = useCalendarStore((state) => state.calendar)

  const currentLayer = useCurrentAtlasLayer()
  const availableLayers = useAvailableAtlasLayers()

  const farmLayers = availableLayers.filter((layer) => layer.requiresFarm)
  const otherLayers = availableLayers.filter((layer) => !layer.requiresFarm)

  function makeOption(info: AvailableAtlasLayerInfo) {
    return (
      <NavLink key={info.value} to={info.url} className="w-full">
        {/* The component natively manages the icon and aria state now */}
        <DropdownMenuCheckedRadioItem value={info.value} className="cursor-pointer">
          {info.label}
        </DropdownMenuCheckedRadioItem>
      </NavLink>
    )
  }

  return (
    <>
      <BreadcrumbSeparator className="hidden xl:block" />
      <BreadcrumbItem className="hidden xl:block">
        <BreadcrumbLink href={`/farm/${b_id_farm}/${calendar}/atlas`}>Atlas</BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <DropdownMenu>
          <DropdownMenuTrigger className="focus-visible:ring-ring flex max-w-30 items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:max-w-50 md:max-w-none">
            <span className="truncate">
              {availableLayers.find((option) => option.value === currentLayer)?.label ?? "Onbekend"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup value={currentLayer ?? "unknown"}>
              {farmLayers.length > 0 && (
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-muted-foreground text-xs">
                    Bedrijf
                  </DropdownMenuLabel>
                  {farmLayers.map((info) => makeOption(info))}
                </DropdownMenuGroup>
              )}

              {farmLayers.length > 0 && otherLayers.length > 0 && <DropdownMenuSeparator />}

              {otherLayers.length > 0 && (
                <DropdownMenuGroup>
                  {farmLayers.length > 0 && (
                    <DropdownMenuLabel className="text-muted-foreground text-xs">
                      Overig
                    </DropdownMenuLabel>
                  )}
                  {otherLayers.map((info) => makeOption(info))}
                </DropdownMenuGroup>
              )}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </BreadcrumbItem>
    </>
  )
}
