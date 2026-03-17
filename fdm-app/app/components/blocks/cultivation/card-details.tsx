import { zodResolver } from "@hookform/resolvers/zod"
import type { Cultivation } from "@nmi-agro/fdm-core"
import { useEffect } from "react"
import { Form, useFetcher, useLocation } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { DatePicker } from "~/components/custom/date-picker"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "~/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"
import {
    CultivationDetailsFormSchema,
    type CultivationDetailsFormSchemaType,
} from "./schema"

export function CultivationDetailsCard({
    cultivation,
    b_lu_variety_options,
    editable = true,
}: {
    cultivation: Cultivation
    b_lu_variety_options: { value: string; label: string }[]
    editable?: boolean
}) {
    const fetcher = useFetcher()
    const form = useRemixForm<CultivationDetailsFormSchemaType>({
        resolver: zodResolver(CultivationDetailsFormSchema),
        mode: "onTouched",
        defaultValues: {
            b_lu_start: new Date(cultivation.b_lu_start),
            b_lu_end: cultivation.b_lu_end
                ? new Date(cultivation.b_lu_end)
                : null,
            m_cropresidue:
                !!cultivation.b_lu_eom_residue &&
                (cultivation.m_cropresidue ?? false),
            b_lu_variety: cultivation.b_lu_variety ?? null,
        },
    })

    const { pathname } = useLocation()
    const isCreateWizard = pathname.includes("/farm/create/")

    useEffect(() => {
        form.reset({
            b_lu_start: new Date(cultivation.b_lu_start),
            b_lu_end: cultivation.b_lu_end
                ? new Date(cultivation.b_lu_end)
                : null,
            m_cropresidue: cultivation.m_cropresidue ?? false,
            b_lu_variety: cultivation.b_lu_variety ?? null,
        })
    }, [cultivation, form.reset])

    const handleDeleteCultivation = () => {
        return fetcher.submit(null, { method: "delete" })
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-semibold tracking-tight text-gray-900">
                    {cultivation.b_lu_name}
                </CardTitle>
                {!isCreateWizard && editable ? (
                    <div className="flex justify-between">
                        <Button
                            variant="destructive"
                            onClick={handleDeleteCultivation}
                            disabled={
                                form.formState.isSubmitting ||
                                fetcher.state !== "idle"
                            }
                        >
                            {form.formState.isSubmitting ||
                            fetcher.state !== "idle" ? (
                                <div className="flex items-center space-x-2">
                                    <Spinner />
                                </div>
                            ) : null}
                            Verwijderen
                        </Button>
                    </div>
                ) : null}
            </CardHeader>
            <CardContent className="space-y-6">
                <RemixFormProvider {...form}>
                    <Form onSubmit={form.handleSubmit} method="post">
                        <fieldset
                            disabled={
                                !editable ||
                                form.formState.isSubmitting ||
                                fetcher.state !== "idle"
                            }
                            className="space-y-4"
                        >
                            <div className="grid lg:grid-cols-2 gap-4">
                                <DatePicker
                                    form={form}
                                    name="b_lu_start"
                                    label="Zaaidatum"
                                    description=""
                                    disabled={!editable}
                                />
                                <DatePicker
                                    form={form}
                                    name="b_lu_end"
                                    label="Einddatum"
                                    description=""
                                    disabled={!editable}
                                />
                            </div>
                            <div className="grid lg:grid-cols-2 gap-4 items-end">
                                <FormField
                                    control={form.control}
                                    name="m_cropresidue"
                                    render={({ field }) => (
                                        <FormItem
                                            className={cn(
                                                "flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4",
                                                /* null or 0 */ !cultivation.b_lu_eom_residue &&
                                                    "invisible",
                                            )}
                                        >
                                            <FormControl>
                                                <Checkbox
                                                    checked={Boolean(
                                                        field.value,
                                                    )}
                                                    onCheckedChange={
                                                        field.onChange
                                                    }
                                                    disabled={
                                                        !editable ||
                                                        form.formState
                                                            .isSubmitting ||
                                                        fetcher.state !== "idle"
                                                    }
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel>
                                                    Gewasresten achterlaten
                                                </FormLabel>
                                                <FormMessage />
                                            </div>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="b_lu_variety"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Variëteit</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value ?? undefined}
                                                disabled={
                                                    !editable ||
                                                    b_lu_variety_options.length ===
                                                        0
                                                }
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue
                                                            placeholder={
                                                                b_lu_variety_options.length ===
                                                                0
                                                                    ? "Geen varieteiten beschikbaar"
                                                                    : "Selecteer een variëteit"
                                                            }
                                                        />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {b_lu_variety_options.map(
                                                        (option) => (
                                                            <SelectItem
                                                                key={
                                                                    option.value
                                                                }
                                                                value={
                                                                    option.value
                                                                }
                                                            >
                                                                {option.label}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div
                                className={cn(
                                    "flex justify-end",
                                    !editable ? "invisible" : "",
                                )}
                            >
                                <Button
                                    type="submit"
                                    disabled={
                                        form.formState.isSubmitting ||
                                        fetcher.state !== "idle"
                                    }
                                >
                                    {form.formState.isSubmitting ||
                                    fetcher.state !== "idle" ? (
                                        <div className="flex items-center space-x-2">
                                            <Spinner /> <p>Bijwerken...</p>
                                        </div>
                                    ) : (
                                        "Bijwerken"
                                    )}
                                </Button>
                            </div>
                        </fieldset>
                    </Form>
                </RemixFormProvider>
            </CardContent>
        </Card>
    )
}
