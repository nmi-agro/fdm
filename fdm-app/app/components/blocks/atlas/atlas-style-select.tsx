import { LucideMap } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useAtlasStyle } from "~/store/atlas-style"
import { AtlasControlGroup } from "./atlas-controls"

export function AtlasStyleSelect() {
  const { style, setStyle } = useAtlasStyle()

  return (
    <DropdownMenu>
      <AtlasControlGroup>
        <DropdownMenuTrigger
          className="maplibregl-ctrl-icon flex items-center justify-center p-0!"
          type="button"
          title="Kies kaartstijl"
          aria-label="Kies kaartstijl"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <LucideMap className="h-5 w-full opacity-100" />
        </DropdownMenuTrigger>
      </AtlasControlGroup>
      <DropdownMenuContent>
        <DropdownMenuCheckboxItem
          checked={style === "satellite"}
          onClick={() => setStyle("satellite")}
        >
          Satelliet
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={style === "standard"}
          onClick={() => setStyle("standard")}
        >
          Topo
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
