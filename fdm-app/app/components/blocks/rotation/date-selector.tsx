import type { Row } from "@tanstack/react-table"
import { Controller, useForm } from "react-hook-form"
import { useFetcher } from "react-router"
import { RemixFormProvider } from "remix-hook-form"
import { cn } from "@/app/lib/utils"
import { useActiveTableFormStore } from "@/app/store/active-table-form"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { DatePicker } from "../../custom/date-picker-v2"
import type { CropRow, RotationExtended } from "./columns"
import { DateRangeDisplay } from "./date-range-display"
import type { RotationTableFormSchemaType } from "./schema"

type AllowedFormSchemaType = Pick<
    RotationTableFormSchemaType,
    "b_lu_start" | "b_lu_end"
>
function TableDateSelectorForm({
    fetcher,
    name,
    row,
    onHide,
}: {
    fetcher: ReturnType<typeof useFetcher>
    name: keyof AllowedFormSchemaType
    row: Row<RotationExtended>
    onHide?: () => unknown
}) {
    const value = row.original[name]
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
                            field={{
                                ...field,
                                onChange: (value) => {
                                    const formValues = form.getValues()
                                    if (formValues[name as string] !== value) {
                                        const fieldIds = (
                                            row.original.type === "crop"
                                                ? row.original.fields
                                                : [row.original]
                                        )
                                            .map((field) =>
                                                encodeURIComponent(field.b_id),
                                            )
                                            .join(",")
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
}: {
    name: keyof AllowedFormSchemaType
    row: Row<RotationExtended>
    cellId: string
}) {
    const fetcher = useFetcher()
    const activeTableFormStore = useActiveTableFormStore()
    const value = row.original[name]

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
                    row={row}
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
