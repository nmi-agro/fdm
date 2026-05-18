import { Label } from "~/components/ui/label"
import { Switch } from "~/components/ui/switch"

type MeasuresToggleProps = {
    /** Whether "Met maatregelen" is active (shows score). */
    withMeasures: boolean
    /** Called when the user toggles the switch. */
    onToggle: (withMeasures: boolean) => void
}

/**
 * Toggle between "Met maatregelen" (score) and "Zonder maatregelen" (index).
 * Driven by props — parent owns the state for instant client-side switching.
 */
export function MeasuresToggle({ withMeasures, onToggle }: MeasuresToggleProps) {
    return (
        <div className="flex items-center gap-2">
            <Switch
                id="measures-toggle"
                checked={withMeasures}
                onCheckedChange={onToggle}
            />
            <Label
                htmlFor="measures-toggle"
                className="text-sm cursor-pointer select-none"
            >
                {withMeasures ? "Met maatregelen" : "Zonder maatregelen"}
            </Label>
        </div>
    )
}
