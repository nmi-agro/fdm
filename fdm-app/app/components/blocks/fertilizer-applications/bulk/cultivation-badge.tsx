import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import { InfoTip } from "./info-tip"

/** A cultivation as a badge in its crop rotation colour, as in the rotation table. */
export function CultivationBadge({
  name,
  cropRotation,
}: {
  name: string
  cropRotation: string | null | undefined
}) {
  return (
    <Badge
      style={{ backgroundColor: getCultivationColor(cropRotation ?? undefined) }}
      className="max-w-full truncate text-white"
      variant="default"
    >
      {name}
    </Badge>
  )
}

/**
 * A cultivation as a dot in its crop rotation colour, with the name in a tooltip. For tight
 * places such as the header of a block.
 *
 * @param label - The text in the tooltip, for example "Advies voor Grasland".
 */
export function CultivationDot({
  label,
  cropRotation,
}: {
  label: string
  cropRotation: string | null | undefined
}) {
  return (
    <InfoTip content={label}>
      {/* The padding gives the small dot a touch target of its own */}
      <button type="button" aria-label={label} className="-m-1.5 inline-flex rounded-full p-1.5">
        <span
          className="inline-block size-3 shrink-0 rounded-full"
          style={{ backgroundColor: getCultivationColor(cropRotation ?? undefined) }}
        />
      </button>
    </InfoTip>
  )
}
