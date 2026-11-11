import { CopyIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

/**
 * Copies a value to the clipboard and confirms it with a toast. When the browser refuses, the user
 * is told to copy the text by hand.
 */
export function CopyButton({
  value,
  label = "Kopiëren",
  ariaLabel,
  className,
}: {
  /** The text that is copied. */
  value: string
  /** Visible text of the button. */
  label?: string
  /** Accessible name when the visible label alone is ambiguous, such as several buttons on a page. */
  ariaLabel?: string
  className?: string
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("Gekopieerd naar klembord.")
    } catch {
      toast.error("Kopiëren is niet gelukt. Selecteer de tekst en kopieer hem zelf.")
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("shrink-0", className)}
      aria-label={ariaLabel}
      onClick={() => void copy()}
    >
      <CopyIcon className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  )
}

/**
 * A block of code, a command or an address, with a button to copy it.
 */
export function CodeBlock({
  code,
  copyLabel,
  className,
}: {
  /** The text shown and copied. */
  code: string
  /** Accessible name of the copy button, for example "Kopieer het commando voor Claude Code". */
  copyLabel?: string
  className?: string
}) {
  return (
    <div className={cn("bg-muted flex items-start gap-2 rounded-md p-2 pl-3", className)}>
      <pre className="min-w-0 flex-1 overflow-x-auto py-1.5 font-mono text-sm whitespace-pre">
        <code>{code}</code>
      </pre>
      <CopyButton value={code} ariaLabel={copyLabel} className="bg-background" />
    </div>
  )
}
