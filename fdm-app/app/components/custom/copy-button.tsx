import { cn } from "cn"
import { CheckIcon, CopyIcon } from "lucide-react"
import { Fragment, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "~/components/ui/button"

/** How long the button shows "Gekopieerd" after a successful copy, in milliseconds. */
const COPIED_DURATION = 2000

/**
 * Copies a value to the clipboard. After a successful copy the button shows a check mark and
 * "Gekopieerd" for two seconds, and screen readers hear the same. When the browser refuses, a toast
 * tells the user to copy the text by hand.
 */
export function CopyButton({
  value,
  context,
  compact = false,
  className,
}: {
  /** The text that is copied. */
  value: string
  /**
   * What is copied, read after the visible label by screen readers, such as "adres van de
   * koppeling". Use it when a page has several copy buttons. The accessible name then starts with
   * the visible label, so voice control can find the button by what it shows.
   */
  context?: string
  /** Hides the label on narrow screens and shows only the icon. */
  compact?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), COPIED_DURATION)
    } catch {
      setCopied(false)
      toast.error("Kopiëren is niet gelukt. Selecteer de tekst en kopieer hem zelf.")
    }
  }

  const label = copied ? "Gekopieerd" : "Kopiëren"

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("shrink-0", className)}
        onClick={() => void copy()}
      >
        {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
        <span className={cn(compact && "sr-only sm:not-sr-only")}>{label}</span>
        {context && <span className="sr-only">{`: ${context}`}</span>}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Gekopieerd naar klembord." : ""}
      </span>
    </>
  )
}

/**
 * Shows text with every occurrence of `highlight` marked, so a placeholder such as `<sleutel>`
 * stands out in a snippet.
 */
function HighlightedText({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight || !text.includes(highlight)) return <>{text}</>
  const parts = text.split(highlight)
  return (
    <>
      {parts.map((part, index) => (
        // The parts of one fixed text never change order, so the index is a stable key.
        // oxlint-disable-next-line react/no-array-index-key
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 && (
            <mark className="bg-background text-foreground ring-border rounded px-0.5 font-semibold ring-1">
              {highlight}
            </mark>
          )}
        </Fragment>
      ))}
    </>
  )
}

/**
 * A block of code, a command or an address, with a button to copy it. Long lines wrap instead of
 * scrolling, so every part stays visible on a phone; the copied text keeps its original lines.
 */
export function CodeBlock({
  code,
  copyContext,
  highlight,
  className,
}: {
  /** The text shown and copied. */
  code: string
  /** What is copied, for screen readers, for example "de instellingen voor Claude Code". */
  copyContext?: string
  /** A part of the code to mark, such as the placeholder the user must replace. */
  highlight?: string
  className?: string
}) {
  return (
    <div className={cn("bg-muted flex items-start gap-2 rounded-md p-2 pl-3", className)}>
      <pre className="min-w-0 flex-1 py-1.5 font-mono text-sm [overflow-wrap:anywhere] whitespace-pre-wrap">
        <code>
          <HighlightedText text={code} highlight={highlight} />
        </code>
      </pre>
      <CopyButton value={code} context={copyContext} compact className="bg-background" />
    </div>
  )
}
