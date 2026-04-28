import type { Row } from "@tanstack/react-table"
import { Controller, useForm } from "react-hook-form"
import { useFetcher } from "react-router"
import { RemixFormProvider } from "remix-hook-form"
import { cn } from "@/app/lib/utils"
import { useActiveTableFormStore } from "@/app/store/active-table-form"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { DatePicker } from "../../custom/date-picker-v2"
import type { CropRow, FieldRow, RotationExtended } from "./columns"
import { DateRangeDisplay } from "./date-range-display"
import type { RotationTableFormSchemaType } from "./schema"

type AllowedFormSchemaType = Pick<
    RotationTableFormSchemaType,
    "b_lu_start" | "b_lu_end"
>
function TableDateSelectorForm({
    fetcher,
    name,
    value,
    row,
    required,
    onHide,
}: {
    fetcher: ReturnType<typeof useFetcher>
    name: keyof AllowedFormSchemaType
    value: Date[]
    row: Row<RotationExtended>
    required?: boolean
    onHide?: () => unknown
}) {
    const form = useForm({
        defaultValues: {
            [name]: value?.length ? value[0].toISOString() : undefined,
        },
    })
    return (
        <div className="absolute w-50 flex flex-row items-center">
            <RemixFormProvider {...form}>
                <Controller
                    name={name as string}
                    disabled={fetcher.state !== "idle"}
                    render={({ field, fieldState }) => (
                        <DatePicker
                            label={undefined}
                            required={required}
                            field={{
                                ...field,
                                onChange: (value) => {
                                    const formValues = form.getValues()
                                    const shouldSubmit =
                                        row.original.type === "crop" ||
                                        formValues[name] !== value
                                    if (shouldSubmit) {
                                        const fieldIds = encodeURIComponent(
                                            row.original.type === "field"
                                                ? row.original.b_id
                                                : (row.subRows ?? [])
                                                      .map(
                                                          (fieldRow) =>
                                                              (
                                                                  fieldRow.original as FieldRow
                                                              ).b_id,
                                                      )
                                                      .join(","),
                                        )
                                        const cultivationIds =
                                            encodeURIComponent(
                                                (
                                                    (row.getParentRow()
                                                        ?.original ??
                                                        row.original) as CropRow
                                                ).b_lu_catalogue,
                                            )
                                        fetcher
                                            .submit(
                                                { [name]: value },
                                                {
                                                    method: "POST",
                                                    action: `?cultivationIds=${cultivationIds}&fieldIds=${fieldIds}`,
                                                },
                                            )
                                            .then(onHide)
                                    }
                                    field.onChange(value)
                                },
                            }}
                            fieldState={fieldState}
                        />
                    )}
                />
            </RemixFormProvider>
            <Spinner
                className={cn(
                    "inline-block",
                    fetcher.state === "idle" && "invisible",
                )}
            />
        </div>
    )
}

export function TableDateSelector({
    name,
    row,
    cellId,
    required,
}: {
    name: keyof AllowedFormSchemaType
    row: Row<RotationExtended>
    cellId: string
    required: boolean
}) {
    const fetcher = useFetcher()
    const activeTableFormStore = useActiveTableFormStore()
    const value =
        row.original.type === "field"
            ? row.original[name]
            : (row.subRows ?? [])
                  .flatMap((fieldRow) => (fieldRow.original as FieldRow)[name])
                  .sort((d1, d2) => d1.getTime() - d2.getTime())

    const showForm =
        fetcher.state !== "idle" || activeTableFormStore.activeForm === cellId
    return (
        <Button
            variant="link"
            className="relative px-0"
            onClick={(e) => {
                e.stopPropagation()
                activeTableFormStore.setActiveForm(cellId)
            }}
        >
            <DateRangeDisplay
                range={value}
                emptyContent="Geen"
                className={cn(showForm && "invisible")}
            />
            {showForm && (
                <TableDateSelectorForm
                    fetcher={fetcher}
                    name={name}
                    value={value}
                    row={row}
                    required={required}
                    onHide={() => {
                        const currentState = useActiveTableFormStore.getState()
                        if (currentState.activeForm === cellId)
                            currentState.clearActiveForm()
                    }}
                />
            )}
        </Button>
    )
}
