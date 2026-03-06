import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { Form } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { Combobox } from "~/components/custom/combobox"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
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
import { Spinner } from "~/components/ui/spinner"
import { FieldDeleteDialog } from "../field/delete"
import { FormSchema } from "./schema"

export function NewFieldsForm({
    b_id,
    b_name,
    b_area,
    b_lu_catalogue,
    b_bufferstrip,
    cultivationOptions,
}: NewFieldsFormProps) {
    const form = useRemixForm({
        mode: "onTouched",
        resolver: zodResolver(FormSchema),
        defaultValues: {
            b_name: b_name ?? "",
            b_area: Math.round(b_area * 10) / 10,
            b_lu_catalogue: b_lu_catalogue ?? "",
            b_bufferstrip: b_bufferstrip ?? false,
        },
    })

    useEffect(() => {
        form.reset({
            b_name: b_name ?? "",
            b_area: Math.round(b_area * 10) / 10,
            b_lu_catalogue: b_lu_catalogue ?? "",
            b_bufferstrip: b_bufferstrip ?? false,
        })
    }, [form.reset, b_name, b_area, b_lu_catalogue, b_bufferstrip])

    return (
        <RemixFormProvider {...form}>
            <fieldset disabled={form.formState.isSubmitting}>
                <Card>
                    <CardHeader>
                        <CardTitle>Perceel</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Form
                            id="formField"
                            method="POST"
                            onSubmit={form.handleSubmit}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
                                <FormField
                                    control={form.control}
                                    name="b_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Naam</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    type="text"
                                                    required
                                                />
                                            </FormControl>
                                            <FormDescription />
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="b_area"
                                    disabled={true}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Oppervlak (ha)
                                            </FormLabel>
                                            <FormControl>
                                                <Input {...field} type="text" />
                                            </FormControl>
                                            <FormDescription />
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="b_lu_catalogue"
                                    render={({ field }) => (
                                        <FormItem className="col-span-2 items-center gap-4">
                                            <Combobox
                                                options={cultivationOptions}
                                                form={form}
                                                name={"b_lu_catalogue"}
                                                label={"Hoofdgewas"}
                                                defaultValue={b_lu_catalogue}
                                            />
                                            <Input type="hidden" {...field} />
                                            <FormDescription />
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="b_bufferstrip"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row col-span-2 items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={
                                                        field.onChange
                                                    }
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel>
                                                    Bufferstrook
                                                </FormLabel>
                                                <FormDescription>
                                                    Is dit perceel een
                                                    bufferstrook?
                                                </FormDescription>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </Form>
                    </CardContent>
                    <CardFooter>
                        <FieldDeleteDialog
                            key={b_id}
                            fieldName={b_name}
                            isSubmitting={form.formState.isSubmitting}
                            buttonText="Verwijderen"
                        />
                        <Button
                            type="submit"
                            form="formField"
                            disabled={form.formState.isSubmitting}
                            className="ml-auto"
                        >
                            {form.formState.isSubmitting && <Spinner />}
                            Bijwerken
                        </Button>
                    </CardFooter>
                </Card>
            </fieldset>
        </RemixFormProvider>
    )
}

type NewFieldsFormProps = {
    b_id: string
    b_name: string
    b_area: number
    b_lu_catalogue: string
    b_bufferstrip: boolean
    cultivationOptions: {
        value: string
        label: string
    }[]
}
