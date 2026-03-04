import { zodResolver } from "@hookform/resolvers/zod"
import type { HarvestableAnalysis, HarvestParameters } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { CircleQuestionMark } from "lucide-react"
import { useEffect, useState } from "react"
import { Controller } from "react-hook-form"
import { Form, useFetcher, useNavigate } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import type { z } from "zod"
import { cn } from "@/app/lib/utils"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Button } from "~/components/ui/button"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "~/components/ui/collapsible"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSet,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { getHarvestParameterLabel } from "./parameters"
import { FormSchema } from "./schema"

type HarvestFormDialogProps = {
    harvestParameters: HarvestParameters
    exampleHarvestableAnalysis?: Partial<HarvestableAnalysis>
    example_b_lu_harvest_date?: Date | null
    b_lu_harvest_date: Date | string | null | undefined // Changed to allow Date or string
    b_lu_yield: number | undefined
    b_lu_yield_fresh: number | undefined
    b_lu_yield_bruto: number | undefined
    b_lu_tarra: number | undefined
    b_lu_uww: number | undefined
    b_lu_moist: number | undefined
    b_lu_dm: number | undefined
    b_lu_cp: number | undefined
    b_lu_n_harvestable: number | undefined
    b_lu_harvestable: "once" | "multiple" | "none"
    b_lu_start: Date | undefined | null
    b_lu_end: Date | undefined | null
    action?: string
    handleConfirmation?: (data: z.infer<typeof FormSchema>) => Promise<boolean>
    editable?: boolean
}

function useHarvestRemixForm({
    harvestParameters,
    b_lu_harvest_date,
    b_lu_yield,
    b_lu_yield_fresh,
    b_lu_yield_bruto,
    b_lu_tarra,
    b_lu_uww,
    b_lu_moist,
    b_lu_dm,
    b_lu_cp,
    b_lu_n_harvestable,
    b_lu_harvestable,
    b_lu_start,
    b_lu_end,
    example_b_lu_harvest_date,
    handleConfirmation,
}: HarvestFormDialogProps) {
    const form = useRemixForm<z.infer<typeof FormSchema>>({
        mode: "onSubmit",
        resolver: async (values, bypass, options) => {
            // Do the validation using Zod
            const validation = await zodResolver(FormSchema)(
                values,
                bypass,
                options,
            )
            // If there are validation errors anyways, just return them
            if (
                validation.errors &&
                Object.keys(validation.errors).length > 0
            ) {
                return validation
            }
            // If this was not a partial update and there were mandatory fields missing
            if (!example_b_lu_harvest_date) {
                if (!values.b_lu_harvest_date) {
                    return {
                        errors: {
                            b_lu_harvest_date: "Selecteer een oogstdatum",
                        },
                    }
                }
            }
            // If submitting, handle the confirmation procedure
            // (it might just return true without a dialog)
            if (
                form.formState.isSubmitting &&
                handleConfirmation &&
                !(await handleConfirmation(values))
            ) {
                return { values: {}, errors: true }
            }
            return validation
        },
        defaultValues: {
            b_lu_harvest_date: b_lu_harvest_date
                ? new Date(b_lu_harvest_date)
                : undefined,
            b_lu_yield: harvestParameters.includes("b_lu_yield")
                ? b_lu_yield
                : undefined,
            b_lu_yield_fresh: harvestParameters.includes("b_lu_yield_fresh")
                ? b_lu_yield_fresh
                : undefined,
            b_lu_yield_bruto: harvestParameters.includes("b_lu_yield_bruto")
                ? b_lu_yield_bruto
                : undefined,
            b_lu_tarra: harvestParameters.includes("b_lu_tarra")
                ? b_lu_tarra
                : undefined,
            b_lu_dm: harvestParameters.includes("b_lu_dm")
                ? b_lu_dm
                : undefined,
            b_lu_uww: harvestParameters.includes("b_lu_uww")
                ? b_lu_uww
                : undefined,
            b_lu_moist: harvestParameters.includes("b_lu_moist")
                ? b_lu_moist
                : undefined,
            b_lu_cp: harvestParameters.includes("b_lu_cp")
                ? b_lu_cp
                : undefined,
            b_lu_n_harvestable: harvestParameters.includes("b_lu_n_harvestable")
                ? b_lu_n_harvestable
                : undefined,
            b_lu_start: b_lu_start,
            b_lu_end: b_lu_end,
            b_lu_harvestable: b_lu_harvestable,
        },
    })

    return form
}

function HarvestFields({
    form,
    className,
    harvestParameters,
    exampleHarvestableAnalysis,
    example_b_lu_harvest_date,
    b_lu_harvest_date,
}: HarvestFormDialogProps & {
    form: ReturnType<typeof useHarvestRemixForm>
    className: React.ComponentProps<typeof FieldGroup>["className"]
}) {
    const formatted_b_lu_harvest_date = example_b_lu_harvest_date
        ? format(new Date(example_b_lu_harvest_date), "PP", { locale: nl })
        : undefined
    return (
        <FieldGroup className={cn("gap-5", className)}>
            <Controller
                name="b_lu_harvest_date"
                control={form.control}
                render={({ field, fieldState }) => (
                    <DatePicker
                        label="Oogstdatum"
                        placeholder={
                            example_b_lu_harvest_date !== undefined &&
                            example_b_lu_harvest_date !== null
                                ? `Er zijn verschillende waarden ingevuld, bv: ${formatted_b_lu_harvest_date}`
                                : undefined
                        }
                        defaultValue={
                            b_lu_harvest_date instanceof Date
                                ? b_lu_harvest_date
                                : b_lu_harvest_date
                                  ? new Date(b_lu_harvest_date)
                                  : undefined
                        }
                        field={{
                            ...field,
                            value: field.value,
                        }}
                        fieldState={fieldState}
                        required={true}
                    />
                )}
            />
            <Controller
                name="b_lu_yield"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field
                        data-invalid={fieldState.invalid}
                        className={cn(
                            "gap-1",
                            harvestParameters.includes(field.name)
                                ? ""
                                : "hidden",
                        )}
                    >
                        <FieldLabel>
                            {getHarvestParameterLabel(field.name)}
                        </FieldLabel>
                        <Input
                            {...field}
                            placeholder={
                                Number.isFinite(
                                    exampleHarvestableAnalysis?.b_lu_yield,
                                )
                                    ? `Er zijn verschillende waarden ingevuld, bv: ${exampleHarvestableAnalysis?.b_lu_yield} kg / ha`
                                    : "Bv. 37500 kg / ha"
                            }
                            aria-required="true"
                            aria-invalid={fieldState.invalid}
                            type="number"
                            value={field.value ?? ""}
                        />
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />

            <Controller
                name="b_lu_yield_fresh"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field
                        data-invalid={fieldState.invalid}
                        className={cn(
                            "gap-1",
                            harvestParameters.includes(field.name)
                                ? ""
                                : "hidden",
                        )}
                    >
                        <FieldLabel>
                            {getHarvestParameterLabel(field.name)}
                        </FieldLabel>
                        <Input
                            {...field}
                            placeholder={
                                Number.isFinite(
                                    exampleHarvestableAnalysis?.b_lu_yield_fresh,
                                )
                                    ? `Er zijn verschillende waarden ingevuld, bv: ${exampleHarvestableAnalysis?.b_lu_yield_fresh} kg / ha`
                                    : "Bv. 37500 kg / ha"
                            }
                            aria-required="true"
                            aria-invalid={fieldState.invalid}
                            type="number"
                            value={field.value ?? ""}
                        />
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
            <Controller
                name="b_lu_yield_bruto"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field
                        data-invalid={fieldState.invalid}
                        className={cn(
                            "gap-1",
                            harvestParameters.includes(field.name)
                                ? ""
                                : "hidden",
                        )}
                    >
                        <FieldLabel>
                            {getHarvestParameterLabel(field.name)}
                        </FieldLabel>
                        <Input
                            {...field}
                            placeholder={
                                Number.isFinite(
                                    exampleHarvestableAnalysis?.b_lu_yield_bruto,
                                )
                                    ? `Er zijn verschillende waarden ingevuld, bv: ${exampleHarvestableAnalysis?.b_lu_yield_bruto} kg / ha`
                                    : "Bv. 37500 kg / ha"
                            }
                            aria-required="true"
                            aria-invalid={fieldState.invalid}
                            type="number"
                            value={field.value ?? ""}
                        />
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
            <Controller
                name="b_lu_tarra"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field
                        data-invalid={fieldState.invalid}
                        className={cn(
                            "gap-1",
                            harvestParameters.includes(field.name)
                                ? ""
                                : "hidden",
                        )}
                    >
                        <FieldLabel>
                            {" "}
                            {getHarvestParameterLabel(field.name)}
                        </FieldLabel>
                        <Input
                            {...field}
                            placeholder={
                                Number.isFinite(
                                    exampleHarvestableAnalysis?.b_lu_tarra,
                                )
                                    ? `Er zijn verschillende waarden ingevuld, bv: ${exampleHarvestableAnalysis?.b_lu_tarra} %`
                                    : "Bv. 5 %"
                            }
                            aria-required="true"
                            aria-invalid={fieldState.invalid}
                            type="number"
                            value={field.value ?? ""}
                        />
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
            <Controller
                name="b_lu_dm"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field
                        data-invalid={fieldState.invalid}
                        className={cn(
                            "gap-1",
                            harvestParameters.includes(field.name)
                                ? ""
                                : "hidden",
                        )}
                    >
                        <FieldLabel>
                            {getHarvestParameterLabel(field.name)}
                        </FieldLabel>
                        <Input
                            {...field}
                            placeholder={
                                Number.isFinite(
                                    exampleHarvestableAnalysis?.b_lu_dm,
                                )
                                    ? `Er zijn verschillende waarden ingevuld, bv: ${exampleHarvestableAnalysis?.b_lu_dm} g / kg`
                                    : "Bv. 850 g / kg"
                            }
                            aria-required="true"
                            aria-invalid={fieldState.invalid}
                            type="number"
                            value={field.value ?? ""}
                        />
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
            <Controller
                name="b_lu_uww"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field
                        data-invalid={fieldState.invalid}
                        className={cn(
                            "gap-1",
                            harvestParameters.includes(field.name)
                                ? ""
                                : "hidden",
                        )}
                    >
                        <FieldLabel>
                            {getHarvestParameterLabel(field.name)}
                        </FieldLabel>
                        <Input
                            {...field}
                            placeholder={
                                Number.isFinite(
                                    exampleHarvestableAnalysis?.b_lu_uww,
                                )
                                    ? `Er zijn verschillende waarden ingevuld, bv: ${exampleHarvestableAnalysis?.b_lu_uww} g / 5 kg`
                                    : "Bv. 350 g / 5 kg"
                            }
                            aria-required="true"
                            aria-invalid={fieldState.invalid}
                            type="number"
                            value={field.value ?? ""}
                        />
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
            <Controller
                name="b_lu_moist"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field
                        data-invalid={fieldState.invalid}
                        className={cn(
                            "gap-1",
                            harvestParameters.includes(field.name)
                                ? ""
                                : "hidden",
                        )}
                    >
                        <FieldLabel>
                            {getHarvestParameterLabel(field.name)}
                        </FieldLabel>
                        <Input
                            {...field}
                            placeholder={
                                Number.isFinite(
                                    exampleHarvestableAnalysis?.b_lu_moist,
                                )
                                    ? `Er zijn verschillende waarden ingevuld, bv: ${exampleHarvestableAnalysis?.b_lu_moist} %`
                                    : "Bv. 15 %"
                            }
                            aria-required="true"
                            aria-invalid={fieldState.invalid}
                            type="number"
                            value={field.value ?? ""}
                        />
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
            <Controller
                name="b_lu_n_harvestable"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field
                        data-invalid={fieldState.invalid}
                        className={cn(
                            "gap-1",
                            harvestParameters.includes(field.name)
                                ? ""
                                : "hidden",
                        )}
                    >
                        <FieldLabel>
                            {getHarvestParameterLabel(field.name)}
                        </FieldLabel>
                        <Input
                            {...field}
                            placeholder={
                                Number.isFinite(
                                    exampleHarvestableAnalysis?.b_lu_n_harvestable,
                                )
                                    ? `Er zijn verschillende waarden ingevuld, bv: ${exampleHarvestableAnalysis?.b_lu_n_harvestable} g / kg`
                                    : "Bv. 850 g / kg"
                            }
                            aria-required="true"
                            aria-invalid={fieldState.invalid}
                            type="number"
                            value={field.value ?? ""}
                        />
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
            <Controller
                name="b_lu_cp"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field
                        data-invalid={fieldState.invalid}
                        className={cn(
                            "gap-1",
                            harvestParameters.includes(field.name)
                                ? ""
                                : "hidden",
                        )}
                    >
                        <FieldLabel>
                            {getHarvestParameterLabel(field.name)}
                        </FieldLabel>
                        <Input
                            {...field}
                            placeholder={
                                Number.isFinite(
                                    exampleHarvestableAnalysis?.b_lu_cp,
                                )
                                    ? `Er zijn verschillende waarden ingevuld, bv: ${exampleHarvestableAnalysis?.b_lu_cp} g RE / kg DS`
                                    : "Bv. 170 g RE / kg DS"
                            }
                            aria-required="true"
                            aria-invalid={fieldState.invalid}
                            type="number"
                            value={field.value ?? ""}
                        />
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
        </FieldGroup>
    )
}

function HarvestFormExplainer() {
    const [hostname, setHostname] = useState("")
    useEffect(() => {
        if (typeof window !== "undefined") {
            setHostname(window.location.hostname)
        }
    }, [])

    return (
        <FieldGroup>
            <Collapsible className="space-y-2">
                <CollapsibleTrigger
                    type="button"
                    className="flex flex-row gap-1 items-center text-xs text-muted-foreground hover:underline"
                >
                    <CircleQuestionMark className="h-4" />
                    <p>Waarom zie ik deze oogstparameters?</p>
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-row gap-1 items-center text-xs text-muted-foreground">
                    <p>
                        De getoonde oogstparameters zijn gebaseerd op de meest
                        gangbare praktijkgegevens voor dit gewas. Deze waarden
                        zijn nodig voor een nauwkeurige
                        stikstofbalansberekening. Komen deze niet overeen met uw
                        eigen metingen? Stuur dan een e-mail naar{" "}
                        <a
                            href={`mailto:support@${hostname}`}
                            className="underline"
                        >
                            support@
                            {hostname}
                        </a>{" "}
                        met welke parameters volgens u gemeten worden voor dit
                        gewas. Alvast bedankt!
                    </p>
                </CollapsibleContent>
            </Collapsible>
        </FieldGroup>
    )
}
export function HarvestFormDialog(props: HarvestFormDialogProps) {
    const { b_lu_harvest_date, action, editable = true } = props
    const navigate = useNavigate()
    const fetcher = useFetcher()
    const form = useHarvestRemixForm(props)

    const handleDeleteHarvest = () => {
        return fetcher.submit(null, { method: "DELETE", action: action })
    }

    // Check if this is a new harvest or is has already values
    const isHarvestUpdate = b_lu_harvest_date !== undefined

    return (
        <Dialog open={true} onOpenChange={() => navigate("..")}>
            <RemixFormProvider {...form}>
                <Form
                    id="formHarvest"
                    onSubmit={form.handleSubmit}
                    method="post"
                    action={action}
                >
                    <DialogContent className="gap-6">
                        <DialogHeader>
                            <DialogTitle>
                                {isHarvestUpdate
                                    ? "Oogst bijwerken"
                                    : "Oogst toevoegen"}
                            </DialogTitle>
                            <DialogDescription>
                                {isHarvestUpdate
                                    ? "Werk de oogst bij van dit gewas. Vul de gegevens in, zodat deze gebruikt kunnen worden in de berekeningen."
                                    : "Voeg een oogst toe aan dit gewas. Vul de gegevens in, zodat deze gebruikt kunnen worden in de berekeningen."}
                            </DialogDescription>
                        </DialogHeader>
                        <FieldSet
                            disabled={
                                !editable ||
                                form.formState.isSubmitting ||
                                fetcher.state !== "idle"
                            }
                        >
                            <HarvestFields {...props} form={form} />
                        </FieldSet>
                        <HarvestFormExplainer />
                        <DialogFooter>
                            <Field orientation="horizontal">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleDeleteHarvest}
                                    disabled={
                                        form.formState.isSubmitting ||
                                        fetcher.state !== "idle"
                                    }
                                    className={cn(
                                        "mr-auto",
                                        !editable || !isHarvestUpdate
                                            ? "invisible"
                                            : "",
                                    )}
                                >
                                    {fetcher.state !== "idle" ? (
                                        <div className="flex items-center space-x-2">
                                            <Spinner />
                                        </div>
                                    ) : null}
                                    Verwijderen
                                </Button>
                                <DialogClose asChild>
                                    <Button
                                        variant="outline"
                                        disabled={
                                            form.formState.isSubmitting ||
                                            fetcher.state !== "idle"
                                        }
                                    >
                                        Sluiten
                                    </Button>
                                </DialogClose>
                                <Button
                                    type="submit"
                                    form="formHarvest"
                                    disabled={
                                        form.formState.isSubmitting ||
                                        fetcher.state !== "idle"
                                    }
                                    className={cn(!editable ? "invisible" : "")}
                                >
                                    {form.formState.isSubmitting ? (
                                        <div className="flex items-center space-x-2">
                                            <Spinner />
                                            <p>Opslaan...</p>
                                        </div>
                                    ) : isHarvestUpdate ? (
                                        "Bijwerken"
                                    ) : (
                                        "Toevoegen"
                                    )}
                                </Button>
                            </Field>
                        </DialogFooter>
                    </DialogContent>
                </Form>
            </RemixFormProvider>
        </Dialog>
    )
}

export function HarvestForm(props: HarvestFormDialogProps) {
    const { b_lu_harvest_date, action, editable = true } = props
    const fetcher = useFetcher()

    const form = useHarvestRemixForm(props)

    const handleDeleteHarvest = () => {
        return fetcher.submit(null, { method: "DELETE", action: action })
    }

    // Check if this is a new harvest or is has already values
    const isHarvestUpdate = b_lu_harvest_date !== undefined

    return (
        <div className="space-y-6">
            <RemixFormProvider {...form}>
                <Form
                    id="formHarvest"
                    onSubmit={form.handleSubmit}
                    method="post"
                    action={action}
                >
                    <fieldset
                        disabled={
                            !editable ||
                            form.formState.isSubmitting ||
                            fetcher.state !== "idle"
                        }
                        className="space-y-8"
                    >
                        <HarvestFields
                            {...props}
                            form={form}
                            className="grid lg:grid-cols-2 items-center gap-y-6 gap-x-8"
                        />
                        <HarvestFormExplainer />
                        <div className="grid grid-cols-2 items">
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDeleteHarvest}
                                disabled={
                                    form.formState.isSubmitting ||
                                    fetcher.state !== "idle"
                                }
                                className={cn(
                                    "mr-auto",
                                    !editable || !isHarvestUpdate
                                        ? "invisible"
                                        : "",
                                )}
                            >
                                {form.formState.isSubmitting ||
                                fetcher.state !== "idle" ? (
                                    <div className="flex items-center space-x-2">
                                        <Spinner />
                                    </div>
                                ) : null}
                                Verwijderen
                            </Button>
                            <Button
                                type="submit"
                                className="ml-auto"
                                disabled={
                                    form.formState.isSubmitting ||
                                    fetcher.state !== "idle"
                                }
                            >
                                {form.formState.isSubmitting ? (
                                    <div className="flex items-center space-x-2">
                                        <Spinner />
                                        <span>Opslaan...</span>
                                    </div>
                                ) : isHarvestUpdate ? (
                                    "Bijwerken"
                                ) : (
                                    "Toevoegen"
                                )}
                            </Button>
                        </div>
                    </fieldset>
                </Form>
            </RemixFormProvider>
        </div>
    )
}
