import { FertilizerPlan } from "@nmi-agro/fdm-core"
import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { Download, FileText, Trash2 } from "lucide-react"
import { Suspense, use } from "react"
import { NavLink, useFetcher } from "react-router"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { DataTableColumnHeader } from "./column-header"
import { getBemestingsplanDownloadName } from "./util"

export type FertilizerPlanStatus = "fresh" | "expired" | "unknown"
export type BemestingsplanRowData = FertilizerPlan & { status: Promise<FertilizerPlanStatus> }

export interface BemestingsplanTableMeta {
  b_id_farm: string
  b_name_farm: string
  canModify: boolean
  deleting(p_id_plan: string): boolean
  onDelete(p_id_plan: string): void
}

type TableMeta = BemestingsplanTableMeta | undefined

export const columns = [
  {
    accessorKey: "p_plan_year",
    header({ column }) {
      return <DataTableColumnHeader column={column} title="Teeltjaar" />
    },
    cell({ row }) {
      return <span className="font-medium">{row.original.p_plan_year}</span>
    },
  },
  {
    accessorKey: "p_plan_date",
    header({ column }) {
      return <DataTableColumnHeader column={column} title="Datum" />
    },
    cell({ row }) {
      return (
        <span className="text-muted-foreground">
          {format(row.original.p_plan_date, "PP", { locale: nl })}
        </span>
      )
    },
  },
  {
    id: "status",
    accessorFn() {},
    header: "Status",
    cell({ row, table }) {
      return (
        <Suspense
          fallback={
            <Badge variant="outline" className="text-muted-foreground text-xs">
              Controleren...
            </Badge>
          }
        >
          <StatusDisplay
            year={row.original.p_plan_year}
            status={row.original.status}
            canModify={table.options.meta?.canModify ?? true}
            disabled={(table.options.meta as TableMeta)?.deleting(row.original.p_id_plan) ?? false}
          />
        </Suspense>
      )
    },
  },
  {
    id: "document",
    accessorFn() {},
    header: "Document",
    cell({ row, table }) {
      const downloadName = getBemestingsplanDownloadName(
        (table.options.meta as TableMeta)?.b_id_farm ?? "",
        (table.options.meta as TableMeta)?.b_name_farm ?? null,
        row.original,
      )
      const isDeleting = (table.options.meta as TableMeta)?.deleting(row.original.p_id_plan)
      return (
        <Button
          variant="link"
          className="h-auto p-0 text-left font-medium"
          disabled={isDeleting}
          asChild
        >
          <NavLink to={`./${row.original.p_id_plan}`}>
            <FileText className="text-muted-foreground mr-1.5 h-4 w-4 shrink-0" />
            <span>{downloadName}</span>
          </NavLink>
        </Button>
      )
    },
  },
  {
    id: "actions",
    accessorFn() {},
    header: () => <div className="text-end">Acties</div>,
    cell({ row, table }) {
      const meta = table.options.meta as TableMeta
      const isDeleting = meta?.deleting(row.original.p_id_plan)
      const disabled = isDeleting
      const downloadUrl = `/api/bemestingsplan/download/${row.original.p_id_plan}.pdf`

      return (
        <div className="flex items-center justify-end gap-1">
          {isDeleting && <Spinner className="mr-1 h-4 w-4" />}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-8 w-8"
                disabled={disabled}
                asChild
              >
                <a href={downloadUrl} download aria-label="PDF downloaden">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>PDF direct downloaden</TooltipContent>
          </Tooltip>

          {meta?.canModify && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  disabled={disabled}
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                  aria-label="Verwijderen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Weet u het zeker?</AlertDialogTitle>
                  <AlertDialogDescription>
                    U kunt later opnieuw een bemestingsplan genereren voor teeltjaar{" "}
                    {row.original.p_plan_year}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Annuleren</AlertDialogCancel>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isDeleting}
                    onClick={() => {
                      meta?.onDelete(row.original.p_id_plan)
                    }}
                  >
                    {isDeleting ? (
                      <div className="flex items-center space-x-2">
                        <Spinner />
                        <span>Verwijderen</span>
                      </div>
                    ) : (
                      "Verwijderen"
                    )}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )
    },
  },
] as const satisfies ColumnDef<BemestingsplanRowData>[]

function StatusDisplay({
  year,
  status,
  canModify,
  disabled,
}: {
  year: number
  status: Promise<FertilizerPlanStatus>
  canModify: boolean
  disabled: boolean
}) {
  const reestablishFetcher = useFetcher()
  const isSubmitting = reestablishFetcher.state !== "idle"

  const statusCode = use(status)

  if (statusCode === "fresh") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
      >
        Actueel
      </Badge>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={
          statusCode === "expired"
            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
            : ""
        }
      >
        {statusCode === "expired" ? "Verouderd" : "Onbekend"}
      </Badge>
      {canModify && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              disabled={disabled || isSubmitting}
              size="sm"
              variant="outline"
              onClick={() => {
                void reestablishFetcher.submit(
                  new URLSearchParams([
                    ["intent", "establish_plan"],
                    ["year", String(year)],
                  ]),
                  {
                    method: "POST",
                  },
                )
              }}
            >
              Actualiseren
              {isSubmitting && <Spinner className="ml-1.5 h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Een nieuw bemestingsplan voor teeltjaar {year} genereren</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
