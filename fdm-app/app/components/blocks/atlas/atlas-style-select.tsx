import { Earth } from "lucide-react"
import { DropdownMenuCheckedRadioItem } from "~/components/custom/dropdown-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useAtlasStyle } from "~/store/atlas-style"
import { AtlasControlGroup } from "./atlas-controls"

export const SATELLITE_BACKGROUND_REQUIRED_MESSAGE = "Satellietondergrond vereist voor deze laag"

export function AtlasStyleSelect({ disabled, title }: { disabled?: boolean; title?: string }) {
  const { style, setStyle } = useAtlasStyle()

  return (
    <DropdownMenu>
      <AtlasControlGroup>
        <DropdownMenuTrigger
          className="maplibregl-ctrl-icon flex items-center justify-center p-0! data-disabled:opacity-60"
          type="button"
          title={title ?? "Kies kaartstijl"}
          aria-label={title ?? "Kies kaartstijl"}
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <Earth className="h-5 w-full" />
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
