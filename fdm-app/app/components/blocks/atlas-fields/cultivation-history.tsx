import { ChevronDown, ChevronUp, Copy } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

export type CultivationHistory = {
  year: number
  b_lu_catalogue: string
  b_lu_name?: string
  b_lu_croprotation?: string
  b_lu_rest_oravib?: boolean
}

export function CultivationHistoryTimeline({
  cultivationHistory,
}: {
  cultivationHistory: CultivationHistory[]
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const mobileLimit = 6
  const hasMore = cultivationHistory.length > mobileLimit

  return (
    <>
      <div className="relative pl-1">
        {cultivationHistory.map((cultivation, index) => {
          const isHiddenOnMobile = !isExpanded && index >= mobileLimit

          return (
            <div
              key={cultivation.year}
              className={cn(
                "group relative flex items-start space-x-4 pb-6",
                isHiddenOnMobile && "hidden lg:flex",
              )}
            >
              {/* Timeline Line */}
              {index !== cultivationHistory.length - 1 && (
                <div
                  className={cn(
                    "bg-border group-hover:bg-primary/30 absolute top-10 left-4.75 h-full w-0.5 transition-colors",
                    isHiddenOnMobile && "hidden lg:block",
                  )}
                />
              )}

              {/* Dot */}
              <div className="bg-background relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                  )}
                  style={{
                    backgroundColor: getCultivationColor(cultivation.b_lu_croprotation),
                    opacity: 0.2,
                  }}
                />
                <div
                  className="absolute h-3 w-3 rounded-full shadow-sm"
                  style={{
                    backgroundColor: getCultivationColor(cultivation.b_lu_croprotation),
                  }}
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 py-1">
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className={cn("cursor-help truncate font-semibold")}>
                          {cultivation.b_lu_name ?? "Onbekend gewas"}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{cultivation.b_lu_name ?? "Onbekend gewas"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground/70 text-xs font-bold tabular-nums">
                    {cultivation.year}
                  </span>
                  {cultivation.b_lu_rest_oravib && (
                    <>
                      <span className="text-muted-foreground/50 text-[10px]">•</span>
                      <span className="text-[10px] font-bold tracking-widest text-green-600 uppercase dark:text-green-400">
                        Rustgewas
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <div className="mt-2 border-t pt-2 lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-10 w-full"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Minder jaren tonen
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Meer jaren tonen ({cultivationHistory.length - mobileLimit})
              </>
            )}
          </Button>
        </div>
      )}
    </>
  )
}

export function CultivationHistoryCard({
  cultivationHistory,
}: {
  cultivationHistory: CultivationHistory[]
}) {
  const handleCopy = () => {
    const header = "jaar\tgewascode\tgewas\tis_rustgewas"
    const rows = cultivationHistory.map(
      (cultivation) =>
        `${cultivation.year}\t${cultivation.b_lu_catalogue.replace(
          /^nl_/,
          "",
        )}\t${cultivation.b_lu_name ?? ""}\t${cultivation.b_lu_rest_oravib ? "Ja" : "Nee"}`,
    )
    const tsv = [header, ...rows].join("\n")

    navigator.clipboard.writeText(tsv).then(
      () => {
        toast.success("Gekopieerd naar klembord")
      },
      () => {
        toast.error("Kopiëren naar klembord mislukt")
      },
    )
  }

  return (
    <Card className="col-span-1 overflow-hidden lg:row-span-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl font-bold">Gewashistorie</CardTitle>
          </div>
          <CardDescription>
            Dit zijn de gewassen zoals geregistreerd in de Basisregistratie Gewaspercelen (BRP).
          </CardDescription>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleCopy}
                aria-label="Kopieer naar klembord"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Kopieer naar klembord</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>

      <Separator className="opacity-50" />

      <CardContent className="pt-6 text-sm">
        <CultivationHistoryTimeline cultivationHistory={cultivationHistory} />
      </CardContent>
    </Card>
  )
}

export function CultivationHistorySkeleton() {
  const SKELETON_KEYS = ["sk-1", "sk-2", "sk-3"] as const

  return (
    <Card className="col-span-1 overflow-hidden lg:row-span-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle>Gewashistorie</CardTitle>
          <CardDescription>
            Dit zijn de gewassen zoals geregistreerd in de Basisregistratie Gewaspercelen (BRP).
          </CardDescription>
        </div>
        <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
      </CardHeader>
      <Separator className="opacity-50" />
      <CardContent className="pt-6 text-sm">
        <div className="relative pl-1">
          {SKELETON_KEYS.map((key, index) => (
            <div key={key} className="relative flex items-start space-x-4 pb-6">
              {index !== SKELETON_KEYS.length - 1 && (
                <div className="bg-border absolute top-10 left-4.75 h-full w-0.5" />
              )}
              <Skeleton className="relative z-10 h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
