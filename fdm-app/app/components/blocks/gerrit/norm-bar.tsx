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
  const over = norm > 0 ? filling > norm : filling > 0
  const pct = norm > 0 ? (filling / norm) * 100 : filling > 0 ? 100 : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          {label}
        </span>
        <span
          className={`shrink-0 text-xs font-bold tabular-nums ${over ? "text-red-600" : "text-foreground"}`}
        >
          {Math.round(filling)} / {Math.round(norm)} kg
        </span>
      </div>
      <Progress
        value={Math.max(0, Math.min(pct, 100))}
        colorBar={over ? "red-500" : "green-500"}
        className="h-2"
      />
    </div>
  )
}
