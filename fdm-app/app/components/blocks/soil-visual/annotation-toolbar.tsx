import { ArrowRight, Circle, MapPin, Pencil } from "lucide-react"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

export type AnnotationMode = "pin" | "circle" | "arrow" | "freehand" | null

interface AnnotationToolbarProps {
    mode: AnnotationMode
    onModeChange: (mode: AnnotationMode) => void
    disabled?: boolean
}

const TOOLS = [
    { mode: "pin" as const, icon: MapPin, label: "Pin" },
    { mode: "circle" as const, icon: Circle, label: "Cirkel" },
    { mode: "arrow" as const, icon: ArrowRight, label: "Pijl" },
    { mode: "freehand" as const, icon: Pencil, label: "Vrijhand" },
]

/**
 * Toolbar for selecting the active annotation drawing tool.
 */
export function AnnotationToolbar({
    mode,
    onModeChange,
    disabled = false,
}: AnnotationToolbarProps) {
    return (
        <div className="flex gap-1 rounded-md border bg-background p-1">
            {TOOLS.map((tool) => (
                <Button
                    key={tool.mode}
                    type="button"
                    variant={mode === tool.mode ? "default" : "ghost"}
                    size="sm"
                    className={cn("flex-1 gap-1.5 text-xs")}
                    disabled={disabled}
                    onClick={() =>
                        onModeChange(mode === tool.mode ? null : tool.mode)
                    }
                    title={tool.label}
                >
                    <tool.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{tool.label}</span>
                </Button>
            ))}
        </div>
    )
}
