import { ArrowRightLeft, BookOpenText, Gauge, Landmark, MapIcon, Minus, Plus } from "lucide-react"
import { useState } from "react"
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import { useFarmStore } from "@/app/store/farm"
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

  let atlasLink: string | undefined
  let atlasFieldsLink: string | undefined
  let atlasElevationLink: string | undefined
  let atlasSoilLink: string | undefined
  let atlasSoilAnalysisLink: string | undefined
  let atlasIndicatorsLink: string | undefined
  if (isCreateFarmWizard) {
    atlasLink = undefined
    atlasFieldsLink = undefined
    atlasElevationLink = undefined
    atlasSoilLink = undefined
    atlasSoilAnalysisLink = undefined
    atlasIndicatorsLink = undefined
  } else if (farmId && farmId !== "undefined") {
    atlasLink = `/farm/${farmId}/${selectedCalendar}/atlas`
    atlasFieldsLink = `/farm/${farmId}/${selectedCalendar}/atlas/fields`
    atlasElevationLink = `/farm/${farmId}/${selectedCalendar}/atlas/elevation`
    atlasSoilLink = `/farm/${farmId}/${selectedCalendar}/atlas/soil`
    atlasSoilAnalysisLink = `/farm/${farmId}/${selectedCalendar}/atlas/soil-analysis`
    atlasIndicatorsLink = `/farm/${farmId}/${selectedCalendar}/atlas/indicators`
  } else {
    atlasLink = `/farm/undefined/${selectedCalendar}/atlas`
    atlasFieldsLink = `/farm/undefined/${selectedCalendar}/atlas/fields`
    atlasElevationLink = `/farm/undefined/${selectedCalendar}/atlas/elevation`
    atlasSoilLink = `/farm/undefined/${selectedCalendar}/atlas/soil`
    atlasSoilAnalysisLink = undefined
    atlasIndicatorsLink = undefined
  }

  const activeAtlasTab =
    atlasIndicatorsLink && location.pathname.includes(atlasIndicatorsLink)
      ? "indicators"
      : atlasFieldsLink && location.pathname.includes(atlasFieldsLink)
        ? "fields"
        : atlasElevationLink && location.pathname.includes(atlasElevationLink)
          ? "elevation"
          : atlasSoilAnalysisLink && location.pathname.includes(atlasSoilAnalysisLink)
            ? "soil-analysis"
            : atlasSoilLink && location.pathname.includes(atlasSoilLink)
              ? "soil"
              : undefined

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
              defaultOpen={!!atlasLink && location.pathname.includes(atlasLink)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                {atlasLink ? (
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={location.pathname.includes(atlasLink)}>
                      <MapIcon />
                      <span>Atlas</span>
                      <Plus className="ml-auto group-data-[state=open]/collapsible:hidden" />
                      <Minus className="ml-auto group-data-[state=closed]/collapsible:hidden" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        isActive={false}
                        className="hover:text-muted-foreground active:text-muted-foreground cursor-not-allowed opacity-50 hover:bg-transparent active:bg-transparent"
                      >
                        <MapIcon className="text-muted-foreground" />
                        <span className="text-muted-foreground">Atlas</span>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Atlas is niet beschikbaar tijdens het aanmaken van een bedrijf
                    </TooltipContent>
                  </Tooltip>
                )}
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {atlasFieldsLink ? (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={activeAtlasTab === "fields"}>
                          <NavLink to={atlasFieldsLink}>
                            <span>Gewaspercelen</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ) : null}
                    {atlasSoilAnalysisLink ? (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={activeAtlasTab === "soil-analysis"}>
                          <NavLink to={atlasSoilAnalysisLink}>
                            <span>Bodemanalyses</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ) : !isCreateFarmWizard ? (
                      <SidebarMenuSubItem>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuSubButton
                              className="text-muted-foreground"
                              onClick={() =>
                                openFarmPicker(
                                  "bodemanalyses",
                                  (b_id_farm) =>
                                    `/farm/${b_id_farm}/${selectedCalendar}/atlas/soil-analysis`,
                                )
                              }
                            >
                              <span>Bodemanalyses</span>
                            </SidebarMenuSubButton>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            Bodemanalyses is beschikbaar nadat u een bedrijf heeft geselecteerd
                          </TooltipContent>
                        </Tooltip>
                      </SidebarMenuSubItem>
                    ) : null}
                    {atlasElevationLink ? (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={activeAtlasTab === "elevation"}>
                          <NavLink to={atlasElevationLink}>
                            <span>Hoogtekaart</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ) : null}
                    {atlasSoilLink ? (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={activeAtlasTab === "soil"}>
                          <NavLink to={atlasSoilLink}>
                            <span>Bodemkaart</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ) : null}
                    {atlasIndicatorsLink ? (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={activeAtlasTab === "indicators"}>
                          <NavLink to={atlasIndicatorsLink}>
                            <span>Indicatoren</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ) : !isCreateFarmWizard ? (
                      <SidebarMenuSubItem>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuSubButton
                              className="text-muted-foreground"
                              onClick={() =>
                                openFarmPicker(
                                  "indicatoren",
                                  (b_id_farm) =>
                                    `/farm/${b_id_farm}/${selectedCalendar}/atlas/indicators`,
                                )
                              }
                            >
                              <span>Indicatoren</span>
                            </SidebarMenuSubButton>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            Indicatoren is beschikbaar nadat u een bedrijf heeft geselecteerd
                          </TooltipContent>
                        </Tooltip>
                      </SidebarMenuSubItem>
                    ) : null}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
            <Collapsible defaultOpen={!!nitrogenBalanceLink} className="group/collapsible">
              <SidebarMenuItem>
                {nitrogenBalanceLink ? (
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <ArrowRightLeft />
                      <span>Balans</span>
                      <Plus className="ml-auto group-data-[state=open]/collapsible:hidden" />
                      <Minus className="ml-auto group-data-[state=closed]/collapsible:hidden" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                ) : canPickFarm ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
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
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Selecteer een bedrijf om de balansen te raadplegen
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        isActive={false}
                        className="hover:text-muted-foreground active:text-muted-foreground cursor-not-allowed opacity-50 hover:bg-transparent active:bg-transparent"
                      >
                        <ArrowRightLeft className="text-muted-foreground" />
                        <span className="text-muted-foreground">Balans</span>
                      </SidebarMenuButton>
                    </TooltipTrigger>
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
                          asChild
                          isActive={location.pathname.includes(nitrogenBalanceLink)}
                        >
                          <NavLink to={nitrogenBalanceLink}>
                            <span>Stikstof</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      ) : null}
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      {omBalanceLink ? (
                        <SidebarMenuSubButton
                          asChild
                          isActive={location.pathname.includes(omBalanceLink)}
                        >
                          <NavLink to={omBalanceLink}>
                            <span>Organische stof</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      ) : null}
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
            <SidebarMenuItem>
              {nutrientAdviceLink ? (
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname.includes(nutrientAdviceLink)}
                >
                  <NavLink to={nutrientAdviceLink}>
                    <BookOpenText />
                    <span>Bemestingsadvies</span>
                  </NavLink>
                </SidebarMenuButton>
              ) : canPickFarm ? (
                <Tooltip>
                  <TooltipTrigger asChild>
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
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Selecteer een bedrijf voor bemestingsadvies
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      isActive={false}
                      className="hover:text-muted-foreground active:text-muted-foreground cursor-not-allowed opacity-50 hover:bg-transparent active:bg-transparent"
                    >
                      <BookOpenText className="text-muted-foreground" />
                      <span className="text-muted-foreground">Bemestingsadvies</span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Selecteer een bedrijf voor bemestingsadvies
                  </TooltipContent>
                </Tooltip>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              {normsLink ? (
                <SidebarMenuButton asChild isActive={location.pathname.includes(normsLink)}>
                  <NavLink to={normsLink}>
                    <Landmark />
                    <span>Gebruiksruimte</span>
                  </NavLink>
                </SidebarMenuButton>
              ) : canPickFarm ? (
                <Tooltip>
                  <TooltipTrigger asChild>
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
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Selecteer een bedrijf om de gebruiksruimte te berekenen
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      isActive={false}
                      className="hover:text-muted-foreground active:text-muted-foreground cursor-not-allowed opacity-50 hover:bg-transparent active:bg-transparent"
                    >
                      <Landmark className="text-muted-foreground" />
                      <span className="text-muted-foreground">Gebruiksruimte</span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Selecteer een bedrijf om de gebruiksruimte te berekenen
                  </TooltipContent>
                </Tooltip>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              {indicatorsLink ? (
                <SidebarMenuButton
                  asChild
                  isActive={
                    location.pathname.includes("/indicators") &&
                    !location.pathname.includes("/atlas/indicators")
                  }
                >
                  <NavLink to={indicatorsLink}>
                    <Gauge />
                    <span>Indicatoren</span>
                  </NavLink>
                </SidebarMenuButton>
              ) : canPickFarm ? (
                <Tooltip>
                  <TooltipTrigger asChild>
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
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Selecteer een bedrijf om de indicatoren te bekijken
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      isActive={false}
                      className="hover:text-muted-foreground active:text-muted-foreground cursor-not-allowed opacity-50 hover:bg-transparent active:bg-transparent"
                    >
                      <Gauge className="text-muted-foreground" />
                      <span className="text-muted-foreground">Indicatoren</span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
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
