import { useSearchParams } from "react-router"
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"

/** Search parameter that selects the nitrogen balance with effective nitrogen. */
const EFFECTIVE_NITROGEN_PARAM = "stikstof"
const EFFECTIVE_NITROGEN_VALUE = "werkzaam" as const

/**
 * Returns whether the nitrogen balance should be calculated with effective nitrogen,
 * based on the search parameters of the request URL.
 *
 * @param request - The request of the loader.
 * @returns `true` when the URL contains `?stikstof=werkzaam`.
 */
export function isEffectiveNitrogenRequested(request: Request): boolean {
  return (
    new URL(request.url).searchParams.get(EFFECTIVE_NITROGEN_PARAM) === EFFECTIVE_NITROGEN_VALUE
  )
}

/** The two methods to calculate the nitrogen balance, in display order. */
const NITROGEN_METHODS = ["totaal", EFFECTIVE_NITROGEN_VALUE] as const
type NitrogenMethod = (typeof NITROGEN_METHODS)[number]

const NITROGEN_METHOD_LABELS: Record<NitrogenMethod, string> = {
  totaal: "Totale stikstof",
  werkzaam: "Werkzame stikstof",
}

function isNitrogenMethod(value: string): value is NitrogenMethod {
  return (NITROGEN_METHODS as readonly string[]).includes(value)
}

/**
 * Choice between the two methods to calculate the nitrogen balance: with total nitrogen or with
 * effective nitrogen (total N × N-werkingscoëfficiënt of the fertilizer). Shown as tabs, like the
 * other view choices in the app, because both options are a method rather than a setting that is
 * on or off. The choice is stored in the URL, so the loaders recalculate the balance and the
 * choice is kept when the page is shared.
 */
export function EffectiveNitrogenToggle() {
  const [searchParams, setSearchParams] = useSearchParams()
  const method: NitrogenMethod =
    searchParams.get(EFFECTIVE_NITROGEN_PARAM) === EFFECTIVE_NITROGEN_VALUE
      ? EFFECTIVE_NITROGEN_VALUE
      : "totaal"

  const onMethodChange = (value: NitrogenMethod) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value === EFFECTIVE_NITROGEN_VALUE) {
          next.set(EFFECTIVE_NITROGEN_PARAM, EFFECTIVE_NITROGEN_VALUE)
        } else {
          next.delete(EFFECTIVE_NITROGEN_PARAM)
        }
        return next
      },
      { preventScrollReset: true },
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span id="nitrogen-method-label" className="text-muted-foreground text-sm">
        Berekenen met
      </span>
      <Tabs
        value={method}
        onValueChange={(value) => {
          if (isNitrogenMethod(value)) onMethodChange(value)
        }}
      >
        <TabsList aria-labelledby="nitrogen-method-label">
          {NITROGEN_METHODS.map((item) => (
            <TabsTrigger
              key={item}
              value={item}
              // Drop the focus after a mouse or touch click, so the focus ring only shows when
              // navigating with the keyboard
              onPointerUp={(event) => event.currentTarget.blur()}
            >
              {NITROGEN_METHOD_LABELS[item]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
