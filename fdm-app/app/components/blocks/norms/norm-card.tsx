import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { computeNormProgress, NormProgressBar } from "./progress-bar"

interface NormCardProps {
  title: string
  norm: number
  filling: number | undefined
  unit: string
  description?: string
}

export function NormCard({ title, norm, filling, unit, description }: NormCardProps) {
  const fillingpercentage = filling || 0
  const { percentage } = computeNormProgress(fillingpercentage, norm)

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline justify-between">
            {filling !== undefined && (
              <div className="text-left">
                <p className="text-muted-foreground text-xs">Opvulling</p>
                <div className="text-3xl font-semibold">{fillingpercentage.toFixed(0)}</div>
              </div>
            )}
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Ruimte</p>
              <div className="text-3xl font-bold">{norm.toFixed(0)}</div>
              <p className="text-muted-foreground text-sm">{unit}</p>
            </div>
          </div>
          {filling !== undefined && (
            <div className="mt-4">
              <NormProgressBar used={fillingpercentage} limit={norm} />
              <p className="text-muted-foreground mt-1 text-right text-sm">
                {percentage.toFixed(0)}%
              </p>
            </div>
          )}
        </CardContent>
      </div>
      {description && (
        <div className="border-border/60 bg-muted/30 rounded-b-xl border-t px-6 py-3">
          <p className="text-muted-foreground mb-0.5 text-xs font-medium">Toelichting norm</p>
          <p className="text-foreground/80 text-xs leading-relaxed break-words">{description}</p>
        </div>
      )}
    </Card>
  )
}
