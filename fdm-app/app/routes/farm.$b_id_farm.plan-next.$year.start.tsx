import { getSeasonPlanProgress, getSeasonPlanProposal } from "@nmi-agro/fdm-core"
import { data, type LoaderFunctionArgs, NavLink, redirect, useLoaderData } from "react-router"
import { PlanNextStepFooter } from "~/components/blocks/plan-next/step-footer"
import { getPlanNextPath, getPlanNextStep } from "~/components/blocks/plan-next/steps"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
  getCandidatePlanYears,
  parsePlanYear,
  summarizeSeasonPlanProgress,
} from "~/lib/season-plan.server"

/** Loads the proposal per field and the progress of the other year that can be planned. */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400, statusText: "Farm ID is required" })
    }
    const candidateYears = getCandidatePlanYears()
    const year = parsePlanYear(params.year, candidateYears)
    if (year === null) {
      return redirect(getPlanNextPath(b_id_farm))
    }
    const session = await getSession(request)

    const otherYear = candidateYears.find((candidate) => candidate !== year) as number
    const [proposal, otherProgress] = await Promise.all([
      getSeasonPlanProposal(fdm, session.principal_id, b_id_farm, year),
      getSeasonPlanProgress(fdm, session.principal_id, b_id_farm, otherYear),
    ])

    return {
      b_id_farm,
      year,
      other: summarizeSeasonPlanProgress(otherProgress),
      fields: proposal.fields.map((field) => ({
        b_id: field.b_id,
        b_name: field.b_name,
        status: field.status,
        fieldType: field.fieldType,
        rotationCycle: field.rotationCycle,
        sourceYear: field.sourceYear,
        history: field.history.slice(-3).map((entry) => ({
          year: entry.year,
          b_lu_name: entry.b_lu_name,
        })),
        current: field.current?.b_lu_name ?? null,
        continuing: field.continuing,
        suggested: field.suggested?.b_lu_name ?? null,
        rotationWarnings: field.rotationWarnings,
      })),
      droppedFields: proposal.droppedFields.map((field) => ({
        b_id: field.b_id,
        b_name: field.b_name,
      })),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/** Returns the label of the kind of field. */
function getFieldTypeLabel(
  fieldType: string,
  rotationCycle: number | null,
  continuing: boolean,
): string {
  if (fieldType === "permanent")
    return continuing ? "Doorlopende teelt" : "Elk jaar hetzelfde gewas"
  if (fieldType === "new") return "Nieuw perceel"
  return rotationCycle ? `Rotatie (${rotationCycle} jaar)` : "Rotatie"
}

/** Start step: the year to plan and the source of the proposal of each field. */
export default function PlanNextStart() {
  const loaderData = useLoaderData<typeof loader>()
  const { b_id_farm, year, other, fields, droppedFields } = loaderData
  const step = getPlanNextStep("start")
  const kept = fields.filter((field) => field.status === "kept").length
  const added = fields.filter((field) => field.status === "new").length

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{step.title}</h2>
        <p className="text-muted-foreground text-sm">{step.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seizoen</CardTitle>
          <CardDescription>
            U plant het seizoen {year}. Kies een ander jaar als u een eerder seizoen nog wilt
            afmaken of al verder vooruit wilt plannen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[year, other.year]
              .sort((a, b) => a - b)
              .map((option) => (
                <Button key={option} asChild variant={option === year ? "default" : "outline"}>
                  <NavLink to={getPlanNextPath(b_id_farm, option, "start")}>
                    <span>{option}</span>
                  </NavLink>
                </Button>
              ))}
          </div>
          <p className="text-muted-foreground text-sm">
            {other.complete
              ? `Het plan voor ${other.year} is compleet.`
              : `Het plan voor ${other.year} heeft nog ${other.openItems} open ${other.openItems === 1 ? "punt" : "punten"}.`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uitgangssituatie</CardTitle>
          <CardDescription>
            {`${kept} ${kept === 1 ? "perceel loopt" : "percelen lopen"} door, ${added} ${added === 1 ? "perceel is" : "percelen zijn"} nieuw en ${droppedFields.length} ${droppedFields.length === 1 ? "perceel is" : "percelen zijn"} niet meer beschikbaar in ${year}. Doorlopende teelten, zoals grasland, lopen door tenzij u ze beëindigt; bij rotatiepercelen gaat het voorstel uit van het jaar dat in de vruchtwisseling terugkomt. In de stap Gewassen kunt u dit per perceel aanpassen.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Er zijn geen percelen in gebruik in {year}. Voeg percelen toe in de stap Percelen.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perceel</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vorige jaren</TableHead>
                  <TableHead>Uitgangsjaar</TableHead>
                  <TableHead>Gewas {year}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.b_id}>
                    <TableCell className="font-medium whitespace-nowrap">{field.b_name}</TableCell>
                    <TableCell>
                      <span>
                        {getFieldTypeLabel(field.fieldType, field.rotationCycle, field.continuing)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {field.history.length > 0 ? (
                        <span>
                          {field.history
                            .map((entry) => `${entry.year}: ${entry.b_lu_name}`)
                            .join(" · ")}
                        </span>
                      ) : (
                        <span>Geen gegevens</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span>{field.sourceYear ?? "–"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {field.current && field.continuing ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span>{field.current}</span>
                              <Badge variant="outline">Loopt door</Badge>
                            </div>
                            <span className="text-muted-foreground text-xs">
                              Loopt door uit eerdere jaren. In de stap Gewassen kunt u deze teelt
                              beëindigen en een ander gewas kiezen.
                            </span>
                          </div>
                        ) : field.current ? (
                          <div className="flex items-center gap-2">
                            <span>{field.current}</span>
                            <Badge variant="secondary">Vastgelegd</Badge>
                          </div>
                        ) : field.suggested ? (
                          <div className="flex items-center gap-2">
                            <span>{field.suggested}</span>
                            <Badge variant="outline">Voorstel</Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Zelf kiezen</span>
                        )}
                        {field.rotationWarnings.map((warning) => (
                          <span
                            key={warning.b_lu_croprotation}
                            className="text-xs text-amber-700 dark:text-amber-400"
                          >
                            {`Rotatieadvies: dit gewastype hooguit 1 op ${warning.minYearsBetween} jaar (laatst in ${warning.lastYear}).`}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {droppedFields.length > 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">
              {`Niet meer beschikbaar in ${year}: ${droppedFields.map((field) => field.b_name).join(", ")}.`}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <PlanNextStepFooter b_id_farm={b_id_farm} year={year} step="start" />
    </div>
  )
}
