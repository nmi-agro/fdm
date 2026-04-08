import { zodResolver } from "@hookform/resolvers/zod"
import type { AppAmountUnit } from "@nmi-agro/fdm-core"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { Plus } from "lucide-react"
import type { MouseEvent } from "react"
import { useEffect, useId, useState } from "react"
import { Controller } from "react-hook-form"
import type { Navigation } from "react-router"
import { Form, useNavigate, useSearchParams } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { useFieldFertilizerFormStore } from "@/app/store/field-fertilizer-form"
import { Combobox } from "~/components/custom/combobox"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Button } from "~/components/ui/button"
import { Field, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { getContextualDate } from "~/lib/calendar"
import { useCalendarStore } from "~/store/calendar"
import {
    type FieldFertilizerFormValues,
    FormSchema,
    FormSchemaModify,
    type FormSchemaPartial,
} from "./formschema"

export type FertilizerOption = {
    value: string
    label: string
    applicationMethodOptions?: { value: string; label: string }[]
    p_app_amount_unit: AppAmountUnit
}

/**
 * Renders a fertilizer application creation or modification form.
 *
 * The form contains fields for the fertilizer applied, the application method, the amount, and the application date.
 *
 * It accepts two partial FieldFertilizerFormValues objects to pre-fill the form and set the placeholders.
 * - The fields are pre-filled according to the fertilizerApplication prop value. If it is missing, all form fields are left empty. fertilizerApplication cannot be used to drive the form state.
 * - The placeholders will be set according to the exampleFertilizerApplication prop value. If it is missing, the default placeholders are used for all form fields.
 */
export function FertilizerApplicationForm<T extends typeof FormSchemaPartial>({
    options,
    action,
    navigation,
    b_id_farm,
    b_id_or_b_lu_catalogue,
    fertilizerApplication,
    exampleFertilizerApplication,
    schema,
}: {
    options: FertilizerOption[]
    action: string
    navigation: Navigation
    b_id_farm: string
    b_id_or_b_lu_catalogue: string
    fertilizerApplication?:
        | Partial<FieldFertilizerFormValues>
        | null
        | undefined
    exampleFertilizerApplication?:
        | Partial<FieldFertilizerFormValues>
        | null
        | undefined
    schema?: T
}) {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const formId = useId()
    const { calendar } = useCalendarStore()
    const form = useRemixForm<FieldFertilizerFormValues>({
        mode: "onTouched",
        resolver: zodResolver(
            schema ?? (fertilizerApplication ? FormSchemaModify : FormSchema),
        ),
        defaultValues: {
            p_app_id: fertilizerApplication?.p_app_ids
                ? fertilizerApplication.p_app_ids.join(",")
                : fertilizerApplication?.p_app_id,
            p_id: fertilizerApplication?.p_id,
            p_app_method: fertilizerApplication?.p_app_method,
            p_app_amount_display: undefined, // Handled through an effect due to blank behavior
            p_app_date: fertilizerApplication?.p_app_date
                ? fertilizerApplication.p_app_date
                : exampleFertilizerApplication
                  ? undefined
                  : getContextualDate(calendar, 3, 1),
        },
        submitConfig: {
            method: fertilizerApplication ? "PUT" : "POST",
        },
    })
    const p_id = form.watch("p_id")
    const selectedFertilizer = options.find((option) => option.value === p_id)
    const isSubmitting = navigation.state !== "idle"

    // Conversion factor used to transform the application amount when the user changes the fertilizer
    // It is also used to show a more helpful application amount example
    // 1 kg/L fertilizer density is assumed
    const conversionFactors = {
        "kg/ha": 1000,
        "ton/ha": 1,
        "l/ha": 1000,
        "m3/ha": 1,
    } as const

    // If the user switched the fertilizer, clear the application method
    useEffect(() => {
        if (
            p_id &&
            (!fertilizerApplication || fertilizerApplication.p_id !== p_id)
        ) {
            form.setValue("p_app_method", "")
        }
    }, [p_id, fertilizerApplication, form.setValue])

    useEffect(() => {
        const currentValue = form.getValues("p_app_date")
        const { isDirty } = form.getFieldState("p_app_date")
        if (
            !fertilizerApplication?.p_app_date &&
            !exampleFertilizerApplication &&
            !currentValue &&
            !isDirty
        ) {
            form.setValue("p_app_date", getContextualDate(calendar, 3, 1))
        }
    }, [
        calendar,
        exampleFertilizerApplication,
        fertilizerApplication?.p_app_date,
        form.setValue,
        form.getValues,
        form.getFieldState,
    ])

    const fieldFertilizerFormStore = useFieldFertilizerFormStore()

    // If the user had a saved fertilizer form and was creating a new fertilizer, fill the form back in
    useEffect(() => {
        if (b_id_farm && b_id_or_b_lu_catalogue) {
            const savedFormValues = fieldFertilizerFormStore.load(
                b_id_farm,
                b_id_or_b_lu_catalogue,
                calendar,
            )
            if (savedFormValues) {
                for (const [k, v] of Object.entries(savedFormValues)) {
                    if (typeof v === "undefined" || v === null) continue
                    const hydrated =
                        k === "p_app_date" && v
                            ? new Date(v as any)
                            : (v as any)
                    form.setValue(k as any, hydrated)
                }
            }
        }
    }, [
        b_id_farm,
        b_id_or_b_lu_catalogue,
        form.setValue,
        fieldFertilizerFormStore.load,
        calendar,
    ])

    useEffect(() => {
        const p_app_amount_display = fertilizerApplication?.p_app_amount_display
        if (
            p_app_amount_display !== null &&
            typeof p_app_amount_display !== "undefined"
        ) {
            form.setValue(
                "p_app_amount_display",
                Math.round(100 * p_app_amount_display) / 100,
            )
        }
    }, [p_id, fertilizerApplication?.p_app_amount_display, form.setValue])

    // Transform the application amount based on the changing application units
    const currentApplicationUnit =
        options.find((opt) => opt.value === p_id)?.p_app_amount_unit ?? "kg/ha"
    console.log(currentApplicationUnit)
    const currentConversionFactor = conversionFactors[currentApplicationUnit]
    const [lastConversionFactor, setLastConversionFactor] = useState(
        currentConversionFactor,
    )
    useEffect(() => {
        console.log(form.getValues())
        const p_app_amount_display = form.getValues().p_app_amount_display
        if (currentConversionFactor !== lastConversionFactor) {
            if (p_app_amount_display !== undefined) {
                form.setValue(
                    "p_app_amount_display",
                    Math.round(
                        (100 *
                            (p_app_amount_display * currentConversionFactor)) /
                            lastConversionFactor,
                    ) / 100,
                )
                setLastConversionFactor(currentConversionFactor)
            }
        }
    }, [form, lastConversionFactor, currentConversionFactor])

    // Change fertilizer selection if the user has added a new fertilizer
    const new_p_id = searchParams.get("p_id")
    useEffect(() => {
        if (new_p_id) {
            form.setValue("p_id", new_p_id)
        }
    }, [new_p_id, form.setValue])

    useEffect(() => {
        if (form.formState.isSubmitSuccessful) {
            fieldFertilizerFormStore.delete(
                b_id_farm,
                b_id_or_b_lu_catalogue,
                calendar,
            )
        }
    }, [
        form.formState.isSubmitSuccessful,
        b_id_farm,
        b_id_or_b_lu_catalogue,
        fieldFertilizerFormStore.delete,
        calendar,
    ])

    function handleManageFertilizers(_e: MouseEvent<HTMLButtonElement>) {
        if (b_id_farm && b_id_or_b_lu_catalogue) {
            fieldFertilizerFormStore.save(
                b_id_farm,
                b_id_or_b_lu_catalogue,
                form.getValues(),
                calendar,
            )
        }
        navigate(
            `/farm/${b_id_farm}/fertilizers/new?returnUrl=${encodeURIComponent(`${location.pathname}${location.search}`)}`,
        )
    }

    return (
        <RemixFormProvider {...form}>
            <Form
                id={formId}
                action={action}
                onSubmit={form.handleSubmit}
                method="post"
            >
                <fieldset disabled={isSubmitting}>
                    <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-x-8 gap-y-4">
                        <div className="flex flex-row align-top min-w-0">
                            <div className="min-w-0 flex-1">
                                <Combobox
                                    options={options}
                                    form={form}
                                    name="p_id"
                                    label={
                                        <span>
                                            Meststof
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </span>
                                    }
                                    defaultValue={fertilizerApplication?.p_id}
                                />
                            </div>
                            <div className="space-y-2 shrink-0 grow-0">
                                <Label className="invisible">&nbsp;</Label>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="ml-2"
                                            onClick={handleManageFertilizers}
                                        >
                                            <Plus className="size-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        Voeg een nieuwe meststof toe
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </div>
                        <Controller
                            name="p_app_method"
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    className="gap-1"
                                >
                                    <FieldLabel>Toedieningsmethode</FieldLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value ?? ""}
                                        disabled={!selectedFertilizer}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecteer een methode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectedFertilizer?.applicationMethodOptions?.map(
                                                (option) => (
                                                    <SelectItem
                                                        key={option.value}
                                                        value={option.value}
                                                    >
                                                        {option.label}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="p_app_amount_display"
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    className="gap-1"
                                >
                                    <FieldLabel>
                                        Hoeveelheid ({currentApplicationUnit})
                                    </FieldLabel>
                                    <Input
                                        {...field}
                                        placeholder={
                                            Number.isFinite(
                                                exampleFertilizerApplication?.p_app_amount_display,
                                            )
                                                ? `Er zijn verschillende waarden ingevuld, bv: ${exampleFertilizerApplication?.p_app_amount_display}`
                                                : `Bv. ${37.5 * currentConversionFactor} ${currentApplicationUnit}`
                                        }
                                        aria-required="true"
                                        aria-invalid={fieldState.invalid}
                                        type="number"
                                        value={
                                            field.value === undefined ||
                                            field.value === null ||
                                            Number.isNaN(
                                                Number.parseFloat(
                                                    String(field.value),
                                                ),
                                            )
                                                ? ""
                                                : field.value
                                        }
                                        onChange={(e) => {
                                            const val = e.target.value
                                            if (val === "") {
                                                field.onChange(undefined)
                                            } else {
                                                field.onChange(
                                                    Number.parseFloat(val),
                                                )
                                            }
                                        }}
                                    />
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="p_app_date"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <DatePicker
                                    label="Datum"
                                    placeholder={
                                        exampleFertilizerApplication?.p_app_date
                                            ? `Er zijn verschillende waarden ingevuld, bv: ${formatDate(exampleFertilizerApplication.p_app_date, "PP", { locale: nl })}`
                                            : undefined
                                    }
                                    defaultValue={
                                        fertilizerApplication?.p_app_date
                                    }
                                    field={{
                                        ...field,
                                        value: field.value,
                                    }}
                                    fieldState={fieldState}
                                />
                            )}
                        />
                        <div className="invisible" />
                        <div className="ml-auto">
                            <Button type="submit">
                                {isSubmitting ? (
                                    <div className="flex items-center space-x-2">
                                        <Spinner />
                                        <span>Opslaan...</span>
                                    </div>
                                ) : fertilizerApplication ? (
                                    "Opslaan"
                                ) : (
                                    "Voeg toe"
                                )}
                            </Button>
                        </div>
                    </div>
                </fieldset>
            </Form>
        </RemixFormProvider>
    )
}
