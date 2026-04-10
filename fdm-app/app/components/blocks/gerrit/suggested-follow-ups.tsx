import { MessageCircle } from "lucide-react"
import { Button } from "~/components/ui/button"

interface SuggestedFollowUpsProps {
    suggestions: string[]
    onSelect: (text: string) => void
    disabled?: boolean
}

export function SuggestedFollowUps({
    suggestions,
    onSelect,
    disabled,
}: SuggestedFollowUpsProps) {
    if (suggestions.length === 0) return null

    return (
        <div className="flex flex-wrap gap-2">
            {suggestions.map((text) => (
                <Button
                    key={text}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-1.5 px-3 text-left whitespace-normal max-w-xs"
                    onClick={() => onSelect(text)}
                    disabled={disabled}
                >
                    <MessageCircle className="w-3 h-3 mr-1.5 shrink-0" />
                    {text}
                </Button>
            ))}
        </div>
    )
}
