import { type ReactElement, type ReactNode, useState } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"

/**
 * A tooltip that also opens with a tap or click, so the explanation is reachable on touch
 * screens, where hover does not exist. On devices with a mouse it opens on hover as usual.
 *
 * @param props.children - The trigger. It must be a single element that can hold a ref.
 * @param props.content - The text of the tooltip.
 */
export function InfoTip({
  children,
  content,
  className,
}: {
  children: ReactElement
  content: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Tooltip
      open={open}
      onOpenChange={(value, e) => {
        // Do not hide the tooltip for just moving the pointer out
        if (value || e.reason === "outside-press" || e.reason === "escape-key") {
          setOpen(value)
        }
      }}
    >
      <TooltipTrigger
        render={children}
        onClick={(event) => {
          // A tap toggles the tooltip; on hover devices this keeps it open after a click
          event.preventDefault()
          setOpen((prev) => !prev)
        }}
      />
      <TooltipContent className={className}>{content}</TooltipContent>
    </Tooltip>
  )
}
