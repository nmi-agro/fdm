import type { FertilizerParameters } from "@nmi-agro/fdm-core"
import { Form } from "react-router"
import { RemixFormProvider, type useRemixForm } from "remix-hook-form"
import type { z } from "zod"
import type { FormSchema } from "~/components/blocks/fertilizer/formschema"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "~/components/ui/form"
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
}

export function FertilizerForm({
    fertilizerParameters,
    form,
    editable = true,
}: FertilizerFormNewProps) {
    const categories = [
        {
            name: "general",
            title: "Algemeen",
        },

        {
            name: "primary",
            title: "Primaire nutriënten",
        },
        {
            name: "secondary",
            title: "OS & Secundaire nutriënten",
        },
        {
            name: "physical",
            title: "Fysische eigenschappen",
        },
        {
            name: "trace",
            title: "Sporenelementen",
        },
    ]

    const getParameterInput = (param: FertilizerParameterDescriptionItem) => {
        if (
            param.parameter === "p_source" ||
            param.parameter === "p_id_catalogue"
        ) {
            return null
        }

        return (
            <FormField
                control={form.control}
                name={param.parameter as FormSchemaKeys}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            {param.name} {param.unit && `(${param.unit})`}
                        </FormLabel>
                        <FormControl>
                            {param.type === "numeric" ? (
                                <Input
                                    type="number"
                                    min={param.min}
                                    max={param.max}
                                    step={"any"}
                                    {...field}
                                />
                            ) : param.type === "text" ? (
                                <Input type="text" {...field} />
                            ) : param.type === "enum" ? (
                                <Select
                                    onValueChange={field.onChange}
                                    defaultValue={
                                        field.value
                                            ? String(field.value)
                                            : undefined
                                    }
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecteer een optie" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {param.options?.map((option) => {
                                            return (
                                                <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {`${option.label} (${option.value})`}
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            ) : param.type === "enum_multi" ? (
                                <div className="grid xl:grid-cols-2 space-y-2">
                                    {param.options?.map((option) => (
                                        <FormField
                                            key={option.value}
                                            control={form.control}
                                            name={
                                                param.parameter as FormSchemaKeys
                                            }
                                            render={({ field }) => {
                                                return (
                                                    <FormItem
                                                        key={option.value}
                                                        className="flex flex-row items-start space-x-3 space-y-0"
                                                    >
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={
                                                                    Array.isArray(
                                                                        field.value,
                                                                    ) &&
                                                                    field.value.includes(
                                                                        option.value,
                                                                    )
                                                                }
                                                                onCheckedChange={(
                                                                    checked,
                                                                ) => {
                                                                    const currentValues =
                                                                        Array.isArray(
                                                                            field.value,
                                                                        )
                                                                            ? field.value
                                                                            : []
                                                                    if (
                                                                        checked
                                                                    ) {
                                                                        field.onChange(
                                                                            [
                                                                                ...currentValues,
                                                                                option.value,
                                                                            ],
                                                                        )
                                                                    } else {
                                                                        field.onChange(
                                                                            currentValues.filter(
                                                                                (
                                                                                    value,
                                                                                ) =>
                                                                                    value !==
                                                                                    option.value,
                                                                            ),
                                                                        )
                                                                    }
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">
                                                            {option.label}
                                                        </FormLabel>
                                                    </FormItem>
                                                )
                                            }}
                                        />
                                    ))}
                                </div>
                            ) : null}
                        </FormControl>
                        {param.description && (
                            <FormDescription>
                                {param.description}
                            </FormDescription>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />
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

    return (
        <RemixFormProvider {...form}>
            <Form
                id="formFertilizer"
                onSubmit={form.handleSubmit}
                method="post"
            >
                <fieldset disabled={form.formState.isSubmitting || !editable}>
                    <div className="space-y-6">
                        {categories.map((category) => (
                            <Card key={category.name}>
                                <CardHeader>
                                    <CardTitle>{category.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                        {groupedParameters[category.name]?.map(
                                            (param) => (
                                                <div key={param.parameter}>
                                                    {getParameterInput(param)}
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="sticky bottom-0 left-0 right-0 border-t bg-background p-4">
                        <Button
                            type="submit"
                            className={cn(
                                "w-full",
                                !editable ? "invisible" : "",
                            )}
                            disabled={form.formState.isSubmitting}
                        >
                            {form.formState.isSubmitting
                                ? "Meststof opslaan..."
                                : "Meststof opslaan"}
                        </Button>
                    </div>
                </fieldset>
            </Form>
        </RemixFormProvider>
    )
}
