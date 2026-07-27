import type { LoaderFunctionArgs } from "react-router"
import { type Fertilizer, getFertilizers } from "@nmi-agro/fdm-core"
import { Pencil, Plus } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { Link, useLoaderData, useNavigate, useSearchParams } from "react-router"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { getFertilizerCategoryFromRvoCode } from "~/components/blocks/fertilizer/utils"
import { getRvoMappings } from "~/components/blocks/fertilizer/utils.server"
import { FertilizerBadge } from "~/components/custom/fertilizer-badge"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import { getSession } from "~/lib/auth.server"
import { fdm } from "~/lib/fdm.server"

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { b_id_farm } = params
  if (!b_id_farm) {
    throw new Error("Farm ID is required")
  }

  const session = await getSession(request)

  const fertilizers = await getFertilizers(fdm, session.principal_id, b_id_farm)

  const { rvoLabels } = await getRvoMappings()

  return {
    b_id_farm: b_id_farm,
    fertilizers: fertilizers,
    rvoLabels,
  }
}

/**
 * Renders the new fertilizer wizard start page.
 *
 * Provides two paths: selecting a template from the catalogue or starting with a blank form.
 */
export default function NewFertilizerIndexPage() {
  const { fertilizers, b_id_farm, rvoLabels } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [searchQuery, setSearchQuery] = useState("")

  const getSourceName = useCallback((isCustom: boolean) => {
    if (isCustom) return "Eigen meststof"
    return "Standaard"
  }, [])

  const handleSelect = (p_id: string) => {
    const returnUrl = searchParams.get("returnUrl")
    const url = returnUrl ? `${p_id}?returnUrl=${encodeURIComponent(returnUrl)}` : `${p_id}`
    void navigate(url)
  }

  // Filter logic built into Command, but we prepare data here
  const preparedFertilizers = useMemo(() => {
    return fertilizers.map((f: Fertilizer) => {
      const isCustom = f.p_source === b_id_farm
      const rvoLabel = f.p_type_rvo ? rvoLabels[f.p_type_rvo] : ""
      return {
        ...f,
        isCustom,
        rvoLabel,
        sourceName: getSourceName(isCustom),
        searchString:
          `${f.p_name_nl} ${f.p_type_rvo || ""} ${rvoLabel} ${getSourceName(isCustom)}`.toLowerCase(),
      }
    })
  }, [fertilizers, b_id_farm, rvoLabels, getSourceName])

  return (
    <div className="space-y-8">
      <FarmTitle
        title={"Meststof toevoegen"}
        description={
          "Kies hoe u een nieuwe meststof wilt toevoegen: start met een leeg formulier of gebruik een bestaand product uit de catalogus als basis."
        }
      />
      <div className="p-4 pt-0 md:p-8 md:pt-0">
        <div className="mx-auto w-full max-w-6xl">
          <div className="relative">
            <div className="grid grid-cols-1 items-start gap-16 lg:grid-cols-2 lg:gap-32">
              {/* Choice 1: Manual Creation */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                      1
                    </div>
                    <h2 className="text-foreground text-2xl font-bold tracking-tight">
                      Zelf samenstellen
                    </h2>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Heeft u een specifieke analyse van een product? Start met een leeg formulier en
                    voer alle parameters handmatig in.
                  </p>
                </div>

                <Card className="bg-muted/20 hover:bg-muted/30 group flex flex-col items-center justify-center border-2 border-dashed p-10 transition-colors">
                  <div className="bg-background mb-6 flex h-16 w-16 items-center justify-center rounded-full shadow-sm transition-transform group-hover:scale-110">
                    <Plus className="text-primary h-8 w-8" />
                  </div>
                  <Button asChild size="lg" className="w-full font-bold shadow-sm">
                    <Link
                      to={
                        searchParams.has("returnUrl")
                          ? `custom?returnUrl=${encodeURIComponent(searchParams.get("returnUrl") ?? "")}`
                          : "custom"
                      }
                    >
                      Start leeg formulier
                    </Link>
                  </Button>
                </Card>
              </div>

              {/* Choice 2: Select from Catalogue */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                      2
                    </div>
                    <h2 className="text-foreground text-2xl font-bold tracking-tight">
                      Kies uit lijst
                    </h2>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Zoek in de standaard catalogus of uw eigen lijst om een meststof als sjabloon te
                    gebruiken en snel te kunnen starten.
                  </p>
                </div>

                <Card className="overflow-hidden border-2 shadow-sm">
                  <Command className="border-none" shouldFilter={false}>
                    <CommandInput
                      aria-label="Zoek meststof in catalogus"
                      placeholder="Zoek product of categorie..."
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                      className="py-6 text-base"
                    />
                    <CommandList className="max-h-112.5 overflow-y-auto border-t p-2">
                      <CommandEmpty className="text-muted-foreground px-4 py-10 text-center text-sm leading-relaxed">
                        Geen meststoffen gevonden voor "{searchQuery}"<br />
                        <span className="text-xs">
                          Probeer een andere zoekterm of gebruik handmatige invoer.
                        </span>
                      </CommandEmpty>
                      <CommandGroup>
                        {preparedFertilizers
                          .filter(
                            (f) =>
                              !searchQuery || f.searchString.includes(searchQuery.toLowerCase()),
                          )
                          .map((fertilizer) => (
                            <CommandItem
                              key={fertilizer.p_id}
                              value={fertilizer.p_id}
                              onSelect={() => handleSelect(fertilizer.p_id)}
                              className="mb-1 flex cursor-pointer items-center justify-between rounded-md p-3"
                            >
                              <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-foreground truncate text-base font-medium">
                                    {fertilizer.p_name_nl || "Onbekend"}
                                  </span>
                                  {fertilizer.isCustom && (
                                    <Badge
                                      variant="secondary"
                                      className="h-4 shrink-0 border-amber-200 bg-amber-100 px-1.5 py-0 text-[10px] font-normal text-amber-800"
                                    >
                                      <Pencil className="mr-1 h-2.5 w-2.5" />
                                      Eigen
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-muted-foreground flex items-center gap-3 text-xs">
                                  <span className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                                    <span>
                                      N:{" "}
                                      <strong className="text-foreground font-medium">
                                        {fertilizer.p_n_rt ?? "-"}
                                      </strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                      P₂O₅:{" "}
                                      <strong className="text-foreground font-medium">
                                        {fertilizer.p_p_rt ?? "-"}
                                      </strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                      K₂O:{" "}
                                      <strong className="text-foreground font-medium">
                                        {fertilizer.p_k_rt ?? "-"}
                                      </strong>
                                    </span>
                                  </span>
                                </div>
                              </div>

                              {fertilizer.p_type_rvo && (
                                <FertilizerBadge
                                  p_type={getFertilizerCategoryFromRvoCode(fertilizer.p_type_rvo)}
                                  variant="category-solid"
                                  className="ml-4 hidden shrink-0 font-medium sm:flex"
                                >
                                  {fertilizer.rvoLabel || "Meststof"}
                                </FertilizerBadge>
                              )}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </Card>
              </div>

              {/* Vertical Separator for desktop */}
              <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-center justify-center px-4 lg:flex">
                <div className="bg-border relative h-full w-px">
                  <div className="bg-background text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase shadow-sm">
                    OF
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
