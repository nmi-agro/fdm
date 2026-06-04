import { zodResolver } from "@hookform/resolvers/zod"
import type { HarvestParameters } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { ChevronLeft, Plus, Trash2 } from "lucide-react"
import { type MouseEventHandler, useCallback, useRef } from "react"
import { Controller, useFieldArray, useWatch } from "react-hook-form"
import { useFetcher, useNavigate } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import z from "zod"
import { useIsMobile } from "@/app/hooks/use-mobile"
import { getContextualDate } from "@/app/lib/calendar"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import { HarvestFormExplainer } from "./form"
import { getHarvestParameterLabel } from "./parameters"
import { BatchFormSchema } from "./schema"
import type { HarvestableType } from "./types"

type TableColumnName =
    | HarvestParameters[number]
    | "b_lu_harvest_date"
    | "cutting"
    | "delete"

type CardColumnName = HarvestParameters[number] | "b_lu_harvest_date"

interface ColumnInfo {
    type: "number" | "date" | "b_lu_harvestable"
}
const columnInfos = {
    b_lu_yield: { type: "number" },
    b_lu_yield_fresh: { type: "number" },
    b_lu_yield_bruto: { type: "number" },
    b_lu_dm: { type: "number" },
    b_lu_n_harvestable: { type: "number" },
    b_lu_tarra: { type: "number" },
    b_lu_uww: { type: "number" },
    b_lu_moist: { type: "number" },
    b_lu_cp: { type: "number" },
} as const satisfies Record<HarvestParameters[number], ColumnInfo>

type HarvestRow = Partial<
    Record<keyof typeof columnInfos, number | null | undefined>
> & {
    b_lu_harvestable?: HarvestableType
    b_lu_harvest_date?: string | null | undefined
    b_lu_start?: Date | null | undefined
    b_lu_end?: Date | null | undefined
}

interface HarvestPair {
    example?: Partial<HarvestRow>
    default?: Partial<HarvestRow>
}

function createNewRow(
    calendar: string,
    b_lu_start: Date | null,
    b_lu_end: Date | null,
    lastRow?: HarvestRow,
    defaultRow?: Partial<HarvestRow>,
    b_date_harvest_default?: string | null,
): Partial<HarvestRow> {
    let last_b_lu_harvest_date = lastRow?.b_lu_harvest_date ?? null
    if (last_b_lu_harvest_date) {
        const copy = new Date(last_b_lu_harvest_date)
        copy.setMonth(copy.getMonth() + 1)
        last_b_lu_harvest_date = copy.toISOString()
    }
    return {
        b_lu_harvestable: "multiple",
        b_lu_start: b_lu_start,
        b_lu_end: b_lu_end,
        ...defaultRow,
        ...lastRow,
        b_lu_harvest_date:
            last_b_lu_harvest_date ??
            (b_date_harvest_default
                ? `${calendar}-${b_date_harvest_default}`
                : undefined) ??
            getContextualDate(calendar, 4, 15).toISOString(),
    }
}

function getColumnTitle(columnName: TableColumnName) {
    return columnName === "cutting"
        ? "#"
        : columnName === "b_lu_harvest_date"
          ? "Oogstdatum"
          : columnName === "delete"
            ? null
            : getHarvestParameterLabel(columnName)
}

interface BatchHarvestFormProps {
    calendar: string
    b_lu_croprotation: string | null
    b_lu_start: Date | null
    b_lu_end: Date | null
    harvestParameters: HarvestParameters
    harvestPairs?: HarvestPair[]
    defaultHarvest?: Partial<HarvestRow>
    isHarvestUpdate?: boolean
    b_date_harvest_default?: string | null
    onBack?: MouseEventHandler
}

const SchemaWithIntent = BatchFormSchema.extend({
    intent: z.literal("batch_harvest"),
})
function useBatchHarvestRemixForm({
    calendar,
    b_lu_start,
    b_lu_end,
    harvestPairs,
    defaultHarvest,
    b_date_harvest_default,
}: BatchHarvestFormProps) {
    return useRemixForm<{ intent: "batch_harvest"; harvests: HarvestRow[] }>({
        mode: "onTouched",
        // We don't let batch deletion yet so no confirmation dialog logic is necessary
        resolver: zodResolver(SchemaWithIntent),
        defaultValues: {
            intent: "batch_harvest",
            harvests:
                harvestPairs?.map((pair) => ({
                    ...pair.default,
                    b_lu_start,
                    b_lu_end,
                })) ??
                (defaultHarvest
                    ? [
                          createNewRow(
                              calendar,
                              b_lu_start,
                              b_lu_end,
                              undefined,
                              defaultHarvest,
                              b_date_harvest_default,
                          ),
                      ]
                    : []),
        },
    })
}

function BatchHarvestDataCell({
    index,
    label,
    columnName,
    harvestRow,
    exampleRow,
}: {
    index: number
    label?: string
    columnName: "b_lu_harvest_date" | HarvestParameters[number]
    harvestRow: HarvestRow
    exampleRow?: HarvestRow
}) {
    const columnInfo =
        columnName === "b_lu_harvest_date"
            ? { type: "date" }
            : columnInfos[columnName]
    return columnInfo.type === "number" ? (
        <Controller
            name={`harvests.${index}.${columnName}`}
            render={({ field, fieldState }) => (
                <Field>
                    {typeof label === "string" && (
                        <FieldLabel>{label}</FieldLabel>
                    )}
                    <Input
                        {...field}
                        type="number"
                        placeholder={
                            exampleRow?.[columnName] !== undefined &&
                            exampleRow[columnName] !== null
                                ? `b.v. ${exampleRow[columnName]}`
                                : undefined
                        }
                    />
                    {fieldState.error ? (
                        <FieldError errors={[fieldState.error]} />
                    ) : null}
                </Field>
            )}
        />
    ) : columnInfo.type === "date" ? (
        <Controller
            name={`harvests.${index}.${columnName}`}
            render={({ field, fieldState }) => (
                <DatePicker
                    label={label}
                    field={field}
                    fieldState={fieldState}
                    placeholder={
                        exampleRow?.[columnName] !== undefined &&
                        exampleRow[columnName] !== null
                            ? `b.v. ${format(new Date(exampleRow[columnName]), "PP", { locale: nl })}`
                            : undefined
                    }
                />
            )}
        />
    ) : (
        (harvestRow[columnName]?.toString() ?? "Onbekend")
    )
}
function BatchHarvestFormRow({
    index,
    id,
    columnNames,
    exampleRow,
    harvestRow,
    onDelete,
    onAdd,
}: {
    index: number
    id: string
    columnNames: TableColumnName[]
    exampleRow?: HarvestRow
    harvestRow: HarvestRow
    onDelete: MouseEventHandler
    onAdd: () => void
}) {
    const rowRef = useRef<HTMLTableRowElement>(null)
    return (
        <TableRow ref={rowRef} id={id}>
            {columnNames.map((columnName) => {
                const columnTitle =
                    columnName === "delete" || columnName === "cutting"
                        ? undefined
                        : getColumnTitle(columnName)

                return (
                    <TableCell
                        key={columnName}
                        title={columnTitle ?? undefined}
                        className="align-top"
                    >
                        {columnName === "cutting" ? (
                            <div className="py-2">{index + 1}</div>
                        ) : columnName === "delete" ? (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onDelete}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                title="Verwijderen"
                                aria-label="Verwijderen"
                                data-delete
                                onKeyDown={(e) => {
                                    if (e.key === "Tab") {
                                        if (
                                            rowRef.current?.matches(
                                                ":last-child",
                                            )
                                        ) {
                                            e.preventDefault()
                                            onAdd()
                                        }
                                    }
                                }}
                            >
                                <Trash2 />
                            </Button>
                        ) : (
                            <BatchHarvestDataCell
                                index={index}
                                columnName={columnName}
                                harvestRow={harvestRow}
                                exampleRow={exampleRow}
                            />
                        )}
                    </TableCell>
                )
            })}
        </TableRow>
    )
}

function BatchHarvestFormItemCard({
    index,
    columnNames,
    exampleRow,
    harvestRow,
    onDelete,
}: {
    index: number
    columnNames: CardColumnName[]
    exampleRow?: HarvestRow
    harvestRow: HarvestRow
    onDelete: MouseEventHandler
}) {
    return (
        <Card className="p-2 space-y-2">
            <CardHeader className="flex flex-row items-center p-0">
                <CardTitle className="grow">{index + 1}e oogst</CardTitle>
                <Button
                    type="button"
                    variant="ghost"
                    title="Verwijderen"
                    aria-label="Verwijderen"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={onDelete}
                >
                    <Trash2 />
                </Button>
            </CardHeader>
            <CardContent className="grid gap-2 p-0 grid-cols-1 sm:grid-cols-2">
                {columnNames.map((columnName) => (
                    <BatchHarvestDataCell
                        key={columnName}
                        index={index}
                        label={getColumnTitle(columnName) ?? undefined}
                        columnName={columnName}
                        harvestRow={harvestRow}
                        exampleRow={exampleRow}
                    />
                ))}
            </CardContent>
        </Card>
    )
}

function BatchHarvestFormFields({
    form,
    calendar,
    b_lu_start,
    b_lu_end,
    harvestParameters,
    defaultHarvest,
    b_date_harvest_default,
}: BatchHarvestFormProps & {
    form: ReturnType<typeof useBatchHarvestRemixForm>
}) {
    const isMobile = useIsMobile()

    const fieldArray = useFieldArray({
        control: form.control,
        name: "harvests",
    })
    const harvests = useWatch({ control: form.control, name: "harvests" })

    const addButtonRef = useRef<HTMLButtonElement>(null)

    const addRow = useCallback(() => {
        fieldArray.append(
            createNewRow(
                calendar,
                b_lu_start,
                b_lu_end,
                harvests.length > 0
                    ? harvests[fieldArray.fields.length - 1]
                    : undefined,
                defaultHarvest,
                b_date_harvest_default,
            ),
        )

        setTimeout(() => {
            addButtonRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "end",
            })
        }, 100)
    }, [
        calendar,
        b_lu_start,
        b_lu_end,
        fieldArray,
        harvests,
        defaultHarvest,
        b_date_harvest_default,
    ])

    const deleteRow = useCallback(
        (i: number) => {
            const nextI = i === 0 ? 1 : i - 1
            if (nextI >= 0 && nextI < fieldArray.fields.length) {
                document
                    .getElementById(fieldArray.fields[nextI].id)
                    ?.querySelector<HTMLButtonElement>("[data-delete]")
                    ?.focus()
            }
            fieldArray.remove(i)
        },
        [fieldArray],
    )

    if (isMobile) {
        const columnNames: CardColumnName[] = [
            "b_lu_harvest_date",
            ...harvestParameters,
        ]

        return (
            <div className="space-y-2">
                {fieldArray.fields.map(({ id, ...harvestRow }, index) => (
                    <BatchHarvestFormItemCard
                        key={id}
                        index={index}
                        harvestRow={harvestRow}
                        columnNames={columnNames}
                        onDelete={() => deleteRow(index)}
                    />
                ))}
                <Button
                    ref={addButtonRef}
                    type="button"
                    variant="secondary"
                    onClick={addRow}
                    className="flex mt-2"
                >
                    <Plus />
                    Nieuwe oogst toevoegen
                </Button>
            </div>
        )
    }

    const columnNames: TableColumnName[] = [
        "cutting",
        "b_lu_harvest_date",
        ...harvestParameters,
        "delete",
    ]

    return (
        <>
            {fieldArray.fields.map((row, index) => (
                <input
                    key={row.id}
                    type="hidden"
                    name={`harvests.${index}.b_lu_harvestable`}
                    value="multiple"
                />
            ))}
            <Table>
                <TableHeader>
                    <TableRow>
                        {columnNames.map((columnName) => (
                            <TableHead key={columnName}>
                                {getColumnTitle(columnName)}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {fieldArray.fields.map(({ id, ...harvestRow }, index) => (
                        <BatchHarvestFormRow
                            key={id}
                            id={id}
                            index={index}
                            harvestRow={harvestRow}
                            columnNames={columnNames}
                            onDelete={() => deleteRow(index)}
                            onAdd={addRow}
                        />
                    ))}
                </TableBody>
            </Table>
            <Button
                ref={addButtonRef}
                type="button"
                variant="secondary"
                onClick={addRow}
                className="flex mt-2"
            >
                <Plus />
                Nieuwe rij toevoegen
            </Button>
        </>
    )
}

export function BatchHarvestFormDialog(props: BatchHarvestFormProps) {
    const navigate = useNavigate()

    const form = useBatchHarvestRemixForm(props)
    const fetcher = useFetcher()
    const harvests = useWatch({ control: form.control, name: "harvests" })

    return (
        <Dialog open={true} onOpenChange={() => navigate("..")}>
            <DialogContent className="flex flex-col max-w-2xl max-h-svh">
                <DialogHeader>
                    <DialogTitle>
                        Meerdere{" "}
                        {props.b_lu_croprotation === "grass"
                            ? "sneden"
                            : "oogsten"}{" "}
                        toevoegen
                    </DialogTitle>
                    <DialogDescription>
                        {props.isHarvestUpdate
                            ? "Werk de oogst bij van dit gewas. Vul de gegevens in, zodat deze gebruikt kunnen worden in de berekeningen."
                            : "Voeg een oogst toe aan dit gewas. Vul de gegevens in, zodat deze gebruikt kunnen worden in de berekeningen."}
                    </DialogDescription>
                </DialogHeader>
                <RemixFormProvider {...form}>
                    <fetcher.Form
                        method="post"
                        onSubmit={form.handleSubmit}
                        className="grow overflow-y-auto"
                    >
                        <fieldset
                            className="space-y-4"
                            disabled={
                                form.formState.isSubmitting ||
                                fetcher.state !== "idle"
                            }
                        >
                            <input
                                type="hidden"
                                name="intent"
                                value="batch_harvest"
                            />
                            <div>
                                <BatchHarvestFormFields
                                    {...props}
                                    form={form}
                                />
                            </div>
                            <HarvestFormExplainer />
                            <DialogFooter>
                                {props.onBack && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={props.onBack}
                                    >
                                        <ChevronLeft />
                                        Terug
                                    </Button>
                                )}
                                <Button
                                    type="submit"
                                    disabled={
                                        form.formState.isSubmitting ||
                                        fetcher.state !== "idle" ||
                                        harvests.length === 0
                                    }
                                >
                                    {form.formState.isSubmitting ? (
                                        <>
                                            <Spinner />
                                            <span>Opslaan...</span>
                                        </>
                                    ) : (
                                        "Toevoegen"
                                    )}
                                </Button>
                            </DialogFooter>
                        </fieldset>
                    </fetcher.Form>
                </RemixFormProvider>
            </DialogContent>
        </Dialog>
    )
}

export function BatchHarvestForm(props: BatchHarvestFormProps) {
    const form = useBatchHarvestRemixForm(props)
    const fetcher = useFetcher()
    const harvests = useWatch({ control: form.control, name: "harvests" })

    return (
        <RemixFormProvider {...form}>
            <fetcher.Form
                id="formHarvest"
                onSubmit={form.handleSubmit}
                method="post"
            >
                <fieldset
                    disabled={
                        form.formState.isSubmitting || fetcher.state !== "idle"
                    }
                    className="space-y-8"
                >
                    <div>
                        <BatchHarvestFormFields {...props} form={form} />
                    </div>
                    <HarvestFormExplainer />
                    <div className="flex justify-end gap-4">
                        {props.onBack && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={props.onBack}
                            >
                                <ChevronLeft />
                                Terug
                            </Button>
                        )}
                        <Button
                            type="submit"
                            className="flex ml-auto"
                            disabled={
                                form.formState.isSubmitting ||
                                fetcher.state !== "idle" ||
                                harvests.length === 0
                            }
                        >
                            {form.formState.isSubmitting ? (
                                <>
                                    <Spinner />
                                    <span>Opslaan...</span>
                                </>
                            ) : (
                                "Toevoegen"
                            )}
                        </Button>
                    </div>
                </fieldset>
            </fetcher.Form>
        </RemixFormProvider>
    )
}
