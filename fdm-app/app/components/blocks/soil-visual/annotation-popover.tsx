import { useState } from "react"
import { bcsIndicatorOptions } from "@nmi-agro/fdm-core"
import { Button } from "~/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { Label } from "~/components/ui/label"

interface AnnotationPopoverProps {
    onSave: (text: string, indicator?: string) => void
    onCancel: () => void
}

/**
 * Inline form for entering annotation text and optionally linking to a BCS indicator.
 * Rendered as a bottom sheet on mobile for ergonomics.
 */
export function AnnotationPopover({ onSave, onCancel }: AnnotationPopoverProps) {
    const [text, setText] = useState("")
    const [indicator, setIndicator] = useState<string | undefined>(undefined)

    const handleSave = () => {
        onSave(text, indicator === "none" ? undefined : indicator)
    }

    return (
        <div className="rounded-lg border bg-background p-4 shadow-lg space-y-3">
            <div className="space-y-1.5">
                <Label htmlFor="annotation-text">Notitie</Label>
                <Textarea
                    id="annotation-text"
                    placeholder="Beschrijf wat je ziet..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    className="resize-none"
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="annotation-indicator">
                    BCS indicator (optioneel)
                </Label>
                <Select
                    value={indicator ?? "none"}
                    onValueChange={(v) => setIndicator(v === "none" ? undefined : v)}
                >
                    <SelectTrigger id="annotation-indicator">
                        <SelectValue placeholder="Koppel aan indicator..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Geen koppeling</SelectItem>
                        {bcsIndicatorOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                    Annuleren
                </Button>
                <Button type="button" size="sm" onClick={handleSave}>
                    Opslaan
                </Button>
            </div>
        </div>
    )
}
