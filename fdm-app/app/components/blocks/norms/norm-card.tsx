import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

const getProgressColorClass = ({ percentage, type }: ProgressBarProps) => {
  if (percentage > 100 && type === "farm") return "bg-red-500"
  if (percentage > 100 && type === "field") return "bg-orange-500"
  return "bg-green-500"
}

interface ProgressBarProps {
  percentage: number
  type: "farm" | "field"
}

const ProgressBar = ({ percentage, type }: ProgressBarProps) => (
  <div className="h-2 w-full rounded-full bg-muted">
    <div
      className={`h-full rounded-full ${getProgressColorClass({ percentage, type })}`}
      style={{ width: `${Math.min(percentage, 100)}%` }}
    />
  </div>
)

interface NormCardProps {
  title: string
  type: "farm" | "field"
  norm: number
  filling: number | undefined
  unit: string
}

export function NormCard({ title, type, norm, filling, unit }: NormCardProps) {
  const fillingpercentage = filling || 0
  const percentage = norm > 0 ? (fillingpercentage / norm) * 100 : 0

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          {filling !== undefined && (
            <div className="text-left">
              <p className="text-xs text-muted-foreground">Opvulling</p>
              <div className="text-3xl font-semibold">{fillingpercentage.toFixed(0)}</div>
              {/* <p className="text-sm text-muted-foreground">
                                {unit}
                            </p> */}
            </div>
          )}
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Ruimte</p>
            <div className="text-3xl font-bold">{norm.toFixed(0)}</div>
            <p className="text-sm text-muted-foreground">{unit}</p>
          </div>
        </div>
        {filling !== undefined && (
          <div className="mt-4">
            <ProgressBar percentage={percentage} type={type} />
            <p className="mt-1 text-right text-sm text-muted-foreground">
              {percentage.toFixed(0)}%
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
