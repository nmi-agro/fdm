import {
  calculateVanggewasWinterteeltKorting,
  getRegion,
  isVanggewas,
  type RegionKey,
} from "@nmi-agro/fdm-calculator"
import {
  addCultivation,
  checkPermission,
  findHoofdteelt,
  getCultivationsForFarm,
  getFields,
  getSeasonPlanProposal,
  removeCultivation,
  resolveSeasonPlanRules,
  startOfDayInFdmTimeZone,
  toFdmDateString,
} from "@nmi-agro/fdm-core"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  redirect,
  useFetcher,
  useLoaderData,
} from "react-router"
import { dataWithSuccess } from "remix-toast"
import { CropPicker, type CropOption } from "~/components/blocks/plan-next/crop-picker"
import { PlanNextStepFooter } from "~/components/blocks/plan-next/step-footer"
import { getPlanNextPath, getPlanNextStep } from "~/components/blocks/plan-next/steps"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
  getCandidatePlanYears,
  getCultivationCatalogueForPlanYear,
  parsePlanYear,
} from "~/lib/season-plan.server"

/** Number of fields whose soil region is looked up at the same time. */
const REGION_CONCURRENCY = 4

/** Soil regions where article 28d Urm (catch crops on sand and loess) applies. */
const SAND_OR_LOESS: RegionKey[] = ["zand_nwc", "zand_zuid", "loess"]

/** A cultivation that follows the main cultivation, as shown in the step. */
type FollowCrop = {
  b_lu: string
  b_lu_name: string
  /** Sowing date (YYYY-MM-DD), or `null`. */
  b_lu_start: string | null
  /** End date (YYYY-MM-DD), or `null`. */
  b_lu_end: string | null
}

/** An arable field as shown in the step. */
type CatchCropRow = {
  b_id: string
  b_name: string
  mainCrop: string
  /** End date of the main cultivation (YYYY-MM-DD), or `null`. */
  mainEnd: string | null
  followCrops: FollowCrop[]
  /** Whether the field lies on sand or loess, or `null` when the region is unknown. */
  sandOrLoess: boolean | null
  /** Expected reduction of the nitrogen usage norm of the next year (kg N/ha), or `null`. */
  korting: number | null
  kortingDescription: string | null
  /** Default sowing and end date for a new catch crop (YYYY-MM-DD). */
  defaultStart: string
  defaultEnd: string
}

/** Splits an array into consecutive chunks of at most `size` items. */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/** Returns the start of the day a number of days after the calendar date of a moment. */
function addDays(date: Date, days: number): Date {
  const [y, m, d] = toFdmDateString(date).split("-").map(Number)
  return startOfDayInFdmTimeZone(y, m, d + days)
}

/** Parses a date input (YYYY-MM-DD) as the start of that day in Europe/Amsterdam. */
function parseDateInput(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split("-").map(Number)
  return startOfDayInFdmTimeZone(y, m, d)
}

/**
 * Loads the arable fields of the target year with their main cultivation, the crops that follow
 * it, and the expected catch crop reduction (art. 28d Urm) on sand and loess.
 */
export async function loader({ request, params, url }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400, statusText: "Farm ID is required" })
    }
    const year = parsePlanYear(params.year, getCandidatePlanYears())
    if (year === null) {
      return redirect(getPlanNextPath(b_id_farm))
    }
    const session = await getSession(request)
    const rules = resolveSeasonPlanRules(year)
    const timeframe = {
      start: startOfDayInFdmTimeZone(year - 1, 1, 1),
      end: new Date(startOfDayInFdmTimeZone(year + 2, 1, 1).getTime() - 1),
    }

    const [proposal, fields, cultivationsByField, catalogue, canWrite] = await Promise.all([
      getSeasonPlanProposal(fdm, session.principal_id, b_id_farm, year),
      getFields(fdm, session.principal_id, b_id_farm, timeframe),
      getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      getCultivationCatalogueForPlanYear(fdm, session.principal_id, b_id_farm, year),
      checkPermission(fdm, "farm", "write", b_id_farm, session.principal_id, url.pathname, false),
    ])
    const fieldById = new Map(fields.map((field) => [field.b_id, field]))

    const arable = proposal.fields.filter((field) => {
      const main = findHoofdteelt(cultivationsByField.get(field.b_id) ?? [], year, true)
      return (
        main !== null &&
        !(main.b_lu_croprotation && rules.nonArableCropRotations.includes(main.b_lu_croprotation))
      )
    })

    const regions = new Map<string, RegionKey | null>()
    for (const group of chunk(arable, REGION_CONCURRENCY)) {
      await Promise.all(
        group.map(async (field) => {
          const centroid = fieldById.get(field.b_id)?.b_centroid
          try {
            regions.set(field.b_id, centroid ? await getRegion(centroid) : null)
          } catch {
            regions.set(field.b_id, null)
          }
        }),
      )
    }

    const rows: CatchCropRow[] = arable.map((field) => {
      const cultivations = cultivationsByField.get(field.b_id) ?? []
      const main = findHoofdteelt(cultivations, year, true)
      const yearEnd = startOfDayInFdmTimeZone(year + 1, 1, 1).getTime()
      const followCrops = cultivations
        .filter(
          (c) =>
            c.b_lu !== main?.b_lu &&
            c.b_lu_start !== null &&
            c.b_lu_start.getTime() < yearEnd &&
            (!main?.b_lu_start || c.b_lu_start.getTime() >= main.b_lu_start.getTime()),
        )
        .map((c) => ({
          b_lu: c.b_lu,
          b_lu_name: c.b_lu_name,
          b_lu_start: c.b_lu_start ? toFdmDateString(c.b_lu_start) : null,
          b_lu_end: c.b_lu_end ? toFdmDateString(c.b_lu_end) : null,
        }))

      const region = regions.get(field.b_id) ?? null
      let korting: number | null = null
      let kortingDescription: string | null = null
      if (region && SAND_OR_LOESS.includes(region)) {
        const descriptions: string[] = []
        korting = calculateVanggewasWinterteeltKorting(
          cultivations,
          region,
          year + 1,
          descriptions,
        ).toNumber()
        kortingDescription = descriptions.join("; ") || null
      }

      const defaultStart = main?.b_lu_end
        ? addDays(main.b_lu_end, 1)
        : startOfDayInFdmTimeZone(year, 9, 1)
      return {
        b_id: field.b_id,
        b_name: field.b_name,
        mainCrop: main?.b_lu_name ?? "",
        mainEnd: main?.b_lu_end ? toFdmDateString(main.b_lu_end) : null,
        followCrops,
        sandOrLoess: region ? SAND_OR_LOESS.includes(region) : null,
        korting,
        kortingDescription,
        defaultStart: toFdmDateString(defaultStart),
        // After 1 February, so destroying it does not cause a reduction (art. 28d lid 3)
        defaultEnd: `${year + 1}-03-01`,
      }
    })

    // Catch crops and green manures: the catch crop category and the statutory catch crop list
    const options: CropOption[] = catalogue
      .filter(
        (entry) =>
          (entry.b_lu_croprotation !== null &&
            rules.catchCropRotations.includes(entry.b_lu_croprotation)) ||
          isVanggewas(entry.b_lu_catalogue, year),
      )
      .map((entry) => ({ value: entry.b_lu_catalogue, label: entry.b_lu_name }))

    return {
      b_id_farm,
      year,
      rows,
      options,
      nonArableCount: proposal.fields.length - arable.length,
      canWrite,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/** Adds a catch crop after the main cultivation of a field, or removes a following crop. */
export async function action({ request, params, url }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400, statusText: "Farm ID is required" })
    }
    const year = parsePlanYear(params.year, getCandidatePlanYears())
    if (year === null) {
      throw data("Ongeldig jaar", { status: 400, statusText: "Ongeldig jaar" })
    }
    const session = await getSession(request)
    const canWrite = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      url.pathname,
      false,
    )
    if (!canWrite) {
      throw data("U heeft geen schrijfrechten op dit bedrijf.", { status: 403 })
    }

    const formData = await request.formData()
    const intent = formData.get("intent")
    const b_id = formData.get("b_id")
    if (typeof b_id !== "string") {
      throw data("Ongeldige actie", { status: 400 })
    }
    const proposal = await getSeasonPlanProposal(fdm, session.principal_id, b_id_farm, year)
    const field = proposal.fields.find((f) => f.b_id === b_id)
    if (!field) {
      throw data("Perceel niet gevonden", { status: 404 })
    }

    if (intent === "add_catch_crop") {
      const crop = formData.get("crop")
      const start = parseDateInput(formData.get("start"))
      const end = parseDateInput(formData.get("end"))
      if (typeof crop !== "string" || crop === "") {
        throw data("Kies een vanggewas of groenbemester.", { status: 400 })
      }
      if (!start || toFdmDateString(start).slice(0, 4) !== String(year)) {
        throw data(`Kies een zaaidatum in ${year}.`, { status: 400 })
      }
      if (!end || end.getTime() <= start.getTime()) {
        throw data("De einddatum moet na de zaaidatum liggen.", { status: 400 })
      }
      await addCultivation(fdm, session.principal_id, crop, b_id, start, end)
      return dataWithSuccess(null, `Vanggewas toegevoegd aan ${field.b_name}.`)
    }

    if (intent === "remove_follow_crop") {
      const b_lu = formData.get("b_lu")
      if (typeof b_lu !== "string") {
        throw data("Ongeldige actie", { status: 400 })
      }
      // Only crops of this field, never its main cultivation
      if (field.current?.b_lu === b_lu) {
        throw data("De hoofdteelt kan hier niet worden verwijderd.", { status: 400 })
      }
      const cultivations = await getCultivationsForFarm(fdm, session.principal_id, b_id_farm, {
        start: startOfDayInFdmTimeZone(year, 1, 1),
        end: new Date(startOfDayInFdmTimeZone(year + 2, 1, 1).getTime() - 1),
      })
      if (!(cultivations.get(b_id) ?? []).some((c) => c.b_lu === b_lu)) {
        throw data("Teelt niet gevonden", { status: 404 })
      }
      await removeCultivation(fdm, session.principal_id, b_lu)
      return dataWithSuccess(null, `Teelt verwijderd van ${field.b_name}.`)
    }

    throw data("Ongeldige actie", { status: 400 })
  } catch (error) {
    return handleActionError(error)
  }
}

/** Returns the explanation at the top of the step. */
function getIntroduction(year: number, nonArableCount: number): string {
  const parts = [
    "Leg per bouwlandperceel een vanggewas of groenbemester vast; dat mag ook als het niet verplicht is.",
    `Op zand- en lössgrond geldt artikel 28d Urm: zonder vanggewas na de hoofdteelt, of bij inzaai na 1 oktober, volgt een korting op de stikstofgebruiksnorm van ${year + 1} (2–14 oktober 5, 15–31 oktober 10, vanaf 1 november of geen vanggewas 20 kg N/ha; vernietigen vóór 1 februari ${year + 1} geeft 20 kg N/ha).`,
    "De korting wordt berekend met de regels die nu in de app beschikbaar zijn.",
  ]
  if (nonArableCount > 0) {
    parts.push(
      `${nonArableCount} ${nonArableCount === 1 ? "perceel met grasland of natuur staat" : "percelen met grasland of natuur staan"} hier niet bij.`,
    )
  }
  return parts.join(" ")
}

/** Formats a date input value (YYYY-MM-DD) as DD-MM-YYYY. */
function formatDate(value: string | null): string {
  if (!value) return "–"
  const [y, m, d] = value.split("-")
  return `${d}-${m}-${y}`
}

/** Step 4: catch crops and green manures after the main cultivation. */
export default function PlanNextCatchCrops() {
  const { b_id_farm, year, rows, options, nonArableCount, canWrite } =
    useLoaderData<typeof loader>()
  const step = getPlanNextStep("catch_crops")

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{step.title}</h2>
        <p className="text-muted-foreground text-sm">{step.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Na de hoofdteelt in {year}</CardTitle>
          <CardDescription>{getIntroduction(year, nonArableCount)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Er zijn geen bouwlandpercelen met een hoofdteelt in {year}. Leg eerst de hoofdteelt
              vast in de stap Gewassen.
            </p>
          ) : (
            rows.map((row) => (
              <CatchCropField key={row.b_id} row={row} options={options} canWrite={canWrite} />
            ))
          )}
        </CardContent>
      </Card>

      <PlanNextStepFooter b_id_farm={b_id_farm} year={year} step="catch_crops" />
    </div>
  )
}

/** An arable field with its following crops, the expected reduction and a form to add one. */
function CatchCropField({
  row,
  options,
  canWrite,
}: {
  row: CatchCropRow
  options: CropOption[]
  canWrite: boolean
}) {
  const fetcher = useFetcher()
  const isBusy = fetcher.state !== "idle"

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-medium whitespace-nowrap">{row.b_name}</span>
          <span className="text-muted-foreground text-xs">
            {`Hoofdteelt: ${row.mainCrop}${row.mainEnd ? ` (tot ${formatDate(row.mainEnd)})` : ""}`}
          </span>
        </div>
        {row.korting !== null ? (
          <Badge
            key={row.korting > 0 ? "korting" : "geen"}
            variant={row.korting > 0 ? "outline" : "secondary"}
            className={row.korting > 0 ? "text-amber-700 dark:text-amber-400" : undefined}
          >
            {row.korting > 0 ? `Verwachte korting ${row.korting} kg N/ha` : "Geen korting"}
          </Badge>
        ) : (
          <Badge key="region" variant="secondary">
            {row.sandOrLoess === false ? "Geen zand of löss" : "Grondsoort onbekend"}
          </Badge>
        )}
      </div>
      {row.kortingDescription ? (
        <p className="text-muted-foreground text-xs">{row.kortingDescription}</p>
      ) : null}

      {row.followCrops.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {row.followCrops.map((crop) => (
            <li key={crop.b_lu} className="flex flex-wrap items-center gap-2">
              <span>{crop.b_lu_name}</span>
              <span className="text-muted-foreground text-xs">
                {`${formatDate(crop.b_lu_start)} – ${formatDate(crop.b_lu_end)}`}
              </span>
              {canWrite ? (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="remove_follow_crop" />
                  <input type="hidden" name="b_id" value={row.b_id} />
                  <input type="hidden" name="b_lu" value={crop.b_lu} />
                  <Button type="submit" size="sm" variant="ghost" disabled={isBusy}>
                    <span>Verwijderen</span>
                  </Button>
                </fetcher.Form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Geen vanggewas of groenbemester vastgelegd.</p>
      )}

      {canWrite ? (
        <fetcher.Form
          method="post"
          className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto_auto_auto] sm:items-end"
        >
          <input type="hidden" name="intent" value="add_catch_crop" />
          <input type="hidden" name="b_id" value={row.b_id} />
          <label className="flex flex-col gap-1 text-xs">
            <span>Vanggewas of groenbemester</span>
            <CropPicker name="crop" options={options} placeholder="Kies een gewas" />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span>Zaaidatum</span>
            <Input type="date" name="start" defaultValue={row.defaultStart} className="w-40" />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span>Einddatum</span>
            <Input type="date" name="end" defaultValue={row.defaultEnd} className="w-40" />
          </label>
          <Button type="submit" variant="outline" disabled={isBusy}>
            <span key={isBusy ? "busy" : "idle"}>{isBusy ? "Opslaan..." : "Toevoegen"}</span>
          </Button>
        </fetcher.Form>
      ) : null}
    </div>
  )
}
