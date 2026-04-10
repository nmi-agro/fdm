import type { IntentQuestion } from "@nmi-agro/fdm-agents"
import { Bot, ChevronRight, Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import { Textarea } from "~/components/ui/textarea"

interface IntentPanelProps {
    questions: IntentQuestion[]
    answers: Record<string, string>
    onAnswer: (questionId: string, value: string) => void
    onSubmit: () => void
    onSkip: () => void
    isLoading?: boolean
}

export function GerritIntentPanel({
    questions,
    answers,
    onAnswer,
    onSubmit,
    onSkip,
    isLoading,
}: IntentPanelProps) {
    const [openTexts, setOpenTexts] = useState<Record<string, string>>({})

    const allAnswered = questions.every((q) => {
        const answer = answers[q.id]
        if (!answer) return false
        const option = q.options.find((o) => o.value === answer)
        // If open option is chosen, require non-empty text
        if (option?.isOpen) return (openTexts[q.id] ?? "").trim().length > 0
        return true
    })

    function handleOptionChange(questionId: string, value: string) {
        onAnswer(questionId, value)
        // Clear open text when switching away from open option
        const q = questions.find((q) => q.id === questionId)
        const option = q?.options.find((o) => o.value === value)
        if (!option?.isOpen) {
            setOpenTexts((prev) => {
                const next = { ...prev }
                delete next[questionId]
                return next
            })
        }
    }

    function handleOpenTextChange(questionId: string, text: string) {
        setOpenTexts((prev) => ({ ...prev, [questionId]: text }))
        onAnswer(questionId, text)
    }

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Bot className="w-5 h-5 text-primary" />
                    Gerrit heeft nog een paar vragen
                </CardTitle>
                <CardDescription>
                    Beantwoord deze vragen zodat Gerrit het plan beter op jouw
                    bedrijf kan afstemmen. Je kunt ook doorgaan zonder te
                    beantwoorden.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {questions.map((q, i) => {
                    const selectedValue = answers[q.id]
                    const selectedOption = q.options.find(
                        (o) => o.value === selectedValue,
                    )
                    const isOpenSelected = selectedOption?.isOpen ?? false

                    return (
                        <div key={q.id} className="space-y-3">
                            <div>
                                <p className="text-sm font-medium">
                                    <span className="text-muted-foreground mr-2">
                                        {i + 1}.
                                    </span>
                                    {q.question}
                                </p>
                                {q.context && (
                                    <p className="text-xs text-muted-foreground mt-1 ml-5 italic">
                                        {q.context}
                                    </p>
                                )}
                            </div>
                            <RadioGroup
                                value={selectedValue ?? ""}
                                onValueChange={(v) =>
                                    handleOptionChange(q.id, v)
                                }
                                className="space-y-2"
                            >
                                {q.options.map((opt) => (
                                    <div
                                        key={opt.value}
                                        className="flex items-start gap-3"
                                    >
                                        <RadioGroupItem
                                            value={opt.value}
                                            id={`${q.id}-${opt.value}`}
                                            className="mt-0.5"
                                        />
                                        <Label
                                            htmlFor={`${q.id}-${opt.value}`}
                                            className="text-sm font-normal leading-snug cursor-pointer"
                                        >
                                            {opt.label}
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                            {isOpenSelected && (
                                <Textarea
                                    placeholder="Typ hier je antwoord..."
                                    className="mt-2 min-h-16 resize-none text-sm"
                                    value={openTexts[q.id] ?? ""}
                                    onChange={(e) =>
                                        handleOpenTextChange(
                                            q.id,
                                            e.target.value,
                                        )
                                    }
                                    maxLength={300}
                                />
                            )}
                        </div>
                    )
                })}

                <div className="flex gap-3 pt-2">
                    <Button
                        className="flex-1"
                        onClick={onSubmit}
                        disabled={!allAnswered || isLoading}
                    >
                        {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <ChevronRight className="mr-2 h-4 w-4" />
                        )}
                        Plan genereren
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onSkip}
                        disabled={isLoading}
                        className="text-muted-foreground"
                    >
                        Overslaan
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
