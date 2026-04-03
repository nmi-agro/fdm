import { ThumbsDown, ThumbsUp } from "lucide-react"
import { useThumbSurvey } from "posthog-js/react/surveys"
import { Button } from "~/components/ui/button"

export function GerritFeedback({ traceId }: { traceId: string }) {
    const { respond, response, triggerRef } = useThumbSurvey({
        surveyId: "019d1a34-81bb-0000-225c-e21898daa7a0",
        properties: {
            $ai_trace_id: traceId,
        },
    })

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <p className="text-sm font-medium text-foreground">
                Is dit bemestingsplan van Gerrit behulpzaam?
            </p>
            <div className="flex gap-2" ref={triggerRef}>
                <Button
                    variant={response === "up" ? "default" : "outline"}
                    size="sm"
                    onClick={() => respond("up")}
                >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Ja
                </Button>
                <Button
                    variant={response === "down" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => respond("down")}
                >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Nee
                </Button>
            </div>
        </div>
    )
}
