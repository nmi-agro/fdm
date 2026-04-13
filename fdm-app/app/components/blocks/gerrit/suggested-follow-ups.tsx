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
        <div className="flex overflow-x-auto pb-1.5 -mx-1 px-1 gap-2 scroll-smooth scrollbar-hide">
            {suggestions.map((text) => (
                <Button
                    key={text}
                    variant="secondary"
                    size="sm"
                    className="text-[11px] h-7 px-3 shrink-0 whitespace-nowrap bg-secondary/50 hover:bg-secondary border-none"
                    onClick={() => onSelect(text)}
                    disabled={disabled}
                >
                    {text}
                </Button>
            ))}
        </div>
    )
}
