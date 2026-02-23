import { zodResolver } from "@hookform/resolvers/zod"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { Plus } from "lucide-react"
import type { MouseEvent } from "react"
import { useEffect, useId } from "react"
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
import {
    type FieldFertilizerFormValues,
    FormSchema,
    FormSchemaModify,
} from "./formschema"

export type FertilizerOption = {
    value: string
    label: string
    applicationMethodOptions?: { value: string; label: string }[]
}

export function FertilizerApplicationForm({
    options,
    action,
    navigation,
    b_id_farm,
    b_id_or_b_lu_catalogue,
    fertilizerApplication,
    exampleFertilizerApplication,
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
}) {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const formId = useId()
    const form = useRemixForm<FieldFertilizerFormValues>({
        mode: "onTouched",
        resolver: zodResolver(
            fertilizerApplication ? FormSchemaModify : FormSchema,
        ),
        defaultValues: {
            p_app_id: fertilizerApplication?.p_app_ids
                ? fertilizerApplication.p_app_ids.join(",")
                : fertilizerApplication?.p_app_id,
            p_id: fertilizerApplication?.p_id,
            p_app_method: fertilizerApplication?.p_app_method,
            p_app_amount: undefined, // Handled through an effect due to blank behavior
            p_app_date: fertilizerApplication?.p_app_date ?? new Date(),
        },
        submitConfig: {
            method: fertilizerApplication ? "PUT" : "POST",
        },
    })
    const p_id = form.watch("p_id")
    const selectedFertilizer = options.find((option) => option.value === p_id)
    const isSubmitting = navigation.state === "submitting"

    useEffect(() => {
        if (
            p_id &&
            (!fertilizerApplication || fertilizerApplication.p_id !== p_id)
        ) {
            form.setValue("p_app_method", "")
        }
    }, [p_id, fertilizerApplication, form.setValue])

    const fieldFertilizerFormStore = useFieldFertilizerFormStore()

    useEffect(() => {
        if (b_id_farm && b_id_or_b_lu_catalogue) {
            const savedFormValues = fieldFertilizerFormStore.load(
                b_id_farm,
                b_id_or_b_lu_catalogue,
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
    ])

    useEffect(() => {
        if (fertilizerApplication?.p_app_amount) {
            form.setValue("p_app_amount", fertilizerApplication.p_app_amount)
        }
    }, [fertilizerApplication, form.setValue])

    // Change fertilizer selection if the user has added a new fertilizer
    const new_p_id = searchParams.get("p_id")
    useEffect(() => {
        if (new_p_id) {
            form.setValue("p_id", new_p_id)
        }
    }, [new_p_id, form.setValue])

    useEffect(() => {
        if (form.formState.isSubmitSuccessful) {
            fieldFertilizerFormStore.delete(b_id_farm, b_id_or_b_lu_catalogue)
        }
    }, [
        form.formState.isSubmitSuccessful,
        b_id_farm,
        b_id_or_b_lu_catalogue,
        fieldFertilizerFormStore.delete,
    ])

    function handleManageFertilizers(_e: MouseEvent<HTMLButtonElement>) {
        if (b_id_farm && b_id_or_b_lu_catalogue) {
            fieldFertilizerFormStore.save(
                b_id_farm,
                b_id_or_b_lu_catalogue,
                form.getValues(),
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
                            name="p_app_amount"
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    className="gap-1"
                                >
                                    <FieldLabel>Hoeveelheid</FieldLabel>
                                    <Input
                                        {...field}
                                        placeholder={
                                            Number.isFinite(
                                                exampleFertilizerApplication?.p_app_amount,
                                            )
                                                ? `Er zijn verschillende waarden ingevuld, bv: ${exampleFertilizerApplication?.p_app_amount} kg/ha`
                                                : "Bv. 37500 kg / ha"
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
                                <Field
                                    data-invalid={fieldState.invalid}
                                    className="gap-1"
                                >
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
                                        required={true}
                                    />
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
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
