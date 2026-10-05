import type { LucideIcon } from "lucide-react"
import { Fragment, type MouseEvent, type KeyboardEvent, type ReactNode } from "react"
import { useNavigate } from "react-router"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"

export type TimelineMenuAction = {
  key: string
  label: string
  onSelect: () => void
  icon?: LucideIcon
  destructive?: boolean
}

/** Content of a timeline menu, grouped into sections that are separated from each other. */
export type TimelineMenuSections = {
  /** Non-interactive header describing the item the menu belongs to. */
  title?: string
  detail?: string
  /** Adds a "Bekijk details" item linking to the item's own page. */
  detailsHref?: string
  /** Actions that create new records. */
  addActions?: TimelineMenuAction[]
  /** Actions that change or remove the item itself. */
  manageActions?: TimelineMenuAction[]
}

/**
 * Opens the surrounding `TimelineContextMenu` at the position of a left click. Radix' ContextMenu
 * only opens on a `contextmenu` event, so a left click is translated into one that bubbles up to
 * the nearest trigger. Keyboard activations (no pointer position) open at the element's center.
 */
export function openMenuFromClick(event: MouseEvent<HTMLElement>) {
  const target = event.currentTarget
  let { clientX, clientY } = event
  if (event.detail === 0) {
    const rect = target.getBoundingClientRect()
    clientX = rect.left + rect.width / 2
    clientY = rect.top + rect.height / 2
  }
  target.dispatchEvent(
    new window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX, clientY }),
  )
}

/** Same as {@link openMenuFromClick} for elements that are activated with Enter or Space. */
export function openMenuFromKeyboard(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" && event.key !== " ") return
  event.preventDefault()
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.dispatchEvent(
    new window.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }),
  )
}

/**
 * Wraps a single trigger element with the timeline's context menu. The menu opens on left click
 * (the trigger's click handler must call `openMenuFromClick`); real right clicks are ignored.
 */
export function TimelineContextMenu({
  children,
  sections,
}: {
  children: ReactNode
  sections: TimelineMenuSections
}) {
  const navigate = useNavigate()
  const { title, detail, detailsHref, addActions = [], manageActions = [] } = sections
  const hasHeader = Boolean(title || detail || detailsHref)

  const groups: { key: string; heading: string; actions: TimelineMenuAction[] }[] = [
    { actions: addActions, heading: "Toevoegen", key: "add" },
    { actions: manageActions, heading: "Beheren", key: "manage" },
  ].filter((group) => group.actions.length > 0)

  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        // Only the synthetic events created by `openMenuFromClick` may open the menu.
        onContextMenuCapture={(event) => {
          if (event.nativeEvent.isTrusted) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        // Keep nested menus (an icon on a cultivation bar) from opening their parent as well.
        onContextMenu={(event) => event.stopPropagation()}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {hasHeader && (
          <ContextMenuGroup>
            {(title || detail) && (
              <div className="px-2 py-1.5">
                {title && <div className="text-sm font-medium">{title}</div>}
                {detail && (
                  <div className="text-muted-foreground text-xs whitespace-pre-line">{detail}</div>
                )}
              </div>
            )}
            {detailsHref && (
              <ContextMenuItem onSelect={() => void navigate(detailsHref)}>
                Bekijk details
              </ContextMenuItem>
            )}
          </ContextMenuGroup>
        )}
        {groups.map((group, index) => (
          <Fragment key={group.key}>
            {(hasHeader || index > 0) && <ContextMenuSeparator />}
            <ContextMenuGroup>
              <ContextMenuLabel className="text-muted-foreground text-xs font-normal">
                {group.heading}
              </ContextMenuLabel>
              {group.actions.map(({ key, label, onSelect, icon: Icon, destructive }) => (
                <ContextMenuItem
                  className={destructive ? "text-destructive focus:text-destructive" : undefined}
                  key={key}
                  onSelect={onSelect}
                >
                  {Icon && <Icon className="size-4" />}
                  {label}
                </ContextMenuItem>
              ))}
            </ContextMenuGroup>
          </Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
}
