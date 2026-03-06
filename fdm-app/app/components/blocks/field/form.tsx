import { zodResolver } from "@hookform/resolvers/zod"
import type { Feature, Polygon } from "geojson"
import { useEffect } from "react"
import { Form } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import type { z } from "zod"
import { Combobox } from "~/components/custom/combobox"
import { Button } from "~/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
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
import { FormSchema } from "./schema"

interface FieldDetailsDialogProps {
    open: boolean
    setOpen: (value: boolean) => void
    field: Feature<Polygon>
    cultivationOptions: { value: string; label: string }[]
    fieldNameDefault: string
}

export default function FieldDetailsDialog({
    open,
    setOpen,
    field,
    cultivationOptions,
    fieldNameDefault,
}: FieldDetailsDialogProps) {
    const b_lu_catalogue = field.properties?.b_lu_catalogue ?? ""

    const form = useRemixForm<z.infer<typeof FormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(FormSchema),
        defaultValues: {
            b_name: fieldNameDefault,
            b_lu_catalogue: b_lu_catalogue,
        },
        submitData: {
            b_id_source: field.properties?.b_id_source,
            b_geometry: JSON.stringify(field.geometry),
        },
    })

    useEffect(() => {
        if (form.formState.isSubmitSuccessful || !open) {
            form.reset()
        }
    }, [form.formState, form.reset, open])

    // Effect to update form values when the 'field' prop changes
    useEffect(() => {
        form.reset({
            b_name: fieldNameDefault,
            b_lu_catalogue: b_lu_catalogue,
        })
    }, [fieldNameDefault, b_lu_catalogue, form.reset])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <RemixFormProvider {...form}>
                    <Form
                        id="formField"
                        onSubmit={form.handleSubmit}
                        method="post"
                    >
                        <fieldset disabled={form.formState.isSubmitting}>
                            <DialogHeader>
                                <DialogTitle>Nieuw perceel</DialogTitle>
                                <DialogDescription>
                                    Vul de details van dit perceel in
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
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
                                                    disabled={
                                                        form.formState
                                                            .isSubmitting
                                                    }
                                                />
                                            </FormControl>
                                            <FormDescription />
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Combobox
                                    options={cultivationOptions}
                                    name="b_lu_catalogue"
                                    form={form}
                                    label={
                                        <span>
                                            Hoofdgewas
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </span>
                                    }
                                    disabled={form.formState.isSubmitting}
                                />
                            </div>
                            <DialogFooter>
                                <Button
                                    type="submit"
                                    disabled={form.formState.isSubmitting}
                                >
                                    {form.formState.isSubmitting ? (
                                        <div className="flex items-center space-x-2">
                                            <Spinner />
                                            <span>Opslaan...</span>
                                        </div>
                                    ) : (
                                        "Opslaan"
                                    )}
                                </Button>
                            </DialogFooter>
                        </fieldset>
                    </Form>
                </RemixFormProvider>
            </DialogContent>
        </Dialog>
    )
}
