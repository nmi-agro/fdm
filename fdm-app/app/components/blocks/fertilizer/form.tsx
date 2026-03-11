import type { FertilizerParameters } from "@nmi-agro/fdm-core"
import { Copy, InfoIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Form, NavLink, useParams } from "react-router"
import { Controller } from "react-hook-form"
import { RemixFormProvider, type useRemixForm } from "remix-hook-form"
import type { z } from "zod"
import { FormSchema } from "~/components/blocks/fertilizer/formschema"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { cn } from "~/lib/utils"

export interface FertilizerParameterDescriptionItem {
    parameter: FertilizerParameters
    unit: string
    type: "numeric" | "enum" | "date" | "text" | "enum_multi"
    name: string
    description: string
    category:
        | "general"
        | "primary"
        | "secondary"
        | "trace"
        | "heavy_metals"
        | "physical"
    min?: number
    max?: number
    options?: { label: string; value: string }[]
}

export type FertilizerParameterDescription =
    FertilizerParameterDescriptionItem[]

type FormSchemaKeys = keyof z.infer<typeof FormSchema>

type FertilizerFormNewProps = {
    fertilizerParameters: FertilizerParameterDescription
    form: ReturnType<typeof useRemixForm<z.infer<typeof FormSchema>>>
    editable?: boolean
    p_type?: "manure" | "compost" | "mineral" | null
    rvoLabels?: Record<string, string>
    rvoToType?: Record<string, string>
}

export function FertilizerForm({
    fertilizerParameters,
    form,
    editable = true,
    p_type: initialType,
    rvoLabels,
    rvoToType,
}: FertilizerFormNewProps) {
    const { p_id, b_id_farm } = useParams()
    const formValues = form.watch()
    const sidebarButtonRef = useRef<HTMLDivElement>(null)
    const [isSidebarButtonVisible, setIsSidebarButtonVisible] = useState(true)

    // Dynamic type based on current RVO code
    const currentType =
        (formValues.p_type_rvo && rvoToType?.[formValues.p_type_rvo]) ||
        initialType

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsSidebarButtonVisible(entry.isIntersecting)
            },
            { threshold: 0.1 },
        )

        if (sidebarButtonRef.current) {
            observer.observe(sidebarButtonRef.current)
        }

        return () => observer.disconnect()
    }, [])

    const categories = [
        { name: "general", title: "Algemeen" },
        { name: "primary", title: "Primaire nutriënten" },
        { name: "secondary", title: "Secundaire nutriënten" },
        { name: "physical", title: "Fysische eigenschappen" },
        { name: "trace", title: "Sporenelementen" },
    ]

    const getParameterInput = (param: FertilizerParameterDescriptionItem) => {
        if (
            param.parameter === "p_source" ||
            param.parameter === "p_id_catalogue" ||
            param.parameter === "p_app_method_options"
        ) {
            return null
        }

        const unit = param.unit === "kg/ton" ? "g/kg" : param.unit

        return (
            <Controller
                key={param.parameter}
                control={form.control}
                name={param.parameter as FormSchemaKeys}
                render={({ field, fieldState }) => (
                    <Field
                        data-invalid={fieldState.invalid}
                        className="gap-1.5"
                    >
                        <FieldLabel className="text-sm font-medium">
                            {param.name} {unit && `(${unit})`}
                        </FieldLabel>
                        {param.type === "numeric" ? (
                            <Input
                                type="number"
                                min={param.min}
                                max={param.max}
                                step={"any"}
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                    field.onChange(
                                        e.target.value === ""
                                            ? null
                                            : Number.parseFloat(e.target.value),
                                    )
                                }
                                disabled={!editable}
                                className="h-9"
                            />
                        ) : param.type === "text" ? (
                            <Input
                                type="text"
                                {...field}
                                value={field.value ?? ""}
                                disabled={!editable}
                                className="h-9"
                            />
                        ) : param.type === "enum" ? (
                            <Select
                                onValueChange={field.onChange}
                                value={
                                    field.value
                                        ? String(field.value)
                                        : undefined
                                }
                                disabled={!editable}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Selecteer..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {param.options?.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {`${option.label} (${option.value})`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : null}
                        {param.description && (
                            <FieldDescription
                                title={param.description}
                                className="line-clamp-1 text-[10px]"
                            >
                                {param.description}
                            </FieldDescription>
                        )}
                        {fieldState.invalid && (
                            <FieldError
                                errors={[
                                    { message: fieldState.error?.message },
                                ]}
                            />
                        )}
                    </Field>
                )}
            />
        )
    }

    const getAppMethodInput = (
        param: FertilizerParameterDescriptionItem | undefined,
    ) => {
        if (!param) return null

        return (
            <div className="mt-6 pt-4 border-t">
                <div className="mb-2">
                    <FieldLabel className="text-base font-semibold">
                        {param.name}
                    </FieldLabel>
                    {param.description && (
                        <FieldDescription className="mt-0.5">
                            {param.description}
                        </FieldDescription>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                    {param.options?.map((option) => (
                        <Controller
                            key={option.value}
                            control={form.control}
                            name={param.parameter as FormSchemaKeys}
                            render={({ field, fieldState }) => (
                                <Field
                                    orientation="horizontal"
                                    data-invalid={fieldState.invalid}
                                    className="items-center gap-2 py-0.5"
                                >
                                    <Checkbox
                                        id={`method-${option.value}`}
                                        disabled={!editable}
                                        checked={
                                            Array.isArray(field.value) &&
                                            field.value.includes(option.value)
                                        }
                                        onCheckedChange={(checked) => {
                                            const currentValues = Array.isArray(
                                                field.value,
                                            )
                                                ? field.value
                                                : []
                                            if (checked) {
                                                field.onChange([
                                                    ...currentValues,
                                                    option.value,
                                                ])
                                            } else {
                                                field.onChange(
                                                    currentValues.filter(
                                                        (value) =>
                                                            value !==
                                                            option.value,
                                                    ),
                                                )
                                            }
                                        }}
                                    />
                                    <FieldLabel
                                        htmlFor={`method-${option.value}`}
                                        className="font-normal cursor-pointer text-sm py-1"
                                    >
                                        {option.label}
                                    </FieldLabel>
                                </Field>
                            )}
                        />
                    ))}
                </div>
                {form.formState.errors[param.parameter as keyof typeof form.formState.errors] && (
                    <FieldError
                        className="mt-2"
                        errors={[
                            {
                                message: (form.formState.errors[param.parameter as keyof typeof form.formState.errors] as any)?.message,
                            },
                        ]}
                    />
                )}
            </div>
        )
    }

    const groupedParameters = fertilizerParameters.reduce(
        (
            acc: Record<string, FertilizerParameterDescription[number][]>,
            param: FertilizerParameterDescription[number],
        ) => {
            if (!acc[param.category]) {
                acc[param.category] = []
            }
            acc[param.category].push(param)
            return acc
        },
        {} as Record<string, FertilizerParameterDescription[number][]>,
    )

    const appMethodParam = fertilizerParameters.find(
        (p) => p.parameter === "p_app_method_options",
    )

    const totalN = Number(formValues.p_n_rt) || 0
    const nEfficiency = Number(formValues.p_n_wc) || 0
    const werkzameN = totalN * nEfficiency

    const formattedWerkzameN = new Intl.NumberFormat("nl-NL", {
        maximumFractionDigits: 1,
    }).format(werkzameN)

    const nutrientStats = [
        { label: "Stikstof (N)", value: totalN, unit: "g/kg" },
        { label: "Werkzame N", value: formattedWerkzameN, unit: "g/kg" },
        { label: "Fosfaat (P₂O₅)", value: formValues.p_p_rt, unit: "g/kg" },
        { label: "Kalium (K₂O)", value: formValues.p_k_rt, unit: "g/kg" },
        { label: "Eff. OS (EOC)", value: formValues.p_eoc, unit: "g/kg" },
    ]

    return (
        <RemixFormProvider {...form}>
            <Form
                id="formFertilizer"
                onSubmit={form.handleSubmit}
                method="post"
                className="flex flex-col xl:flex-row gap-8 pb-24 xl:pb-10"
            >
                <div className="flex-1 space-y-6">
                    {!editable && (
                        <Alert className="bg-muted/50 border-primary/20">
                            <InfoIcon className="h-4 w-4 text-primary" />
                            <AlertTitle className="text-foreground font-bold">
                                Standaard uit catalogus
                            </AlertTitle>
                            <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mt-2">
                                <span className="max-w-2xl leading-relaxed text-muted-foreground">
                                    Deze meststof komt uit de standaard
                                    catalogus en kan daarom niet direct worden
                                    aangepast. Wilt u deze waarden toch
                                    wijzigen? Gebruik deze meststof dan als
                                    sjabloon om een eigen variant aan te maken.
                                </span>
                                {p_id && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0 font-semibold"
                                        asChild
                                    >
                                        <NavLink
                                            to={`/farm/${b_id_farm}/fertilizers/new/${p_id}`}
                                        >
                                            <Copy className="mr-2 h-4 w-4" />
                                            Gebruik als sjabloon
                                        </NavLink>
                                    </Button>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    {categories.map((category) => {
                        const isGeneral = category.name === "general"
                        return (
                            <Card key={category.name} className="shadow-sm">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-lg font-bold">
                                        {category.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                        {groupedParameters[category.name]?.map(
                                            (param) => getParameterInput(param),
                                        )}
                                    </div>
                                    {isGeneral &&
                                        getAppMethodInput(appMethodParam)}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>

                <div className="w-full xl:w-80 space-y-6">
                    <Card className="sticky top-4 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">
                                Samenvatting
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-1.5">
                                <div
                                    className="text-xl font-bold leading-tight break-words"
                                    title={formValues.p_name_nl}
                                >
                                    {formValues.p_name_nl ||
                                        "Naamloze meststof"}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formValues.p_type_rvo ? (
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "border-transparent text-white",
                                                currentType === "manure"
                                                    ? "bg-amber-600 hover:bg-amber-700"
                                                    : currentType === "compost"
                                                      ? "bg-green-600 hover:bg-green-700"
                                                      : currentType ===
                                                          "mineral"
                                                        ? "bg-blue-600 hover:bg-blue-700"
                                                        : "bg-gray-600 hover:bg-gray-700",
                                            )}
                                        >
                                            {rvoLabels?.[
                                                formValues.p_type_rvo
                                            ] || formValues.p_type_rvo}
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary">
                                            Geen RVO code
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t">
                                {nutrientStats.map((stat) => (
                                    <div
                                        key={stat.label}
                                        className="flex items-center justify-between group"
                                    >
                                        <span className="text-sm text-muted-foreground">
                                            {stat.label}
                                        </span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-sm font-bold">
                                                {stat.value ?? "0,00"}
                                            </span>
                                            <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                                {stat.unit}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4" ref={sidebarButtonRef}>
                                {editable && (
                                    <Button
                                        type="submit"
                                        className="w-full shadow-sm"
                                        disabled={form.formState.isSubmitting}
                                    >
                                        {form.formState.isSubmitting
                                            ? "Opslaan..."
                                            : "Meststof opslaan"}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Mobile Sticky Footer */}
                {editable && !isSidebarButtonVisible && (
                    <div className="xl:hidden fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t z-50 flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
                        <Button
                            type="submit"
                            form="formFertilizer"
                            className="flex-1 h-12 font-bold shadow-lg"
                            disabled={form.formState.isSubmitting}
                        >
                            {form.formState.isSubmitting
                                ? "Opslaan..."
                                : "Meststof opslaan"}
                        </Button>
                    </div>
                )}
            </Form>
        </RemixFormProvider>
    )
}
