import { Bot } from "lucide-react"
import { Controller, type UseFormReturn } from "react-hook-form"
import { Form } from "react-router"
import { RemixFormProvider } from "remix-hook-form"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Label } from "~/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import { GEMINI_MODELS, type GerritFormValues, STRATEGY_LABELS } from "./schema"

interface StrategyFormProps {
    form: UseFormReturn<GerritFormValues>
    isGenerating: boolean
    additionalContextValue: string | undefined
    calendar: string
}

export function StrategyForm({
    form,
    isGenerating,
    additionalContextValue,
    calendar,
}: StrategyFormProps) {
    const additionalContextLength = additionalContextValue?.length ?? 0
    const showDerogation = parseInt(calendar) < 2026

    return (
        <Card className="h-fit sticky top-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                    <Bot className="w-6 h-6 text-primary" />
                    Bedrijfsstrategie & voorkeuren
                </CardTitle>
                <CardDescription>
                    Stel de kaders in waarbinnen Gerrit het optimale
                    bemestingsplan berekent.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <RemixFormProvider {...form}>
                    <Form method="post" className="space-y-8">
                        <input type="hidden" name="intent" value="generate" />
                        <div className="space-y-6">
                            {[
                                "isOrganic",
                                "fillManureSpace",
                                "reduceAmmoniaEmissions",
                                "keepNitrogenBalanceBelowTarget",
                                "workOnRotationLevel",
                                "isDerogation",
                            ]
                                .filter(
                                    (name) =>
                                        name !== "isDerogation" ||
                                        showDerogation,
                                )
                                .map((name) => (
                                    <div
                                        key={name}
                                        className="flex items-start justify-between gap-4"
                                    >
                                        <div className="space-y-1">
                                            <Label
                                                htmlFor={name}
                                                className="text-base"
                                            >
                                                {STRATEGY_LABELS[name]}
                                            </Label>
                                            <p className="text-sm text-muted-foreground leading-snug">
                                                {name === "isOrganic" &&
                                                    "Geen gebruik van kunstmest."}
                                                {name === "fillManureSpace" &&
                                                    "Volledig opvullen van de gebruiksruimte voor dierlijke mest."}
                                                {name ===
                                                    "reduceAmmoniaEmissions" &&
                                                    "Gebruik emissiearme meststoffen en technieken."}
                                                {name ===
                                                    "keepNitrogenBalanceBelowTarget" &&
                                                    "Stikstofoverschot beperken tot onder de doelwaarde."}
                                                {name ===
                                                    "workOnRotationLevel" &&
                                                    "Percelen met hetzelfde gewas krijgen dezelfde bemesting."}
                                                {name === "isDerogation" &&
                                                    "Geen gebruik van fosfaathoudende minerale meststoffen."}
                                            </p>
                                        </div>
                                        <Controller
                                            name={
                                                name as keyof GerritFormValues
                                            }
                                            control={form.control}
                                            render={({ field }) => (
                                                <>
                                                    <Switch
                                                        id={name}
                                                        checked={
                                                            field.value as boolean
                                                        }
                                                        onCheckedChange={
                                                            field.onChange
                                                        }
                                                        className="mt-1"
                                                        disabled={isGenerating}
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name={name}
                                                        value={
                                                            field.value
                                                                ? "true"
                                                                : "false"
                                                        }
                                                    />
                                                </>
                                            )}
                                        />
                                    </div>
                                ))}
                        </div>
                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-end">
                                <Label
                                    htmlFor="additionalContext"
                                    className="text-base"
                                >
                                    Aanvullende opmerkingen of wensen
                                </Label>
                                <span
                                    className={`text-xs ${additionalContextLength > 1000 ? "text-red-500 font-medium" : "text-muted-foreground"}`}
                                >
                                    {additionalContextLength} / 1000
                                </span>
                            </div>
                            <Textarea
                                id="additionalContext"
                                placeholder="Bijv: Gebruik bij voorkeur eigen drijfmest op de huiskavel..."
                                className={`min-h-25 resize-none ${form.formState.errors.additionalContext ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                maxLength={1000}
                                {...form.register("additionalContext")}
                                disabled={isGenerating}
                            />
                            {form.formState.errors.additionalContext && (
                                <p className="text-sm text-red-500">
                                    {
                                        form.formState.errors.additionalContext
                                            .message
                                    }
                                </p>
                            )}
                        </div>
                        <div className="space-y-2 pt-2">
                            <Label
                                htmlFor="geminiModel"
                                className="text-sm font-medium text-muted-foreground"
                            >
                                AI-model
                            </Label>
                            <Controller
                                name="geminiModel"
                                control={form.control}
                                render={({ field }) => (
                                    <Select
                                        value={field.value as string}
                                        onValueChange={field.onChange}
                                        disabled={isGenerating}
                                    >
                                        <SelectTrigger
                                            id="geminiModel"
                                            className="w-full text-sm"
                                        >
                                            <SelectValue />
                                            <input
                                                type="hidden"
                                                name="geminiModel"
                                                value={field.value as string}
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {GEMINI_MODELS.map((m) => (
                                                <SelectItem
                                                    key={m.value}
                                                    value={m.value}
                                                >
                                                    {m.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full py-6 text-lg"
                            disabled={isGenerating}
                        >
                            {isGenerating ? (
                                <>
                                    <Spinner className="mr-3 h-5 w-5" />
                                    Gerrit berekent het plan...
                                </>
                            ) : (
                                "Bemestingsplan genereren"
                            )}
                        </Button>
                    </Form>
                </RemixFormProvider>
            </CardContent>
        </Card>
    )
}
