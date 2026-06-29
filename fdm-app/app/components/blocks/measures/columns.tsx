import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { Pencil, Trash2 } from "lucide-react"
import { Form, NavLink } from "react-router"
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
import { Button } from "~/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"

export type MeasureTableRow = {
  m_id: string
  m_name: string
  fields: {
    b_id: string
    b_name: string | null
    b_id_measure: string
    m_start: Date | null
    m_end: Date | null
  }[]
  actualFieldCount?: number
}

function formatDate(d: Date | null): string {
  if (!d) return "Doorlopend"
  return format(d, "dd-MM-yyyy", { locale: nl })
}

export function getColumns(
  basePathFormatter: (b_id: string) => string,
  domain: "organization" | "farm",
  onEdit?: (row: MeasureTableRow) => void,
  onClose?: (row: MeasureTableRow) => void,
  deleteAction?: string,
): ColumnDef<MeasureTableRow>[] {
  const columns: ColumnDef<MeasureTableRow>[] = [
    {
      accessorKey: "m_name",
      header: "Maatregel",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.m_name}</p>
          <p className="text-muted-foreground font-mono text-xs">
            {row.original.m_id.replace("bln_", "")}
          </p>
        </div>
      ),
    },
    {
      id: "m_start",
      header: "Startdatum",
      cell: ({ row }) => {
        const first = row.original.fields[0]
        const allSame = row.original.fields.every(
          (f) => (f.m_start?.getTime() ?? null) === (first?.m_start?.getTime() ?? null),
        )
        if (!first?.m_start) return <span className="text-muted-foreground text-sm">—</span>
        return (
          <span className="text-muted-foreground text-sm">
            {allSame ? formatDate(first.m_start) : "Variabel"}
          </span>
        )
      },
    },
    {
      id: "m_end",
      header: "Einddatum",
      cell: ({ row, table }) => {
        const first = row.original.fields[0]
        const allSame = row.original.fields.every(
          (f) => (f.m_end?.getTime() ?? null) === (first?.m_end?.getTime() ?? null),
        )
        if (first?.m_end && allSame) {
          return <span className="text-muted-foreground text-sm">{formatDate(first.m_end)}</span>
        }
        if (!first?.m_end) {
          return (table.options.meta?.canModify ?? true) ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => onClose?.(row.original)}
            >
              Afsluiten
            </Button>
          ) : (
            <span className="text-muted-foreground text-sm">Geen</span>
          )
        }
        return <span className="text-muted-foreground text-sm">Variabel</span>
      },
    },
    {
      id: "fields",
      header: domain === "organization" ? "Bedrijven" : "Percelen",
      cell: ({ row }) => {
        const fields = row.original.fields
        if (fields.length === 0) return null
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs">
                {fields.length}{" "}
                {domain === "organization"
                  ? fields.length === 1
                    ? "bedrijf"
                    : "bedrijven"
                  : fields.length === 1
                    ? "perceel"
                    : "percelen"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <ul className="space-y-1">
                {fields.map((f) => (
                  <li key={f.b_id}>
                    <NavLink
                      to={basePathFormatter(f.b_id)}
                      className="hover:bg-muted block rounded px-2 py-1 text-sm transition-colors"
                    >
                      {f.b_name ?? f.b_id}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )
      },
    },
  ]

  if (domain === "organization") {
    columns.push({
      id: "actualFieldCount",
      header: "Totaal percelen",
      cell: ({ row }) => {
        const actualFieldCount = row.original.actualFieldCount
        return actualFieldCount ? (
          <span className="text-muted-foreground">
            {actualFieldCount === 1 ? "1 perceel" : `${actualFieldCount} percelen`}
          </span>
        ) : null
      },
    })
  }

  if (onEdit && onClose && deleteAction) {
    columns.push({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-8 w-8"
            title="Bewerken / afsluiten"
            onClick={() => onEdit?.(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-8 w-8"
                title="Verwijderen"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Maatregel verwijderen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Wil je de maatregel &ldquo;
                  {row.original.m_name}&rdquo; definitief verwijderen? Dit kan niet ongedaan worden
                  gemaakt.
                  <br />
                  <br />
                  <span className="text-foreground font-medium">
                    Wil je de maatregel alleen beëindigen?
                  </span>{" "}
                  Gebruik dan de bewerkknop (
                  <Pencil className="mx-0.5 inline h-3.5 w-3.5" />) en stel een einddatum in.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <Form method="post" action={deleteAction}>
                  <input type="hidden" name="intent" value="delete" />
                  {row.original.fields.map((f) => (
                    <input
                      key={f.b_id_measure}
                      type="hidden"
                      name="b_id_measure"
                      value={f.b_id_measure}
                    />
                  ))}
                  <AlertDialogAction
                    type="submit"
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full"
                  >
                    Definitief verwijderen
                  </AlertDialogAction>
                </Form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    })
  }

  return columns
}
