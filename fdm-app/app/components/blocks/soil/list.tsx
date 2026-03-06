import type { SoilParameterDescription } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import { NavLink, type useFetcher } from "react-router"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"
import type { SoilAnalysis } from "./types"

export function SoilAnalysesList({
    soilAnalyses,
    soilParameterDescription,
    fetcher,
    canModifySoilAnalysis = {},
}: {
    soilAnalyses: SoilAnalysis[]
    soilParameterDescription: SoilParameterDescription
    fetcher: ReturnType<typeof useFetcher>
    canModifySoilAnalysis?: Record<string, boolean>
}) {
    const handleDelete = (a_id: string) => {
        if (fetcher.state !== "idle") return

        fetcher.submit({ a_id }, { method: "DELETE" })
    }
    const sourceParam = soilParameterDescription.find(
        (x: { parameter: string }) => x.parameter === "a_source",
    )

    return (
        <div className="space-y-4">
            <div className="grid gap-6">
                {soilAnalyses.map((analysis) => {
                    const sourceOption = sourceParam?.options?.find(
                        (x: { value: string }) => x.value === analysis.a_source,
                    )
                    const sourceLabel =
                        sourceOption?.label || analysis.a_source || "Onbekend"

                    const isDeleting =
                        fetcher.state !== "idle" &&
                        fetcher.formData?.get("a_id") === analysis.a_id

                    return (
                        <div
                            className="grid grid-cols-3 gap-x-3 items-center"
                            key={analysis.a_id}
                        >
                            <div className="col-span-1">
                                <p className="text-sm font-medium leading-none">
                                    {analysis.a_source === "nl-other-nmi"
                                        ? "Geschat met NMI BodemSchat"
                                        : format(
                                              analysis.b_sampling_date,
                                              "PP",
                                              {
                                                  locale: nl,
                                              },
                                          )}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {analysis.a_source === "nl-other-nmi"
                                        ? null
                                        : analysis.a_source === "" ||
                                            !analysis.a_source
                                          ? "Onbekende bron"
                                          : `Gemeten door ${sourceLabel}`}
                                </p>
                            </div>
                            <div>{""}</div>

                            <div className="justify-self-end">
                                <div className="space-x-4">
                                    <NavLink
                                        to={`./analysis/${analysis.a_id}`}
                                        asChild
                                        className={cn(
                                            "pointer-events-auto",
                                            analysis.a_source === "nl-other-nmi"
                                                ? "pointer-events-none"
                                                : "",
                                        )}
                                    >
                                        <Button
                                            variant="default"
                                            disabled={
                                                fetcher.state ===
                                                    "submitting" ||
                                                analysis.a_source ===
                                                    "nl-other-nmi"
                                            }
                                        >
                                            Bewerk
                                        </Button>
                                    </NavLink>
                                    <Button
                                        variant="destructive"
                                        disabled={
                                            fetcher.state !== "idle" ||
                                            analysis.a_source === "nl-other-nmi"
                                        }
                                        onClick={() => {
                                            handleDelete(analysis.a_id)
                                        }}
                                        className={cn(
                                            !canModifySoilAnalysis[
                                                analysis.a_id
                                            ]
                                                ? "hidden"
                                                : "",
                                        )}
                                    >
                                        {isDeleting ? (
                                            <div className="flex items-center space-x-2">
                                                <Spinner />
                                                <span>Verwijderen...</span>
                                            </div>
                                        ) : (
                                            "Verwijder"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
