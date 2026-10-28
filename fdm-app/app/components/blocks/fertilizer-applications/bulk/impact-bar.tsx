import { cn } from "~/lib/utils"

export type ImpactBarTone = "ok" | "under" | "over"

const TONE_CLASSES: Record<ImpactBarTone, string> = {
  ok: "bg-green-500",
  under: "bg-orange-500",
  over: "bg-red-500",
}

/**
 * A horizontal bar that shows a current value, the change by an unsaved application, and the
 * remaining room up to a reference (norm or advice).
 *
 * An increase is drawn after the current value with a hatched fill; a decrease, for example when
 * an application is changed to a smaller amount, is drawn as the part that drops away, in the
 * same hue but faded. The bar is decorative: the values must also be shown as text next to it.
 *
 * @param current - The current value.
 * @param after - The value after the application. Omit when there is no preview.
 * @param reference - The norm or advice. When 0, any value fills the bar.
 * @param tone - The status of the value that is shown (after, or current without preview).
 */
export function ImpactBar({
  current,
  after,
  reference,
  tone,
  className,
}: {
  current: number
  after?: number
  reference: number
  tone: ImpactBarTone
  className?: string
}) {
  const scale = Math.max(reference, current, after ?? 0)
  const toPercent = (value: number) => (scale > 0 ? Math.min((value / scale) * 100, 100) : 0)
  const currentPercent = toPercent(Math.max(current, 0))
  const afterPercent = after !== undefined ? toPercent(Math.max(after, 0)) : currentPercent
  // The solid part is what remains; the change is either added (hatched) or removed (faded)
  const solidPercent = Math.min(currentPercent, afterPercent)
  const addedPercent = Math.max(afterPercent - currentPercent, 0)
  const removedPercent = Math.max(currentPercent - afterPercent, 0)
  const referencePercent = toPercent(reference)

  return (
    <div
      aria-hidden="true"
      className={cn("bg-muted relative h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div className="flex h-full">
        <div
          className={cn(
            "h-full transition-[width] duration-300 ease-out motion-reduce:transition-none",
            TONE_CLASSES[tone],
          )}
          style={{ width: `${solidPercent}%` }}
        />
        {addedPercent > 0 && (
          <div
            className={cn(
              "h-full bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgb(255_255_255/0.55)_3px_6px)] transition-[width] duration-300 ease-out motion-reduce:transition-none",
              TONE_CLASSES[tone],
            )}
            style={{ width: `${addedPercent}%` }}
          />
        )}
        {removedPercent > 0 && (
          <div
            className={cn(
              "h-full opacity-30 transition-[width] duration-300 ease-out motion-reduce:transition-none",
              TONE_CLASSES[tone],
            )}
            style={{ width: `${removedPercent}%` }}
          />
        )}
      </div>
      {reference > 0 && referencePercent < 100 && (
        <div
          className="bg-foreground/60 absolute inset-y-0 w-px"
          style={{ left: `${referencePercent}%` }}
        />
      )}
    </div>
  )
}
