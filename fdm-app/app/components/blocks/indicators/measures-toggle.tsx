import { useSearchParams } from "react-router"
import { Label } from "~/components/ui/label"
import { Switch } from "~/components/ui/switch"

/**
 * Toggle between "Met maatregelen" (score) and "Zonder maatregelen" (index).
 * Syncs with the ?measures=off URL search param for shareability.
 */
export function MeasuresToggle() {
    const [searchParams, setSearchParams] = useSearchParams()
    const withMeasures = searchParams.get("measures") !== "off"

    const handleToggle = (checked: boolean) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev)
                if (checked) {
                    next.delete("measures")
                } else {
                    next.set("measures", "off")
                }
                return next
            },
            { preventScrollReset: true },
        )
    }

    return (
        <div className="flex items-center gap-2">
            <Switch
                id="measures-toggle"
                checked={withMeasures}
                onCheckedChange={handleToggle}
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
