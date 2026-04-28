import type { Row } from "@tanstack/react-table"
import { Controller, useForm } from "react-hook-form"
import { useFetcher } from "react-router"
import { RemixFormProvider } from "remix-hook-form"
import { cn } from "@/app/lib/utils"
import { useActiveTableFormStore } from "@/app/store/active-table-form"
import { Button } from "~/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import type { CropRow, FieldRow, RotationExtended } from "./columns"
import type { RotationTableFormSchemaType } from "./schema"

type AllowedFormSchemaType = Pick<RotationTableFormSchemaType, "b_lu_variety">
function TableVarietySelectorForm({
    name,
    value,
    row,
    b_lu_variety_options,
    onHide,
    fetcher,
}: {
    name: keyof AllowedFormSchemaType
    value: string[]
    row: Row<RotationExtended>
    b_lu_variety_options: { label: string; value: string }[]
    onHide?: () => unknown
    fetcher: ReturnType<typeof useFetcher>
}) {
    const form = useForm({
        defaultValues: {
            [name]: value[0],
        },
    })

    return (
        <div className="absolute top-1/2 left-1/2 -translate-1/2 flex flex-row items-center">
            <RemixFormProvider {...form}>
                <Controller
                    name={name as string}
                    disabled={
                        b_lu_variety_options.length === 0 ||
                        fetcher.state !== "idle"
                    }
                    render={({ field }) => (
                        <Select
                            defaultOpen={true}
                            onValueChange={(value) => {
                                const formValues = form.getValues()
                                if (formValues[name] !== value) {
                                    const fieldIds = (
                                        row.original.type === "crop"
                                            ? row.original.fields
                                            : [row.original]
                                    )
                                        .map((field) =>
                                            encodeURIComponent(field.b_id),
                                        )
                                        .join(",")
                                    const cultivationIds = encodeURIComponent(
                                        (
                                            (row.getParentRow()?.original ??
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
                            }}
                            value={field.value ?? undefined}
                            disabled={field.disabled}
                        >
                            <SelectTrigger disabled={!row.original.canModify}>
                                <SelectValue
                                    placeholder={
                                        b_lu_variety_options.length === 0
                                            ? "Geen varieteiten beschikbaar"
                                            : "Selecteer een variëteit"
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {b_lu_variety_options.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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

export function TableVarietySelector({
    name,
    row,
    cellId,
    canModify,
}: {
    name: keyof AllowedFormSchemaType
    row: Row<RotationExtended>
    cellId: string
    canModify: boolean
}) {
    const activeTableFormStore = useActiveTableFormStore()
    const fetcher = useFetcher()
    const varietyCounts =
        row.original.type === "field"
            ? // Return the variety counts directly
              row.original[name]
            : // Merge variety counts from each displayed field
              Object.entries(
                  (row.subRows ?? []).reduce(
                      (acc, fieldRow) => {
                          ;(fieldRow.original as FieldRow).b_lu_variety.forEach(
                              ([variety, count]) => {
                                  acc[variety] = (acc[variety] ?? 0) + count
                              },
                          )
                          return acc
                      },
                      {} as Record<string, number>,
                  ),
              ).sort((a, b) => b[1] - a[1])
    const value = varietyCounts.map((v) => v[0])

    const b_lu_variety_options = (
        (row.getParentRow() ?? row).original as CropRow
    ).b_lu_variety_options

    function renderText() {
        return (
            <span className="text-muted-foreground">
                {!b_lu_variety_options?.length
                    ? ""
                    : !value?.length
                      ? "niet aangegeven"
                      : value.length <= 5
                        ? value.join(", ")
                        : `${value.slice(0, 5).join(", ")} en meer`}
            </span>
        )
    }

    if (!canModify || !b_lu_variety_options?.length) {
        return renderText()
    }

    const showForm =
        fetcher.state !== "idle" || activeTableFormStore.activeForm === cellId
    return (
        <div className="relative text-center">
            <Button
                variant="link"
                className={cn(
                    "block px-0 max-w-2xs h-auto whitespace-break-spaces",
                    !value?.length && "text-muted-foreground",
                )}
                onClick={(e) => {
                    e.stopPropagation()
                    activeTableFormStore.setActiveForm(cellId)
                }}
            >
                <span className={cn(showForm && "invisible")}>
                    {renderText()}
                </span>
            </Button>
            {showForm && (
                <TableVarietySelectorForm
                    name={name}
                    value={value}
                    row={row}
                    b_lu_variety_options={b_lu_variety_options}
                    onHide={() => {
                        const currentState = useActiveTableFormStore.getState()
                        if (currentState.activeForm === cellId)
                            currentState.clearActiveForm()
                    }}
                    fetcher={fetcher}
                />
            )}
        </div>
    )
}
