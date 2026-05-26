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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover"

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
}

function formatDate(d: Date | null): string {
    if (!d) return "Doorlopend"
    return format(d, "dd-MM-yyyy", { locale: nl })
}

export function getColumns(
    basePath: string,
    onEdit: (row: MeasureTableRow) => void,
    onClose: (row: MeasureTableRow) => void,
): ColumnDef<MeasureTableRow>[] {
    return [
        {
            accessorKey: "m_name",
            header: "Maatregel",
            cell: ({ row }) => (
                <div>
                    <p className="font-medium text-sm">{row.original.m_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
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
                if (!first?.m_start) return <span className="text-sm text-muted-foreground">—</span>
                return (
                    <span className="text-sm text-muted-foreground">
                        {allSame ? formatDate(first.m_start) : "Variabel"}
                    </span>
                )
            },
        },
        {
            id: "m_end",
            header: "Einddatum",
            cell: ({ row }) => {
                const first = row.original.fields[0]
                const allSame = row.original.fields.every(
                    (f) => (f.m_end?.getTime() ?? null) === (first?.m_end?.getTime() ?? null),
                )
                if (first?.m_end && allSame) {
                    return <span className="text-sm text-muted-foreground">{formatDate(first.m_end)}</span>
                }
                if (!first?.m_end) {
                    return (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={() => onClose(row.original)}
                        >
                            Afsluiten
                        </Button>
                    )
                }
                return <span className="text-sm text-muted-foreground">Variabel</span>
            },
        },
        {
            id: "fields",
            header: "Percelen",
            cell: ({ row }) => {
                const fields = row.original.fields
                if (fields.length === 0) return null
                return (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1.5"
                            >
                                {fields.length}{" "}
                                {fields.length === 1 ? "perceel" : "percelen"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="start">
                            <ul className="space-y-1">
                                {fields.map((f) => (
                                    <li key={f.b_id}>
                                        <NavLink
                                            to={`${basePath}/${f.b_id}`}
                                            className="block text-sm px-2 py-1 rounded hover:bg-muted transition-colors"
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
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div className="flex items-center gap-1 justify-end">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Bewerken / afsluiten"
                        onClick={() => onEdit(row.original)}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                title="Verwijderen"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Maatregel verwijderen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Wil je de maatregel &ldquo;{row.original.m_name}&rdquo; definitief verwijderen? Dit kan niet ongedaan worden gemaakt.
                                    <br /><br />
                                    <span className="text-foreground font-medium">Wil je de maatregel alleen beëindigen?</span> Gebruik dan de bewerkknop (<Pencil className="inline h-3.5 w-3.5 mx-0.5" />) en stel een einddatum in.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                <Form method="post" action={`${basePath}?index`}>
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
        },
    ]
}
