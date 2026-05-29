import { zodResolver } from "@hookform/resolvers/zod"
import type { SoilAnalysis } from "@nmi-agro/fdm-core"
import { Form } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { BCS_INDICATORS } from "~/lib/bcs-calculation"
import { Button } from "~/components/ui/button"
import { DatePicker } from "~/components/custom/date-picker"
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "~/components/ui/form"
import { Spinner } from "~/components/ui/spinner"
import { BcsScoreCard } from "./bcs-score-card"
import {
    soilAnalysisBcsSchema,
    type SoilAnalysisBcsFormValues,
} from "./formschema"
import { cn } from "~/lib/utils"

interface VisualAssessmentFormProps {
    assessment?: SoilAnalysis
    b_id: string
    action: string
    editable?: boolean
}

/** Score button for BCS indicator (0, 1, 2) */
function ScoreButton({
    value,
    selected,
    onClick,
    disabled,
}: {
    value: number
    selected: boolean
    onClick: () => void
    disabled?: boolean
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "h-10 w-10 rounded-md border text-sm font-medium transition-colors",
                selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent hover:text-accent-foreground",
                disabled && "opacity-50 cursor-not-allowed",
            )}
        >
            {value}
        </button>
    )
}

/**
 * Form for creating or editing a BCS soil assessment.
 * Shows 9 BCS indicator score inputs and a live score preview.
 */
export function VisualAssessmentForm({
    assessment,
    b_id,
    action,
    editable = true,
}: VisualAssessmentFormProps) {
    const form = useRemixForm<SoilAnalysisBcsFormValues>({
        resolver: zodResolver(soilAnalysisBcsSchema),
        defaultValues: {
            b_id,
            a_date: assessment?.a_date ?? undefined,
            a_ss_bcs: assessment?.a_ss_bcs ?? null,
            a_sc_bcs: assessment?.a_sc_bcs ?? null,
            a_rd_bcs: assessment?.a_rd_bcs ?? null,
            a_ew_bcs: assessment?.a_ew_bcs ?? null,
            a_cc_bcs: assessment?.a_cc_bcs ?? null,
            a_gs_bcs: assessment?.a_gs_bcs ?? null,
            a_p_bcs: assessment?.a_p_bcs ?? null,
            a_c_bcs: assessment?.a_c_bcs ?? null,
            a_rt_bcs: assessment?.a_rt_bcs ?? null,
        },
    })

    const watchedScores = form.watch([
        "a_ss_bcs", "a_sc_bcs", "a_rd_bcs", "a_ew_bcs", "a_cc_bcs",
        "a_gs_bcs", "a_p_bcs", "a_c_bcs", "a_rt_bcs",
    ])

    const liveScores = {
        a_ss_bcs: watchedScores[0],
        a_sc_bcs: watchedScores[1],
        a_rd_bcs: watchedScores[2],
        a_ew_bcs: watchedScores[3],
        a_cc_bcs: watchedScores[4],
        a_gs_bcs: watchedScores[5],
        a_p_bcs: watchedScores[6],
        a_c_bcs: watchedScores[7],
        a_rt_bcs: watchedScores[8],
    }

    return (
        <RemixFormProvider {...form}>
            <Form method="post" action={action} onSubmit={form.handleSubmit}>
                <input type="hidden" name="b_id" value={b_id} />

                <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                    {/* Left: form fields */}
                    <div className="space-y-6">
                        {/* Date */}
                        <FormField
                            control={form.control}
                            name="a_date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Datum</FormLabel>
                                    <FormControl>
                                        <DatePicker
                                            value={field.value as Date | undefined}
                                            onChange={field.onChange}
                                            disabled={!editable}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* BCS Indicators section */}
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-medium">BCS Indicatoren</h4>
                                <p className="text-sm text-muted-foreground">
                                    Score elke indicator: 0 = slecht, 1 = matig, 2 = goed
                                </p>
                            </div>

                            <div className="space-y-3">
                                {BCS_INDICATORS.map((indicator) => (
                                    <FormField
                                        key={indicator.key}
                                        control={form.control}
                                        name={indicator.key}
                                        render={({ field }) => (
                                            <FormItem>
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <FormLabel className="text-sm font-medium">
                                                            {indicator.name}
                                                            {indicator.direction === "negative" && (
                                                                <span className="ml-1 text-xs text-muted-foreground">(negatief)</span>
                                                            )}
                                                        </FormLabel>
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {indicator.description}
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-1 shrink-0">
                                                        {[0, 1, 2].map((score) => (
                                                            <ScoreButton
                                                                key={score}
                                                                value={score}
                                                                selected={field.value === score}
                                                                onClick={() =>
                                                                    field.onChange(
                                                                        field.value === score ? null : score,
                                                                    )
                                                                }
                                                                disabled={!editable}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        {editable && (
                            <div className="flex gap-3">
                                <Button
                                    type="submit"
                                    disabled={form.formState.isSubmitting}
                                >
                                    {form.formState.isSubmitting && (
                                        <Spinner className="mr-2" />
                                    )}
                                    Opslaan
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Right: live score preview */}
                    <div className="lg:sticky lg:top-4 lg:self-start">
                        <BcsScoreCard scores={liveScores} />
                    </div>
                </div>
            </Form>
        </RemixFormProvider>
    )
}
