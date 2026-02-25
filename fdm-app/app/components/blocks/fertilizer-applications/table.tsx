import {
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { useMemo, useState } from "react"
import { cn } from "@/app/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import {
    type ApplicationExtended,
    columns,
    type FertAppRecordItem,
} from "./columns"

type FertAppRecord = Record<string, FertAppRecordItem>

/**
 * Creates a mapper function that places applications into table rows.
 *
 * @param keyExtractor given a fertilizer application an index unique within the field's fertilizer
 * applications group, it should return a stringified number that will determine which row the
 * application goes into.
 * @returns the mapper function
 */
const createMapper =
    (
        keyExtractor: (
            application: Omit<ApplicationExtended, "p_app_date"> & {
                p_app_date: Date
            },
            i: number,
        ) => string,
    ) =>
    (record: FertAppRecord, applications: ApplicationExtended[]) => {
        applications.forEach((application, i) => {
            if (!application.p_app_date) return
            const key = keyExtractor(application, i)
            record[key] ??= {
                id: `${application.p_id}_${key}`,
                applications: [],
            }
            record[key].applications.push(application)
        })
    }

/**
 * Mapper functions that can be used to group the fertilizer applications into table rows in different ways
 */
export const mappers = {
    mapByOrder: createMapper((_application, i) => i.toString()),
    mapByDate: createMapper((application) =>
        application.p_app_date.getTime().toString(),
    ),
    mapByField: createMapper((application) => application.b_id),
    mapEach: createMapper((application) => application.p_app_id),
} as const

const keysToSortById: (keyof typeof mappers)[] = ["mapByOrder", "mapByDate"]

function compareDates(a: Date, b: Date) {
    return a.getTime() - b.getTime()
}

function compareStrings(a: string, b: string) {
    return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Groups fertilizer applications into table rows using the mapper strategy
 *
 * Some mappers will come up with an ordering of the rows. The function will
 * try to sort by date and field name otherwise.
 *
 * @param applicationsPerField
 * @param mapper
 * @returns
 */
function groupAndOrderFertApps(
    applicationsPerField: ApplicationExtended[][],
    mapper: keyof typeof mappers,
) {
    const record: FertAppRecord = {}
    for (const group of applicationsPerField) {
        mappers[mapper](record, group)
    }

    const unsortedEntries = Object.entries(record)

    // Applications with no date get filtered out in the mapping function
    unsortedEntries.forEach((ent) => {
        ent[1].applications.sort(
            (a, b) =>
                compareDates(a.p_app_date as Date, b.p_app_date as Date) ||
                compareStrings(a.b_name, b.b_name),
        )
    })

    const entries = keysToSortById.includes(mapper)
        ? // There is an ordering imposed by the mapper which is the same as the ordering of the keys
          unsortedEntries
              .map(
                  ([key, value]) =>
                      [Number.parseFloat(key), value] as [
                          number,
                          FertAppRecordItem,
                      ],
              )
              .sort((a, b) => a[0] - b[0])
        : // There is no inherent ordering, sort by date and field name of first application
          unsortedEntries.sort(
              (a, b) =>
                  compareDates(
                      a[1].applications[0].p_app_date as Date,
                      b[1].applications[0].p_app_date as Date,
                  ) ||
                  compareStrings(
                      a[1].applications[0].b_name,
                      b[1].applications[0].b_name,
                  ),
          )

    return entries.map((ent) => ent[1])
}

export function DataTable({
    numFields,
    fertilizerApplications,
    returnUrl,
}: {
    numFields: number
    fertilizerApplications: ApplicationExtended[][]
    returnUrl: string
}) {
    const [rowMapper, setRowMapper] =
        useState<keyof typeof mappers>("mapByDate")

    const numFertilizerApplications = fertilizerApplications
        .map((apps) => apps.length)
        .reduce((a, b) => a + b, 0)

    const shouldShowGroupingSelector =
        numFields > 1 && numFertilizerApplications > 1

    const records = useMemo(
        () => groupAndOrderFertApps(fertilizerApplications, rowMapper),
        [fertilizerApplications, rowMapper],
    )

    const columnVisibility = useMemo(
        () => ({
            b_name: numFields > 1,
            "applications.length": records.some(
                (app) => app.applications.length > 1,
            ),
            modify: fertilizerApplications.some((apps) =>
                apps.some((app) => app.canModify),
            ),
        }),
        [numFields, fertilizerApplications, records],
    )

    const table = useReactTable({
        columns: columns,
        data: records,
        getCoreRowModel: getCoreRowModel(),
        meta: { returnUrl },
        state: {
            columnVisibility: columnVisibility,
        },
    })

    return (
        <>
            {shouldShowGroupingSelector && (
                <div className="flex flex-row items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                        Groeperen op{" "}
                    </p>
                    <Tabs
                        value={rowMapper}
                        onValueChange={(value) => {
                            if (value in mappers)
                                setRowMapper(value as keyof typeof mappers)
                        }}
                    >
                        <TabsList>
                            <TabsTrigger value="mapByDate">Datum</TabsTrigger>
                            <TabsTrigger value="mapByOrder">
                                Volgorde
                            </TabsTrigger>
                            <TabsTrigger value="mapEach">
                                Niet groeperen
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            )}
            <Table>
                <TableHeader className="sticky">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <TableHead
                                        key={header.id}
                                        className={cn({
                                            "sticky right-0":
                                                header.column.id === "modify",
                                        })}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef
                                                      .header,
                                                  header.getContext(),
                                              )}
                                    </TableHead>
                                )
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody className="text-muted-foreground">
                    {table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                                <TableCell
                                    key={cell.id}
                                    className={cn({
                                        "sticky right-0":
                                            cell.column.id === "modify",
                                    })}
                                >
                                    {flexRender(
                                        cell.column.columnDef.cell,
                                        cell.getContext(),
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </>
    )
}
