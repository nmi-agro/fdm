import { zodResolver } from "@hookform/resolvers/zod"
import type { SoilParameterDescription } from "@nmi-agro/fdm-core"
import { useEffect } from "react"
import { Form } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import type { z } from "zod"
import { FormSchema } from "@/app/components/blocks/soil/formschema"
import type { SoilAnalysis } from "@/app/components/blocks/soil/types"
import { DatePicker } from "~/components/custom/date-picker"
import { Button } from "~/components/ui/button"
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
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"
import { getContextualDate } from "~/lib/calendar"
import { useCalendarStore } from "~/store/calendar"

export function SoilAnalysisForm(props: {
    soilAnalysis: SoilAnalysis | undefined
    soilParameterDescription: SoilParameterDescription
    action: string
    editable?: boolean
}) {
    const { soilAnalysis, soilParameterDescription, editable = true } = props

    const { calendar } = useCalendarStore()
    const defaultValues: {
        [key: string]: string | number | Date | undefined | null
    } = {}
    for (const x of soilParameterDescription) {
        let defaultValue = soilAnalysis
            ? soilAnalysis[x.parameter as keyof SoilAnalysis]
            : undefined

        if (
            defaultValue === undefined &&
            (x.type === "text" || x.type === "numeric")
        ) {
            defaultValue = ""
        }

        if (defaultValue === undefined && x.type === "date" && !soilAnalysis) {
            defaultValue = getContextualDate(calendar, 2, 1)
        }

        defaultValues[x.parameter] = defaultValue
    }
    defaultValues.a_id = undefined

    const form = useRemixForm<z.infer<typeof FormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(FormSchema),
        defaultValues: defaultValues,
    })

    useEffect(() => {
        if (form.formState.isSubmitSuccessful) {
            form.reset()
        }
    }, [form.formState, form.reset])

    return (
        <RemixFormProvider {...form}>
            <Form
                id="soilAnalysisForm"
                onSubmit={form.handleSubmit}
                method="post"
            >
                <fieldset disabled={!editable || form.formState.isSubmitting}>
                    <div className="space-y-6">
                        <p className="text-sm text-muted-foreground">
                            Vul de gegevens van de bodemanalyse in.
                        </p>
                        <div className="grid md:grid-cols-2 gap-4">
                            {soilParameterDescription.map((x) => {
                                if (x.parameter === "a_id") {
                                    return null
                                }
                                if (x.type === "numeric") {
                                    return (
                                        <FormField
                                            control={form.control}
                                            name={x.parameter}
                                            key={x.parameter}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {x.name}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Input
                                                                {...field}
                                                                type="number"
                                                                value={
                                                                    field.value
                                                                }
                                                                placeholder=""
                                                            />
                                                            {x.unit && (
                                                                <span className="absolute inset-y-0 right-8 pr-3 flex items-center pointer-events-none text-muted-foreground text-sm">
                                                                    {x.unit}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </FormControl>
                                                    <FormDescription>
                                                        {x.description}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )
                                }

                                if (x.type === "enum") {
                                    return (
                                        <FormField
                                            control={form.control}
                                            name={x.parameter}
                                            key={x.parameter}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {x.name}
                                                    </FormLabel>
                                                    <Select
                                                        onValueChange={
                                                            field.onChange
                                                        }
                                                        value={field.value}
                                                    >
                                                        <SelectTrigger
                                                            {...field}
                                                        >
                                                            <SelectValue placeholder="" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {x.options?.map(
                                                                (option: {
                                                                    value: string
                                                                    label: string
                                                                }) => {
                                                                    if (
                                                                        option.value ===
                                                                        "nl-other-nmi"
                                                                    ) {
                                                                        return null
                                                                    }
                                                                    return (
                                                                        <SelectItem
                                                                            key={
                                                                                option.value
                                                                            }
                                                                            value={
                                                                                option.value
                                                                            }
                                                                        >
                                                                            {
                                                                                option.label
                                                                            }
                                                                        </SelectItem>
                                                                    )
                                                                },
                                                            ) || null}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormDescription>
                                                        {x.description}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )
                                }

                                if (x.type === "date") {
                                    return (
                                        <DatePicker
                                            key={x.parameter}
                                            form={form}
                                            name={x.parameter}
                                            label={x.name}
                                            description={x.description}
                                        />
                                    )
                                }

                                if (x.type === "text") {
                                    return (
                                        <FormField
                                            control={form.control}
                                            name={x.parameter}
                                            key={x.parameter}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {x.name}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            type="text"
                                                            value={field.value}
                                                            placeholder=""
                                                            aria-required="true"
                                                            required
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        {x.description}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )
                                }
                            })}
                        </div>
                        <div
                            className={cn(
                                "flex justify-end mt-4",
                                !editable ? "invisible" : "",
                            )}
                        >
                            <Button type="submit">
                                {form.formState.isSubmitting ? (
                                    <div className="flex items-center space-x-2">
                                        <Spinner />
                                        <span>Opslaan...</span>
                                    </div>
                                ) : (
                                    "Opslaan"
                                )}
                            </Button>
                        </div>
                    </div>
                </fieldset>
            </Form>
        </RemixFormProvider>
    )
}
