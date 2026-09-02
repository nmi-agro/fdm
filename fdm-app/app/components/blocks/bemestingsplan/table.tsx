import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useCallback, useState } from "react"
import { useFetcher } from "react-router"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import type { BemestingsplanRowData, BemestingsplanTableMeta } from "./columns"
import { NewBemestingsplanForm } from "./new-form"

export function DataTable<T extends BemestingsplanRowData>({
  data,
  columns,
  b_id_farm,
  b_name_farm,
  canModify,
}: {
  data: T[]
  columns: ColumnDef<T>[]
  b_id_farm: string
  b_name_farm: string | null
  canModify: boolean
}) {
  const deleteFetcher = useFetcher()
  const [deletedPlans, setDeletedPlans] = useState(new Set<string>())

  const handleDelete = useCallback(
    async (p_id_plan: string) => {
      setDeletedPlans((current) => new Set(current).add(p_id_plan))
      try {
        await deleteFetcher.submit(
          new URLSearchParams([
            ["intent", "delete_plan"],
            ["p_id_plan", p_id_plan],
          ]),
          {
            method: "POST",
          },
        )
      } finally {
        setDeletedPlans((current) => {
          const result = new Set(current)
          result.delete(p_id_plan)
          return result
        })
      }
    },
    [deleteFetcher],
  )

  const isDeleting = useCallback((p_id_plan: string) => deletedPlans.has(p_id_plan), [deletedPlans])

  const table = useReactTable<T>({
    data: data,
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: {
      b_id_farm: b_id_farm,
      b_name_farm: b_name_farm,
      onDelete: handleDelete,
      deleting: isDeleting,
      canModify: canModify,
    } as BemestingsplanTableMeta as any,
  })

  return (
    <div className="space-y-4">
      {canModify && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Overzicht van gegenereerde bemestingsplannen per teeltjaar.
          </p>
          <div className="flex items-center gap-2">
            <NewBemestingsplanForm />
          </div>
        </div>
      )}
      <div className="relative overflow-x-auto rounded-md border">
        <Table>
          <TableHeader className="bg-background sticky top-0 z-5">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Geen resultaten.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
