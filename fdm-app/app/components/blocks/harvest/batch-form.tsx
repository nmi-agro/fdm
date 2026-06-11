import { zodResolver } from "@hookform/resolvers/zod"
import type { HarvestParameters } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { ChevronLeft, Plus, Trash2 } from "lucide-react"
import {
    type MouseEventHandler,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react"
import {
    Controller,
    type Resolver,
    useFieldArray,
    useWatch,
} from "react-hook-form"
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
    placeholder: string
    unit?: string
}
const columnInfos = {
    b_lu_yield: { type: "number", placeholder: "37500", unit: "kg / ha" },
    b_lu_yield_fresh: { type: "number", placeholder: "37500", unit: "kg / ha" },
    b_lu_yield_bruto: { type: "number", placeholder: "37500", unit: "kg / ha" },
    b_lu_tarra: { type: "number", placeholder: "5", unit: "%" },
    b_lu_dm: { type: "number", placeholder: "850", unit: "g / kg" },
    b_lu_uww: { type: "number", placeholder: "350", unit: "g / 5kg" },
    b_lu_moist: { type: "number", placeholder: "15", unit: "%" },
    b_lu_n_harvestable: { type: "number", placeholder: "850", unit: "g / kg" },
    b_lu_cp: { type: "number", placeholder: "170", unit: "g RE / kg DS" },
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

/**
 * Creates a new harvest row object with values pre-filled according to the different existing rows supplied.
 *
 * Most importantly, if the table already contains a row, the last row is duplicated and the date is
 * incremented by one month, assuming the farmer would cut their grass every four weeks.
 *
 * @param calendar the calendar parameter from the URL. Used to build the default harvest date
 * @param b_lu_start default b_lu_start, used to validate b_lu_harvest_date for this row
 * @param b_lu_end default b_lu_end, used to validate b_lu_harvest_date for this row
 * @param lastRow last row on the table, if one exists
 * @param defaultRow harvest row object containing the default harvest parameters. b_lu_harvest_date is
 * ignored
 * @param b_date_harvest_default a string in the form "07-15" containing the month and day of the usual
 * harvest of this cultivation
 * @returns a new harvest row object, which can be appended to the table data
 */
function createNewRow(
    calendar: string,
    b_lu_start: Date | null,
    b_lu_end: Date | null,
    lastRow?: HarvestRow,
    defaultRow?: Partial<HarvestRow>,
    b_date_harvest_default?: string | null,
): Partial<HarvestRow> {
    let b_lu_harvest_date: string | undefined | null
    if (lastRow?.b_lu_harvest_date) {
        const copy = new Date(lastRow?.b_lu_harvest_date)
        copy.setMonth(copy.getMonth() + 1)
        b_lu_harvest_date = copy.toISOString()
    } else if (calendar && b_date_harvest_default) {
        try {
            const splitted = b_date_harvest_default.split("-")
            if (splitted.length !== 2) {
                throw new Error("Expected format MM-DD")
            }
            const monthOrdinal = Number.parseInt(splitted[0], 10)
            const day = Number.parseInt(splitted[1], 10)
            if (!Number.isFinite(day) || day > 31 || day < 1) {
                throw new Error("Day is expected to be in range 01-31")
            }
            if (
                !Number.isFinite(monthOrdinal) ||
                monthOrdinal > 12 ||
                monthOrdinal < 1
            ) {
                throw new Error("Expected month to be in range 01-12")
            }
            b_lu_harvest_date = getContextualDate(
                calendar,
                monthOrdinal,
                day,
            ).toISOString()
        } catch (err) {
            console.error(
                new Error("Failed to parse default date", { cause: err }),
            )
        }
    }
    return {
        b_lu_harvestable: "multiple",
        b_lu_start: b_lu_start,
        b_lu_end: b_lu_end,
        ...defaultRow,
        ...lastRow,
        b_lu_harvest_date: b_lu_harvest_date,
    }
}

/**
 * Gets the column title/field label for any field that may be found on the input table or the input cards
 *
 * @param columnName name of the column. Everything in the batch form use the terms column and row for
 * consistency
 * @returns the column title/field label
 */
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
    /** The calendar parameter from the URL. Used to build the default harvest date. */
    calendar: string
    /** Crop rotation ID for the cultivation, found in the catalogue */
    b_lu_croprotation: string | null
    /** Start date for the cultivation. Used to validate b_lu_harvest_date. */
    b_lu_start: Date | null
    /** Ending date for the cultivation. Used to validate b_lu_harvest_date. */
    b_lu_end: Date | null
    /** Which parameters are needed for a complete harvest analysis */
    harvestParameters: HarvestParameters
    /**
     * Data for rows to add at start. An empty array will create an empty table.
     * If this is `undefined` a new row will be added, created using the defaultHarvest.
     */
    harvestPairs?: HarvestPair[]
    /** Default harvest to add if the table contains no rows */
    defaultHarvest?: Partial<HarvestRow>
    /** Whether the form modifying existing harvests. Currently it only changes the help message displayed. */
    isHarvestUpdate?: boolean
    /** Most common harvest date for this cultivation, provided in form, for example, `"07-15"` for 15 July */
    b_date_harvest_default?: string | null
    /**
     * If provided, a back button will be displayed next to Submit, and it will be called when the button
     * is clicked.
     */
    onBack?: MouseEventHandler
}

/**
 * Schema with an intent field, which is used to distinguish between single and batch harvest entry
 */
const SchemaWithIntent = BatchFormSchema.extend({
    intent: z.literal("batch_harvest"),
})

type BatchHarvestFormValues = {
    intent: "batch_harvest"
    harvests: HarvestRow[]
}

/**
 * useRemixForm call used in `BatchHarvestFormDialog` and `BatchHarvestForm`
 * @param param0 batch harvest form props
 * @returns a remix-hook-form object
 */
function useBatchHarvestRemixForm({
    calendar,
    b_lu_start,
    b_lu_end,
    harvestPairs,
    defaultHarvest,
    b_date_harvest_default,
}: BatchHarvestFormProps) {
    return useRemixForm<BatchHarvestFormValues>({
        mode: "onTouched",
        // We don't let batch deletion yet so no confirmation dialog logic is necessary
        resolver: zodResolver(
            SchemaWithIntent,
        ) as Resolver<BatchHarvestFormValues>,
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

/**
 * Component that renders a form input for each known data field, or just the value if the columnName is not known
 * @param param0 props
 * @returns a ReactNode
 */
function BatchHarvestDataCell({
    index,
    label,
    columnName,
    harvestRow,
    exampleRow,
}: {
    /** Row index */
    index: number
    /** Label to display as part of the input field */
    label?: string
    /** Column name to determine the type of input field */
    columnName: "b_lu_harvest_date" | HarvestParameters[number]
    /** Data to fill in the inputs */
    harvestRow: HarvestRow
    /** Data to fill in the placeholders of the inputs */
    exampleRow: HarvestRow | undefined
}) {
    const columnInfo =
        columnName === "b_lu_harvest_date"
            ? { type: "date", placeholder: "1 jan. 2026", unit: undefined }
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
                        placeholder={`b.v. ${exampleRow?.[columnName] ?? columnInfo.placeholder} ${columnInfo.unit ?? ""}`}
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
                            ? `b.v. ${format(new Date(exampleRow[columnName]), "PP", { locale: nl })} ${columnInfo.unit ?? ""}`
                            : `b.v. ${columnInfo.placeholder} ${columnInfo.unit ?? ""}`
                    }
                />
            )}
        />
    ) : (
        (harvestRow[columnName]?.toString() ?? "Onbekend")
    )
}

/**
 * Table row for the input table as seen on desktop
 *
 * @param param0 props
 * @returns a ReactNode that renders into a <td> element
 */
function BatchHarvestFormRow({
    index,
    id,
    columnNames,
    harvestRow,
    exampleRow,
    onDelete,
    onAdd,
}: {
    /** Row index */
    index: number
    /** Unique row ID */
    id: string
    /** Column names to show */
    columnNames: TableColumnName[]
    /** Data to fill in the placeholders of the inputs */
    harvestRow: HarvestRow
    /** Data to fill in the inputs */
    exampleRow: HarvestRow | undefined
    /** Event handler callback for when the delete button is clicked */
    onDelete: MouseEventHandler
    /** Callback for when a new row addition is triggered via keyboard */
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

/**
 * Card for the stacked table view as seen on mobile
 *
 * @param param0 props
 * @returns
 */
function BatchHarvestFormItemCard({
    index,
    columnNames,
    harvestRow,
    exampleRow,
    onDelete,
}: {
    /** Row index */
    index: number
    /** Column names to show */
    columnNames: CardColumnName[]
    /** Data to fill in the placeholders of the inputs */
    harvestRow: HarvestRow
    /** Data to fill in the inputs */
    exampleRow: HarvestRow | undefined
    /** Event handler callback for when the delete button is clicked */
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

/**
 * Responsive fields for the form. This doesn't include the submit and back buttons.
 *
 * On desktop a table is displayed. On mobile a stacked card view is used.
 *
 * @param param0 props
 * @returns a ReactNode to be used inside a form
 */
function BatchHarvestFormFields({
    form,
    calendar,
    b_lu_start,
    b_lu_end,
    harvestParameters,
    defaultHarvest,
    b_date_harvest_default,
    harvestPairs,
}: BatchHarvestFormProps & {
    /** Remix Hook Form object */
    form: ReturnType<typeof useBatchHarvestRemixForm>
}) {
    const isMobile = useIsMobile()

    const fieldArray = useFieldArray({
        control: form.control,
        name: "harvests",
    })
    const harvests = useWatch({ control: form.control, name: "harvests" })

    // Map the initial list of row unique IDs to the example harvests
    const [harvestExamplesMap, setHarvestExamplesMap] = useState(
        new Map<string, Partial<HarvestRow>>(),
    )
    // biome-ignore lint/correctness/useExhaustiveDependencies: fieldArray's initial value is derived from harvestPairs
    useEffect(() => {
        const result = new Map<string, Partial<HarvestRow>>()
        if (harvestPairs) {
            fieldArray.fields.forEach((field, i) => {
                if (i < harvestPairs.length && harvestPairs[i].example) {
                    result.set(field.id, harvestPairs[i].example)
                }
            })
        }
        setHarvestExamplesMap(result)
    }, [harvestPairs])

    const harvestParameterColumns = (
        Object.keys(columnInfos) as HarvestParameters
    ).filter((columnName) => harvestParameters.includes(columnName))

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
            ...harvestParameterColumns,
        ]

        return (
            <div className="space-y-2">
                <input type="hidden" name="intent" value="batch_harvest" />
                {fieldArray.fields.map((row, index) => (
                    <input
                        key={row.id}
                        type="hidden"
                        name={`harvests.${index}.b_lu_harvestable`}
                        value="multiple"
                    />
                ))}
                {fieldArray.fields.map(({ id, ...harvestRow }, index) => (
                    <BatchHarvestFormItemCard
                        key={id}
                        index={index}
                        harvestRow={harvestRow}
                        exampleRow={harvestExamplesMap.get(id)}
                        columnNames={columnNames}
                        onDelete={() => deleteRow(index)}
                    />
                ))}
                <Button
                    ref={addButtonRef}
                    type="button"
                    variant="secondary"
                    onClick={addRow}
                    className="w-full flex mt-2 items-center"
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
        ...harvestParameterColumns,
        "delete",
    ]

    return (
        <div className="space-y-2">
            <input type="hidden" name="intent" value="batch_harvest" />
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
                            exampleRow={harvestExamplesMap.get(id)}
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
            >
                <Plus />
                Nieuwe rij toevoegen
            </Button>
        </div>
    )
}

/**
 * The batch harvest input form in dialog format
 *
 * @param props props
 * @returns a ReactNode of the dialog
 */
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
                            <BatchHarvestFormFields {...props} form={form} />
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

/**
 * The batch harvest input form in inline format
 *
 * @param props props
 * @returns a ReactNode of the inline form
 */
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
