import { Progress } from "~/components/ui/progress"

export function NormBar({
    label,
    filling,
    norm,
}: {
    label: string
    filling: number
    norm: number
}) {
    const pct = norm > 0 ? (filling / norm) * 100 : 0
    const over = filling > norm
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {label}
                </span>
                <span
                    className={`text-xs font-bold tabular-nums shrink-0 ${over ? "text-red-600" : "text-foreground"}`}
                >
                    {Math.round(filling)} / {Math.round(norm)} kg
                </span>
            </div>
            <Progress
                value={Math.min(pct, 100)}
                colorBar={over ? "red-500" : "green-500"}
                className="h-2"
            />
        </div>
    )
}
