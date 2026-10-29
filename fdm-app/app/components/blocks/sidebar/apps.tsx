import { ArrowRightLeft, BookOpenText, Gauge, Landmark, MapIcon, Minus, Plus } from "lucide-react"
import { useState } from "react"
import { NavLink, useLocation, useNavigate, useParams, useSearchParams } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import { useFarmStore } from "@/app/store/farm"
import {
  useAvailableAtlasLayers,
  useCurrentAtlasLayer,
} from "~/components/blocks/atlas/atlas-layer"
import { FarmPickerDialog } from "~/components/blocks/sidebar/farm-picker-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "~/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"

export function SidebarApps({
  farms = [],
}: {
  farms?: { b_id_farm: string; b_name_farm: string | null }[]
}) {
  const farmId = useFarmStore((state) => state.farmId)
  const selectedCalendar = useCalendarStore((state) => state.calendar)
  const navigate = useNavigate()

  // Check if the page or its return page contains `farm/create` in url
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const params = useParams()

  const isCreateFarmWizard =
    location.pathname.includes("farm/create") ||
    searchParams.get("returnUrl")?.includes("farm/create")

  const isFarmOverview = location.pathname === "/farm" || location.pathname === "/farm/"

  const noFarmSelected = !farmId || farmId === "undefined"
  // Only offer the farm picker when the item is inactive purely because no farm is
  // selected yet; not during the create-farm wizard or on the farm overview page.
  const canPickFarm = noFarmSelected && !isCreateFarmWizard

  const [pendingFeature, setPendingFeature] = useState<{
    label: string
    resolvePath: (b_id_farm: string) => string
  } | null>(null)

  const openFarmPicker = (label: string, resolvePath: (b_id_farm: string) => string) => {
    setPendingFeature({ label, resolvePath })
  }

  const handleFarmPicked = (b_id_farm: string) => {
    if (pendingFeature) {
      void navigate(pendingFeature.resolvePath(b_id_farm))
    }
    setPendingFeature(null)
  }

  const activeAtlasTab = useCurrentAtlasLayer()
  const atlasLinks = useAvailableAtlasLayers(true)

  let nitrogenBalanceLink: string | undefined
  if (isCreateFarmWizard || isFarmOverview) {
    nitrogenBalanceLink = undefined
  } else if (farmId && farmId !== "undefined") {
    nitrogenBalanceLink = `/farm/${farmId}/${selectedCalendar}/balance/nitrogen`
  } else {
    nitrogenBalanceLink = undefined
  }

  let nutrientAdviceLink: string | undefined
  if (isCreateFarmWizard) {
    nutrientAdviceLink = undefined
  } else if (farmId && farmId !== "undefined") {
    nutrientAdviceLink = `/farm/${farmId}/${selectedCalendar}/nutrient_advice`
  } else {
    nutrientAdviceLink = undefined
  }

  let normsLink: string | undefined
  if (isCreateFarmWizard) {
    normsLink = undefined
  } else if (farmId && farmId !== "undefined") {
    normsLink = `/farm/${farmId}/${selectedCalendar}/norms`
  } else {
    normsLink = undefined
  }

  let omBalanceLink: string | undefined
  if (isCreateFarmWizard || isFarmOverview) {
    omBalanceLink = undefined
  } else if (farmId && farmId !== "undefined") {
    omBalanceLink = `/farm/${farmId}/${selectedCalendar}/balance/organic-matter`
  } else {
    omBalanceLink = undefined
  }

  let indicatorsLink: string | undefined
  if (isCreateFarmWizard) {
    indicatorsLink = undefined
  } else if (farmId && farmId !== "undefined") {
    indicatorsLink = `/farm/${farmId}/${selectedCalendar}/indicators`
  } else {
    indicatorsLink = undefined
  }

  return (
    <TooltipProvider>
      <SidebarGroup>
        <SidebarGroupLabel>Apps</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <Collapsible
              defaultOpen={!!atlasLinks.length && location.pathname.includes("/atlas/")}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                {!isCreateFarmWizard ? (
                  <CollapsibleTrigger
                    render={
                      <SidebarMenuButton isActive={location.pathname.includes("/atlas/")}>
                        <MapIcon />
                        <span>Atlas</span>
                        <Plus className="ml-auto group-data-[state=open]/collapsible:hidden" />
                        <Minus className="ml-auto group-data-[state=closed]/collapsible:hidden" />
                      </SidebarMenuButton>
                    }
                  />
                ) : (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <SidebarMenuButton
                          isActive={false}
                          className="hover:text-muted-foreground active:text-muted-foreground cursor-not-allowed opacity-50 hover:bg-transparent active:bg-transparent"
                        >
                          <MapIcon className="text-muted-foreground" />
                          <span className="text-muted-foreground">Atlas</span>
                        </SidebarMenuButton>
                      }
                    />
                    <TooltipContent side="right">
                      Atlas is niet beschikbaar tijdens het aanmaken van een bedrijf
                    </TooltipContent>
                  </Tooltip>
                )}
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {atlasLinks.map((info) => {
                      if (info.requiresFarm && canPickFarm) {
                        return (
                          <SidebarMenuSubItem key={info.value}>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <SidebarMenuSubButton
                                    className="text-muted-foreground"
                                    onClick={() =>
                                      openFarmPicker(
                                        info.value === "indicators"
                                          ? "de indicatoren"
                                          : info.value === "soil-analysis"
                                            ? "de bodemanalyses"
                                            : info.value === "nutrient-advice"
                                              ? "het bemestingsadvies"
                                              : info.label.toLowerCase(),
                                        (b_id_farm) =>
                                          info.config.url({
                                            ...params,
                                            b_id_farm,
                                            calendar: selectedCalendar,
                                          }) as string,
                                      )
                                    }
                                  >
                                    <span>{info.label}</span>
                                  </SidebarMenuSubButton>
                                }
                              />
                              <TooltipContent side="right">
                                {info.label} is beschikbaar nadat u een bedrijf heeft geselecteerd
                              </TooltipContent>
                            </Tooltip>
                          </SidebarMenuSubItem>
                        )
                      }
                      return (
                        <SidebarMenuSubItem key={info.value}>
                          <SidebarMenuSubButton
                            isActive={activeAtlasTab === info.value}
                            render={
                              <NavLink to={info.url}>
                                <span>{info.label}</span>
                              </NavLink>
                            }
                          />
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
            <Collapsible defaultOpen={!!nitrogenBalanceLink} className="group/collapsible">
              <SidebarMenuItem>
                {nitrogenBalanceLink ? (
                  <CollapsibleTrigger
                    render={
                      <SidebarMenuButton>
                        <ArrowRightLeft />
                        <span>Balans</span>
                        <Plus className="visible ml-auto group-data-panel-open/collapsible:hidden" />
                        <Minus className="ml-auto hidden group-data-panel-open/collapsible:visible" />
                      </SidebarMenuButton>
                    }
                  />
                ) : canPickFarm ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <SidebarMenuButton
                          className="text-muted-foreground"
                          onClick={() =>
                            openFarmPicker(
                              "de balansen",
                              (b_id_farm) =>
                                `/farm/${b_id_farm}/${selectedCalendar}/balance/nitrogen`,
                            )
                          }
                        >
                          <ArrowRightLeft />
                          <span>Balans</span>
                        </SidebarMenuButton>
                      }
                    />
                    <TooltipContent side="right">
                      Selecteer een bedrijf om de balansen te raadplegen
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <SidebarMenuButton
                          isActive={false}
                          className="hover:text-muted-foreground active:text-muted-foreground cursor-not-allowed opacity-50 hover:bg-transparent active:bg-transparent"
                        >
                          <ArrowRightLeft className="text-muted-foreground" />
                          <span className="text-muted-foreground">Balans</span>
                        </SidebarMenuButton>
                      }
                    />
                    <TooltipContent side="right">
                      Selecteer een bedrijf om de balansen te raadplegen
                    </TooltipContent>
                  </Tooltip>
                )}
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      {nitrogenBalanceLink ? (
                        <SidebarMenuSubButton
                          isActive={location.pathname.includes(nitrogenBalanceLink)}
                          render={
                            <NavLink to={nitrogenBalanceLink}>
                              <span>Stikstof</span>
                            </NavLink>
                          }
                        />
                      ) : null}
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      {omBalanceLink ? (
                        <SidebarMenuSubButton
                          isActive={location.pathname.includes(omBalanceLink)}
                          render={
                            <NavLink to={omBalanceLink}>
                              <span>Organische stof</span>
                            </NavLink>
                          }
                        />
                      ) : null}
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
            <SidebarMenuItem>
              {nutrientAdviceLink ? (
                <SidebarMenuButton
                  isActive={location.pathname.includes(nutrientAdviceLink)}
                  render={
                    <NavLink to={nutrientAdviceLink}>
                      <BookOpenText />
                      <span>Bemestingsadvies</span>
                    </NavLink>
                  }
                />
              ) : canPickFarm ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <SidebarMenuButton
                        className="text-muted-foreground"
                        onClick={() =>
                          openFarmPicker(
                            "bemestingsadvies",
                            (b_id_farm) => `/farm/${b_id_farm}/${selectedCalendar}/nutrient_advice`,
                          )
                        }
                      >
                        <BookOpenText />
                        <span>Bemestingsadvies</span>
                      </SidebarMenuButton>
                    }
                  />
                  <TooltipContent side="right">
                    Selecteer een bedrijf voor bemestingsadvies
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <SidebarMenuButton
                        isActive={false}
                        className="hover:text-muted-foreground active:text-muted-foreground cursor-not-allowed opacity-50 hover:bg-transparent active:bg-transparent"
                      >
                        <BookOpenText className="text-muted-foreground" />
                        <span className="text-muted-foreground">Bemestingsadvies</span>
                      </SidebarMenuButton>
                    }
                  />
                  <TooltipContent side="right">
                    Selecteer een bedrijf voor bemestingsadvies
                  </TooltipContent>
                </Tooltip>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              {normsLink ? (
                <SidebarMenuButton
                  isActive={location.pathname.includes(normsLink)}
                  render={
                    <NavLink to={normsLink}>
                      <Landmark />
                      <span>Gebruiksruimte</span>
                    </NavLink>
                  }
                />
              ) : canPickFarm ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <SidebarMenuButton
                        className="text-muted-foreground"
                        onClick={() =>
                          openFarmPicker(
                            "de gebruiksruimte",
                            (b_id_farm) => `/farm/${b_id_farm}/${selectedCalendar}/norms`,
                          )
                        }
                      >
                        <Landmark />
                        <span>Gebruiksruimte</span>
                      </SidebarMenuButton>
                    }
                  />
                  <TooltipContent side="right">
                    Selecteer een bedrijf om de gebruiksruimte te berekenen
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <SidebarMenuButton
                        isActive={false}
                        className="hover:text-muted-foreground active:text-muted-foreground cursor-not-allowed opacity-50 hover:bg-transparent active:bg-transparent"
                      >
                        <Landmark className="text-muted-foreground" />
                        <span className="text-muted-foreground">Gebruiksruimte</span>
                      </SidebarMenuButton>
                    }
                  />
                  <TooltipContent side="right">
                    Selecteer een bedrijf om de gebruiksruimte te berekenen
                  </TooltipContent>
                </Tooltip>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              {indicatorsLink ? (
                <SidebarMenuButton
                  isActive={
                    location.pathname.includes("/indicators") &&
                    !location.pathname.includes("/atlas/indicators")
                  }
                  render={
                    <NavLink to={indicatorsLink}>
                      <Gauge />
                      <span>Indicatoren</span>
                    </NavLink>
                  }
                />
              ) : canPickFarm ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <SidebarMenuButton
                        className="text-muted-foreground"
                        onClick={() =>
                          openFarmPicker(
                            "de indicatoren",
                            (b_id_farm) => `/farm/${b_id_farm}/${selectedCalendar}/indicators`,
                          )
                        }
                      >
                        <Gauge />
                        <span>Indicatoren</span>
                      </SidebarMenuButton>
                    }
                  />
                  <TooltipContent side="right">
                    Selecteer een bedrijf om de indicatoren te bekijken
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <SidebarMenuButton
                        isActive={false}
                        className="hover:text-muted-foreground active:text-muted-foreground cursor-not-allowed opacity-50 hover:bg-transparent active:bg-transparent"
                      >
                        <Gauge className="text-muted-foreground" />
                        <span className="text-muted-foreground">Indicatoren</span>
                      </SidebarMenuButton>
                    }
                  />
                  <TooltipContent side="right">
                    Selecteer een bedrijf om de indicatoren te bekijken
                  </TooltipContent>
                </Tooltip>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <FarmPickerDialog
        open={pendingFeature !== null}
        onOpenChange={(open) => {
          if (!open) setPendingFeature(null)
        }}
        farms={farms}
        featureLabel={pendingFeature?.label ?? ""}
        onSelectFarm={handleFarmPicked}
      />
    </TooltipProvider>
  )
}
