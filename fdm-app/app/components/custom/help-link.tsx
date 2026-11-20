import { cn } from "cn"
import { CircleHelp } from "lucide-react"
import { buttonVariants } from "~/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { useAnalytics } from "~/hooks/use-analytics"
import { type HelpLinkSource, MANUAL_EVENTS } from "~/lib/manual/analytics"
import { getHelpHref, type HelpTargetId } from "~/lib/manual/help-targets"

/**
 * A "?" button that opens the manual page about the current screen in a new tab, so the user
 * keeps their place in the app.
 */
export function HelpLink({
  target,
  source = "page_header",
  className,
}: {
  target: HelpTargetId
  /** Where the link sits, for analytics. */
  source?: HelpLinkSource
  className?: string
}) {
  const { capture } = useAnalytics()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={getHelpHref(target)}
            target="_blank"
            rel="noopener"
            aria-label="Uitleg in de handleiding (opent in een nieuw tabblad)"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "text-muted-foreground hover:text-foreground size-8",
              className,
            )}
            onClick={() =>
              capture(MANUAL_EVENTS.helpLinkClicked, {
                help_target: target,
                source,
                from_path: window.location.pathname,
              })
            }
          />
        }
      >
        <CircleHelp className="size-5" />
      </TooltipTrigger>
      <TooltipContent>Uitleg in de handleiding</TooltipContent>
    </Tooltip>
  )
}
