import { FertilizerPlan } from "@nmi-agro/fdm-core"
import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { File, Trash2 } from "lucide-react"
import { use } from "react"
import { NavLink, useFetcher } from "react-router"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
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
      return <DataTableColumnHeader column={column} title="Voor" />
    },
    cell({ row }) {
      return row.original.p_plan_year
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
        <StatusDisplay
          year={row.original.p_plan_year}
          status={row.original.status}
          canModify={table.options.meta?.canModify ?? true}
          disabled={(table.options.meta as TableMeta)?.deleting(row.original.p_id_plan) ?? false}
        />
      )
    },
  },
  {
    id: "download",
    accessorFn() {},
    header: "Download",
    cell({ row, table }) {
      const downloadName = getBemestingsplanDownloadName(
        (table.options.meta as TableMeta)?.b_id_farm ?? "",
        (table.options.meta as TableMeta)?.b_name_farm ?? null,
        row.original,
      )
      return (
        <Button
          variant="link"
          className="has-[>svg]:px-0"
          disabled={(table.options.meta as TableMeta)?.deleting(row.original.p_id_plan)}
          asChild
        >
          <NavLink to={`./${row.original.p_id_plan}`}>
            <File />
            {downloadName}
          </NavLink>
        </Button>
      )
    },
  },
  {
    id: "actions",
    accessorFn() {},
    header: () => <div className="text-end">Verwijderen</div>,
    cell({ row, table }) {
      const isDeleting = (table.options.meta as TableMeta)?.deleting(row.original.p_id_plan)
      const disabled = isDeleting
      return (
        <div className="flex items-center justify-end gap-2">
          {isDeleting && <Spinner />}
          <Button
            disabled={disabled}
            variant="ghost"
            title="Verwijderen"
            className="hover:text-destructive"
            onClick={() => {
              ;(table.options.meta as TableMeta)?.onDelete(row.original.p_id_plan)
            }}
          >
            <Trash2 aria-label="Verwijderen" />
          </Button>
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
    return <span className="text-muted-foreground">Actueel</span>
  }

  return (
    <div className="text-muted-foreground flex items-center">
      {statusCode === "expired" ? "Verlopen" : "Onbekend"}
      {canModify && (
        <Button
          disabled={disabled || isSubmitting}
          size="sm"
          variant="outline"
          onClick={() => {
            reestablishFetcher.submit(
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
          Herstellen
          {<Spinner />}
        </Button>
      )}
    </div>
  )
}
