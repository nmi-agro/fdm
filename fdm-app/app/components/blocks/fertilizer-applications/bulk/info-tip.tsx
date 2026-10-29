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
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={children}
        onClick={(event) => {
          // A tap toggles the tooltip; on hover devices this keeps it open after a click
          event.preventDefault()
          setOpen((prev) => !prev)
        }}
        onPointerDown={(event) => {
          // Close-on-pointer-down would undo the tap on touch devices; prevent it
          if (event.pointerType !== "mouse") event.preventDefault()
        }}
      />
      <TooltipContent className={className} onPointerDownOutside={() => setOpen(false)}>
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
