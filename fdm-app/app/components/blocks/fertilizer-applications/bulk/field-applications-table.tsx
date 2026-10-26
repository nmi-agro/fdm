import type { Dose } from "@nmi-agro/fdm-calculator/browser"
import type { Fertilizer } from "@nmi-agro/fdm-core"
import type { ApplicationMethods } from "@nmi-agro/fdm-data"
import { calculateDose } from "@nmi-agro/fdm-calculator/browser"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { Pencil, Trash2 } from "lucide-react"
import { useMemo } from "react"
import type { FertilizerApplication } from "~/components/blocks/fertilizer-applications/types.d"
import { getApplicationAmountUnitLabel } from "~/components/blocks/fertilizer-applications/utils"
import { FertilizerIcon } from "~/components/custom/fertilizer-icon"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Badge } from "~/components/ui/badge"
import { Button, buttonVariants } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { cn } from "~/lib/utils"
import { InfoTip } from "./info-tip"
import { formatKg } from "./status"

/** Change and remove buttons for one application, with a confirmation before removing. */
function ApplicationActions({
  application,
  date,
  dose,
  isEditing,
  isBusy,
  onEdit,
  onDelete,
}: {
  application: FertilizerApplication
  date: string
  dose?: Dose
  isEditing: boolean
  isBusy: boolean
  onEdit: (application: FertilizerApplication) => void
  onDelete: (p_app_id: string) => void
}) {
  return (
    <span className="flex justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Gift van ${date} wijzigen`}
        disabled={isBusy || isEditing}
        onClick={() => onEdit(application)}
      >
        <Pencil className="size-4" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Gift van ${date} verwijderen`}
            disabled={isBusy}
          >
            <Trash2 className="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gift verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              De gift van {application.p_name_nl} op {date} wordt verwijderd.
              {dose &&
                ` De aanvoer op dit perceel daalt daarmee met ${formatKg(dose.p_dose_nw)} kg werkzame N, ${formatKg(dose.p_dose_p)} kg P₂O₅ en ${formatKg(dose.p_dose_k)} kg K₂O per ha.`}{" "}
              Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(application.p_app_id)}
              className={buttonVariants({ variant: "destructive" })}
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  )
}

/**
 * The saved fertilizer applications of a field, with the nutrients each application supplies
 * (workable N, P₂O₅ and K₂O in kg/ha). A table in a wide column, a card per application in a
 * narrow one (phones).
 *
 * Applications can be changed or removed. The application that is being changed in the form is
 * highlighted.
 */
export function FieldApplicationsTable({
  calendar,
  applications,
  fertilizers,
  applicationMethodOptions,
  canModify,
  editingId,
  onEdit,
  onDelete,
  isBusy,
}: {
  calendar: string
  applications: FertilizerApplication[]
  fertilizers: Fertilizer[]
  applicationMethodOptions: { value: ApplicationMethods; label: string }[]
  canModify: Record<string, boolean>
  editingId?: string
  onEdit: (application: FertilizerApplication) => void
  onDelete: (p_app_id: string) => void
  isBusy: boolean
}) {
  const sorted = useMemo(
    () => [...applications].sort((a, b) => a.p_app_date.getTime() - b.p_app_date.getTime()),
    [applications],
  )

  // Nutrients supplied per application
  const doses = useMemo(() => {
    try {
      return calculateDose({ applications, fertilizers })
    } catch {
      return undefined
    }
  }, [applications, fertilizers])
  const doseById = new Map(doses?.applications.map((dose) => [dose.p_app_id, dose]))

  const items = sorted.map((application) => ({
    application,
    fertilizer: fertilizers.find((f) => f.p_id === application.p_id),
    dose: doseById.get(application.p_app_id),
    editable: canModify[application.p_app_id] ?? true,
    isEditing: application.p_app_id === editingId,
    date: format(application.p_app_date, "PP", { locale: nl }),
    amount:
      application.p_app_amount_display !== null
        ? `${application.p_app_amount_display.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} ${getApplicationAmountUnitLabel(application.p_app_amount_unit)}`
        : "–",
    method:
      applicationMethodOptions.find((x) => x.value === application.p_app_method)?.label ??
      "Onbekend",
  }))
  const actionProps = { isBusy, onEdit, onDelete }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            Bemestingen in {calendar}
            <Badge variant="secondary">{applications.length}</Badge>
          </CardTitle>
          <CardDescription>
            Opgeslagen giften op dit perceel, met de aanvoer per gift in kg per ha.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="@container/apps">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nog geen bemestingen op dit perceel. Een opgeslagen gift verschijnt hier.
          </p>
        ) : (
          <>
            {/* Narrow containers (phones) get a card per application instead of a wide table */}
            <ul className="divide-y rounded-md border @3xl/apps:hidden">
              {items.map((item) => (
                <li
                  key={item.application.p_app_id}
                  className={cn("space-y-2 p-3", item.isEditing && "bg-muted")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="flex items-center gap-2 font-medium">
                        {item.fertilizer && (
                          <FertilizerIcon
                            p_type={item.fertilizer.p_type}
                            p_type_rvo={item.fertilizer.p_type_rvo}
                          />
                        )}
                        <span className="min-w-0">{item.application.p_name_nl}</span>
                      </p>
                      {/* Each separator stays with the value after it, so no line ends in "·" */}
                      <p className="text-muted-foreground text-xs">
                        <span className="whitespace-nowrap">{item.date}</span>{" "}
                        <span className="whitespace-nowrap">· {item.amount}</span>{" "}
                        <span>·&nbsp;{item.method}</span>
                      </p>
                      {item.isEditing && <Badge variant="outline">Wordt gewijzigd</Badge>}
                    </div>
                    {item.editable && (
                      <ApplicationActions
                        application={item.application}
                        date={item.date}
                        dose={item.dose}
                        isEditing={item.isEditing}
                        {...actionProps}
                      />
                    )}
                  </div>
                  {item.dose && (
                    <dl className="text-muted-foreground grid grid-cols-3 gap-2 text-xs tabular-nums">
                      {(
                        [
                          ["N (werkzaam)", item.dose.p_dose_nw],
                          ["P₂O₅", item.dose.p_dose_p],
                          ["K₂O", item.dose.p_dose_k],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd className="text-foreground text-sm">{formatKg(value)} kg/ha</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-md border @3xl/apps:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Meststof</TableHead>
                    <TableHead className="text-right">Hoeveelheid</TableHead>
                    <TableHead>Methode</TableHead>
                    <TableHead className="text-right">
                      <InfoTip content="Werkzame stikstof, kg N/ha">
                        <button
                          type="button"
                          className="cursor-help underline decoration-dotted underline-offset-4"
                        >
                          N
                        </button>
                      </InfoTip>
                    </TableHead>
                    <TableHead className="text-right">P₂O₅</TableHead>
                    <TableHead className="text-right">K₂O</TableHead>
                    <TableHead className="w-24">
                      <span className="sr-only">Acties</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.application.p_app_id}
                      data-state={item.isEditing ? "selected" : undefined}
                      className={cn(item.isEditing && "bg-muted")}
                    >
                      <TableCell className="whitespace-nowrap">{item.date}</TableCell>
                      <TableCell className="max-w-56">
                        <span className="flex items-center gap-2">
                          {item.fertilizer && (
                            <FertilizerIcon
                              p_type={item.fertilizer.p_type}
                              p_type_rvo={item.fertilizer.p_type_rvo}
                            />
                          )}
                          <span className="truncate font-medium">{item.application.p_name_nl}</span>
                          {item.isEditing && <Badge variant="outline">Wordt gewijzigd</Badge>}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {item.amount}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-40 truncate">
                        {item.method}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.dose ? formatKg(item.dose.p_dose_nw) : "–"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.dose ? formatKg(item.dose.p_dose_p) : "–"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.dose ? formatKg(item.dose.p_dose_k) : "–"}
                      </TableCell>
                      <TableCell>
                        {item.editable && (
                          <ApplicationActions
                            application={item.application}
                            date={item.date}
                            dose={item.dose}
                            isEditing={item.isEditing}
                            {...actionProps}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
