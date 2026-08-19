import { Layers } from "lucide-react"
import { DropdownMenuCheckedRadioItem } from "~/components/custom/dropdown-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
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
          <Layers className="h-5 w-full" />
        </DropdownMenuTrigger>
      </AtlasControlGroup>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={style}>
          <DropdownMenuCheckedRadioItem value="satellite" onClick={() => setStyle("satellite")}>
            Satelliet
          </DropdownMenuCheckedRadioItem>
          <DropdownMenuCheckedRadioItem value="standard" onClick={() => setStyle("standard")}>
            Topografisch
          </DropdownMenuCheckedRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
