import type { ClarifyingQuestion } from "@nmi-agro/fdm-agents"
import { ChevronRight, SkipForward } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"

export interface ClarificationAnswerValue {
  questionId: string
  question: string
  selectedOptionIds: string[]
  selectedOptionLabels: string[]
  other?: string
}

interface QuestionsFormProps {
  questions: ClarifyingQuestion[]
  onSubmit: (answers: ClarificationAnswerValue[]) => void
  onSkip: () => void
}

export function QuestionsForm({ questions, onSubmit, onSkip }: QuestionsFormProps) {
  const [answers, setAnswers] = useState<Record<string, ClarificationAnswerValue>>(() =>
    Object.fromEntries(
      questions.map((q) => [
        q.id,
        {
          questionId: q.id,
          question: q.question,
          selectedOptionIds: [],
          selectedOptionLabels: [],
        },
      ]),
    ),
  )

  const setOption = (
    q: ClarifyingQuestion,
    optionId: string,
    optionLabel: string,
    checked: boolean,
  ) => {
    setAnswers((prev) => {
      const cur = { ...prev[q.id] }
      if (q.selection === "single") {
        cur.selectedOptionIds = checked ? [optionId] : []
        cur.selectedOptionLabels = checked ? [optionLabel] : []
        // Clear stale other text when switching to a normal option
        cur.other = undefined
      } else {
        if (checked) {
          cur.selectedOptionIds = [...cur.selectedOptionIds, optionId]
          cur.selectedOptionLabels = [...cur.selectedOptionLabels, optionLabel]
        } else {
          const idx = cur.selectedOptionIds.indexOf(optionId)
          cur.selectedOptionIds = cur.selectedOptionIds.filter((_, i) => i !== idx)
          cur.selectedOptionLabels = cur.selectedOptionLabels.filter((_, i) => i !== idx)
        }
      }
      return { ...prev, [q.id]: cur }
    })
  }

  const setOther = (q: ClarifyingQuestion, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [q.id]: { ...prev[q.id], other: value || undefined },
    }))
  }

  const handleSubmit = () => {
    onSubmit(Object.values(answers))
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b">
        <CardTitle className="text-base font-semibold">
          Gerrit heeft een paar gerichte vragen
        </CardTitle>
        <CardDescription>
          Beantwoord de vragen die voor jou van toepassing zijn. Je kunt de vragen ook overslaan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 p-6">
        {questions.map((q, qi) => (
          <div key={q.id} className="space-y-3">
            <p id={`question-${q.id}`} className="text-foreground text-sm font-medium">
              {qi + 1}. {q.question}
            </p>
            <div className="space-y-2 pl-1">
              {q.selection === "single" ? (
                <RadioGroup
                  aria-labelledby={`question-${q.id}`}
                  value={answers[q.id]?.selectedOptionIds[0] ?? ""}
                  onValueChange={(val) => {
                    if (val === "__other__") {
                      // "Anders" selected — clear previous option, mark __other__
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: {
                          ...prev[q.id],
                          selectedOptionIds: ["__other__"],
                          selectedOptionLabels: ["Anders"],
                        },
                      }))
                    } else {
                      const opt = q.options.find((o) => o.id === val)
                      if (opt) setOption(q, opt.id, opt.label, true)
                    }
                  }}
                >
                  {q.options.map((opt) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.id} id={`${q.id}-${opt.id}`} />
                      <Label
                        htmlFor={`${q.id}-${opt.id}`}
                        className="cursor-pointer text-sm font-normal"
                      >
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                  {/* Anders option */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="__other__" id={`${q.id}-other`} />
                      <Label
                        htmlFor={`${q.id}-other`}
                        className="cursor-pointer text-sm font-normal"
                      >
                        Anders, namelijk…
                      </Label>
                    </div>
                    {answers[q.id]?.selectedOptionIds[0] === "__other__" && (
                      <Input
                        className="ml-6 h-8 text-sm"
                        placeholder="Typ hier je antwoord…"
                        maxLength={200}
                        value={answers[q.id]?.other ?? ""}
                        onChange={(e) => setOther(q, e.target.value)}
                      />
                    )}
                  </div>
                </RadioGroup>
              ) : (
                <div className="space-y-2" role="group" aria-labelledby={`question-${q.id}`}>
                  {q.options.map((opt) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`${q.id}-${opt.id}`}
                        checked={answers[q.id]?.selectedOptionIds.includes(opt.id) ?? false}
                        onCheckedChange={(checked) => setOption(q, opt.id, opt.label, !!checked)}
                      />
                      <Label
                        htmlFor={`${q.id}-${opt.id}`}
                        className="cursor-pointer text-sm font-normal"
                      >
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                  {/* Anders option */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`${q.id}-other`}
                        checked={answers[q.id]?.selectedOptionIds.includes("__other__") ?? false}
                        onCheckedChange={(checked) => {
                          setAnswers((prev) => {
                            const cur = {
                              ...prev[q.id],
                            }
                            if (checked) {
                              cur.selectedOptionIds = [...cur.selectedOptionIds, "__other__"]
                              cur.selectedOptionLabels = [...cur.selectedOptionLabels, "Anders"]
                            } else {
                              cur.selectedOptionIds = cur.selectedOptionIds.filter(
                                (id) => id !== "__other__",
                              )
                              cur.selectedOptionLabels = cur.selectedOptionLabels.filter(
                                (l) => l !== "Anders",
                              )
                              cur.other = undefined
                            }
                            return {
                              ...prev,
                              [q.id]: cur,
                            }
                          })
                        }}
                      />
                      <Label
                        htmlFor={`${q.id}-other`}
                        className="cursor-pointer text-sm font-normal"
                      >
                        Anders, namelijk…
                      </Label>
                    </div>
                    {answers[q.id]?.selectedOptionIds.includes("__other__") && (
                      <Input
                        className="ml-6 h-8 text-sm"
                        placeholder="Typ hier je antwoord…"
                        maxLength={200}
                        value={answers[q.id]?.other ?? ""}
                        onChange={(e) => setOther(q, e.target.value)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleSubmit} className="w-full py-5 text-base">
            <ChevronRight className="mr-2 h-4 w-4" />
            Doorgaan met deze antwoorden
          </Button>
          <Button variant="ghost" onClick={onSkip} className="text-muted-foreground w-full text-sm">
            <SkipForward className="mr-2 h-4 w-4" />
            Vragen overslaan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
