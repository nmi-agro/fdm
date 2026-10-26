import { ArrowRight, CalendarX2 } from "lucide-react"
import { useState } from "react"
import { NavLink, useFetcher } from "react-router"
import type {
  MineralizationHarvestSettings,
  MineralizationMainCultivation,
} from "~/lib/mineralization"
import { getHarvestParameterLabel } from "~/components/blocks/harvest/parameters"
import { getEffectiveHarvestable, getHarvestTerm } from "~/components/blocks/harvest/utils"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Spinner } from "~/components/ui/spinner"
import { DateField } from "./date-field"

/**
 * Asks for the measured or planned harvest of the main cultivation; the calculation needs it.
 *
 * Crops with one harvest get an inline form with the fields of their harvest class, as in the
 * harvest form, filled in with the usual values for the crop; they can also be left empty to save
 * only the date. Crops with several cuts, such as grassland, link to the harvest form of the crop
 * rotation, where all cuts can be entered.
 */
export function MissingHarvestCard({
  mainCultivation,
  harvestSettings,
  defaultHarvestDate,
  year,
  bulkHarvestHref,
}: {
  mainCultivation: MineralizationMainCultivation
  /** Fields of the harvest class and their usual values. */
  harvestSettings: MineralizationHarvestSettings | null
  defaultHarvestDate: string | null
  year: number
  /** Harvest form of the crop rotation for this field. */
  bulkHarvestHref: string
}) {
  const fetcher = useFetcher()
  const [harvestDate, setHarvestDate] = useState(defaultHarvestDate ?? "")
  const parameters = harvestSettings?.parameters ?? []
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      parameters.map((key) => [key, String(harvestSettings?.defaults[key] ?? "")]),
    ),
  )
  // Saved with all fields of the harvest class, or with none
  const filled = parameters.filter((key) => (values[key] ?? "").trim() !== "").length
  const partlyFilled = filled > 0 && filled < parameters.length
  const busy = fetcher.state !== "idle"
  const cropName = mainCultivation.b_lu_name ?? mainCultivation.b_lu_catalogue
  const multiple =
    getEffectiveHarvestable(mainCultivation.b_lu_harvestable, mainCultivation.b_lu_croprotation) ===
    "multiple"
  const terms = getHarvestTerm(
    mainCultivation.b_lu_croprotation,
    true,
    mainCultivation.b_lu_harvestable,
  )

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarX2 className="size-5" aria-hidden />
          {multiple ? "Sneden ontbreken" : "Oogst ontbreekt"}
        </CardTitle>
        <CardDescription>
          {multiple
            ? `Vul de gemaaide of geplande ${terms} van ${cropName} in om de mineralisatie te berekenen. Een datum in de toekomst geldt als gepland; die kun je later aanpassen.`
            : `Vul de gemeten of geplande oogst van ${cropName} in om de mineralisatie te berekenen. Een datum in de toekomst geldt als geplande oogst; die kun je later aanpassen.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {multiple ? (
          <Button asChild>
            <NavLink to={bulkHarvestHref}>
              Sneden invullen
              <ArrowRight aria-hidden />
            </NavLink>
          </Button>
        ) : (
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="save_harvest" />
            <input type="hidden" name="b_lu" value={mainCultivation.b_lu} />
            <input type="hidden" name="b_lu_harvest_date" value={harvestDate} />
            <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
              <DateField
                name="b_lu_harvest_date_input"
                label="Oogstdatum"
                className="[&_input]:text-base sm:[&_input]:text-sm"
                min={`${year}-01-01`}
                max={`${year}-12-31`}
                required
                value={harvestDate}
                onChange={setHarvestDate}
              />
              {parameters.map((key) => (
                <div key={key} className="grid gap-1.5">
                  <Label htmlFor={`missing-harvest-${key}`}>{getHarvestParameterLabel(key)}</Label>
                  <Input
                    id={`missing-harvest-${key}`}
                    name={key}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    className="text-base sm:text-sm"
                    aria-invalid={(partlyFilled && !values[key]?.trim()) || undefined}
                    value={values[key] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Button type="submit" disabled={busy || !harvestDate || partlyFilled}>
                {busy ? <Spinner /> : null}
                Oogst opslaan
              </Button>
              {partlyFilled ? (
                <p className="text-muted-foreground text-xs" aria-live="polite">
                  Vul alle gegevens van de oogst in, of laat ze allemaal leeg om alleen de datum op
                  te slaan.
                </p>
              ) : parameters.length > 0 ? (
                <p className="text-muted-foreground text-xs">
                  Ingevuld met gangbare waarden voor {cropName}; pas ze aan als je ze weet.
                </p>
              ) : null}
            </div>
          </fetcher.Form>
        )}
      </CardContent>
    </Card>
  )
}
