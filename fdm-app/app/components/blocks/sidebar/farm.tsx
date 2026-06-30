import type { getFarm } from "@nmi-agro/fdm-core"
import {
  Bot,
  Bubbles,
  Calendar,
  Check,
  ChevronRight,
  ClipboardList,
  Grid2x2,
  House,
  LandPlot,
  LayoutGrid,
  Shapes,
  Sprout,
} from "lucide-react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { useState, useEffect } from "react"
import { NavLink, useLocation, useSearchParams, useNavigate } from "react-router"
import { getCalendarSelection } from "@/app/lib/calendar"
import { useCalendarStore } from "@/app/store/calendar"
import { useFarmStore } from "@/app/store/farm"
import { useSelectedFieldStore } from "@/app/store/selected-field"
import { Badge } from "~/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
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
import { getFieldNavigationItems } from "~/lib/field-navigation"

export function SidebarFarm({
  farm,
  fields = [],
  farmWritePermission = false,
  activeFieldId,
}: {
  farm: Awaited<ReturnType<typeof getFarm>> | undefined
  fields?: { b_id: string; b_name: string; b_area: number }[]
  farmWritePermission?: boolean
  activeFieldId?: string | null
}) {
  function getSuperiorRole(allRoles: { role: "owner" | "advisor" | "researcher" }[]) {
    if (allRoles.length > 0) {
      const ordering = ["owner", "advisor", "researcher"] as const
      const sorted = [...allRoles].sort(
        (a, b) => ordering.indexOf(a.role) - ordering.indexOf(b.role),
      )
      return sorted[0].role
    }
    return null
  }

  const farmId = useFarmStore((state) => state.farmId)

  const selectedCalendar = useCalendarStore((state) => state.calendar)
  const setCalendar = useCalendarStore((state) => state.setCalendar)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const calendarSelection = getCalendarSelection()

  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Check if the page or its return page contains `farm/create` in url
  const isCreateFarmWizard =
    location.pathname.includes("farm/create") ||
    searchParams.get("returnUrl")?.includes("farm/create")
  const farmRole = farm ? getSuperiorRole(farm.roles) : null

  const isFarmOverview = location.pathname === "/farm" || location.pathname === "/farm/"

  const isFarmSelected = farmId && farmId !== "undefined" && !isCreateFarmWizard

  const { recentFieldIds, addRecentFieldId } = useSelectedFieldStore()

  const activeFieldName = activeFieldId
    ? (fields.find((f) => f.b_id === activeFieldId)?.b_name ?? null)
    : null
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isPerceelOpen, setIsPerceelOpen] = useState(false)
  const [targetSegment, setTargetSegment] = useState("overview")

  // Auto-expand whenever a field is active
  useEffect(() => {
    if (activeFieldId) {
      setIsPerceelOpen(true)
    }
  }, [activeFieldId])

  const getActiveSegment = () => {
    if (location.pathname.includes("/cultivation")) return "cultivation"
    if (location.pathname.includes("/fertilizer")) return "fertilizer"
    if (location.pathname.includes("/soil")) return "soil"
    if (location.pathname.includes("/bcs")) return "bcs"
    if (location.pathname.includes("/atlas")) return "atlas"
    if (location.pathname.includes("/delete")) return "delete"
    return "overview"
  }

  const handleSubSectionClick = (e: React.MouseEvent, segment: string) => {
    if (!activeFieldId) {
      e.preventDefault()
      setTargetSegment(segment)
      setIsPickerOpen(true)
    }
  }

  const handleSelectField = (b_id: string, _b_name: string) => {
    setIsPickerOpen(false)
    addRecentFieldId(b_id)

    const activeSegment = getActiveSegment()
    const segment = activeFieldId ? activeSegment : targetSegment

    navigate(`/farm/${farmId}/${selectedCalendar}/field/${b_id}/${segment}`)
  }

  const toggleCollapsible = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsPerceelOpen(!isPerceelOpen)
  }

  const recentFields = fields.filter((f) => recentFieldIds.includes(f.b_id))
  const regularFields = fields.filter((f) => !recentFieldIds.includes(f.b_id))

  const navigationItems = activeFieldId
    ? getFieldNavigationItems(farmId!, selectedCalendar!, activeFieldId, farmWritePermission)
    : getFieldNavigationItems(farmId ?? "", selectedCalendar ?? "", "", farmWritePermission)

  let rotationLink: string | undefined
  if (isCreateFarmWizard) {
    rotationLink = undefined
  } else if (farmId && farmId !== "undefined") {
    rotationLink = `/farm/${farmId}/${selectedCalendar}/rotation`
  } else {
    rotationLink = undefined
  }

  let fertilizersLink: string | undefined
  if (farmId && farmId !== "undefined") {
    fertilizersLink = `/farm/${farmId}/fertilizers`
  } else {
    fertilizersLink = undefined
  }

  let measuresLink: string | undefined
  if (isCreateFarmWizard) {
    measuresLink = undefined
  } else if (farmId && farmId !== "undefined") {
    measuresLink = `/farm/${farmId}/${selectedCalendar}/measures`
  } else {
    measuresLink = undefined
  }

  return (
    <TooltipProvider>
      <SidebarGroup>
        <SidebarGroupLabel>Bedrijf</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isFarmOverview || isCreateFarmWizard}
                tooltip="Mijn bedrijven"
              >
                <NavLink to="/farm">
                  <LayoutGrid />
                  <span>{isCreateFarmWizard ? "Terug naar bedrijven" : "Mijn bedrijven"}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {isFarmSelected && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={
                    location.pathname === `/farm/${farmId}` ||
                    location.pathname.includes(`/farm/${farmId}/settings`)
                  }
                  tooltip={farm?.b_name_farm ?? "Bedrijfsoverzicht"}
                >
                  <NavLink to={`/farm/${farmId}`}>
                    <House />
                    <span className="truncate font-medium">{farm?.b_name_farm ?? "Overzicht"}</span>
                    {farmRole && (
                      <Badge key={farmRole} variant="outline" className="ml-auto text-[10px]">
                        {farmRole === "owner"
                          ? "Eigenaar"
                          : farmRole === "advisor"
                            ? "Adviseur"
                            : farmRole === "researcher"
                              ? "Onderzoeker"
                              : "Lid"}
                      </Badge>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {/* Conditionally render the Kalender item */}
            {isFarmSelected ? (
              <Collapsible
                asChild
                open={isCalendarOpen}
                className="group/collapsible"
                onOpenChange={setIsCalendarOpen}
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={"Kalender"} className="flex items-center">
                      <Calendar />
                      <span>Kalender </span>
                      {!isCalendarOpen && (
                        <Badge className="ml-1">
                          {selectedCalendar === "all" ? "Alle jaren" : selectedCalendar}
                        </Badge>
                      )}
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {calendarSelection?.map((item) => {
                        // Construct the new URL with the selected calendar
                        const newUrl = location.pathname.replace(/\/(\d{4}|all)/, `/${item}`)
                        return (
                          <SidebarMenuSubItem
                            key={item}
                            className={
                              selectedCalendar === item ? "bg-accent text-accent-foreground" : ""
                            }
                          >
                            <SidebarMenuSubButton asChild onClick={() => setCalendar(item)}>
                              <NavLink to={newUrl} className="flex items-center">
                                <span>{item === "all" ? "Alle jaren" : item}</span>
                                {selectedCalendar === item && <Check className="ml-auto h-4 w-4" />}
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ) : (
              <SidebarMenuItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      className="cursor-not-allowed opacity-50 hover:bg-transparent"
                    >
                      <span className="flex items-center gap-2">
                        <Calendar />
                        <span>Kalender</span>
                      </span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Selecteer een bedrijf om de kalender te gebruiken
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            )}
            {isFarmSelected && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={
                    location.pathname === `/farm/${farmId}/${selectedCalendar}/field` ||
                    location.pathname === `/farm/${farmId}/${selectedCalendar}/field/`
                  }
                >
                  <NavLink to={`/farm/${farmId}/${selectedCalendar}/field`}>
                    <Grid2x2 />
                    <span>Percelen</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              {rotationLink ? (
                <SidebarMenuButton
                  asChild
                  isActive={
                    location.pathname.includes(`/farm/${farmId}/`) &&
                    location.pathname.includes("/rotation")
                  }
                >
                  <NavLink to={rotationLink}>
                    <Sprout />
                    <span>Bouwplan</span>
                  </NavLink>
                </SidebarMenuButton>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      className="cursor-not-allowed opacity-50 hover:bg-transparent"
                    >
                      <span className="flex items-center gap-2">
                        <Sprout />
                        <span>Bouwplan</span>
                      </span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Selecteer een bedrijf om het bouwplan te beheren
                  </TooltipContent>
                </Tooltip>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              {measuresLink ? (
                <SidebarMenuButton asChild isActive={location.pathname.includes("/measures")}>
                  <NavLink to={measuresLink}>
                    <ClipboardList />
                    <span>Maatregelen</span>
                  </NavLink>
                </SidebarMenuButton>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      className="cursor-not-allowed opacity-50 hover:bg-transparent"
                    >
                      <span className="flex items-center gap-2">
                        <ClipboardList />
                        <span>Maatregelen</span>
                      </span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Selecteer een bedrijf om de maatregelen te beheren
                  </TooltipContent>
                </Tooltip>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              {fertilizersLink ? (
                <SidebarMenuButton asChild isActive={location.pathname.includes(fertilizersLink)}>
                  <NavLink to={fertilizersLink}>
                    <Shapes />
                    <span>Meststoffen</span>
                  </NavLink>
                </SidebarMenuButton>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      className="cursor-not-allowed opacity-50 hover:bg-transparent"
                    >
                      <span className="flex items-center gap-2">
                        <Shapes />
                        <span>Meststoffen</span>
                      </span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Selecteer een bedrijf om meststoffen te beheren
                  </TooltipContent>
                </Tooltip>
              )}
            </SidebarMenuItem>
            {/* Context-aware Perceel group */}
            {isFarmSelected ? (
              <Collapsible
                asChild
                open={isPerceelOpen}
                className="group/collapsible"
                onOpenChange={setIsPerceelOpen}
              >
                <SidebarMenuItem>
                  <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                    <PopoverTrigger asChild>
                      <SidebarMenuButton
                        tooltip={"Perceel"}
                        className="flex w-full items-center justify-between"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                          <LandPlot className="size-4 shrink-0" />
                          <span className="truncate font-medium">
                            {activeFieldName ?? "Kies een perceel"}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={toggleCollapsible}
                          className="hover:bg-sidebar-accent/50 rounded-sm p-1 transition-transform duration-200"
                          style={{
                            transform: isPerceelOpen ? "rotate(90deg)" : "none",
                          }}
                        >
                          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                        </button>
                      </SidebarMenuButton>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start" side="right">
                      <Command>
                        <CommandInput
                          placeholder="Zoek perceel..."
                          className="border-none focus:ring-0 focus-visible:ring-0"
                        />
                        <CommandList className="max-h-[300px] overflow-y-auto">
                          <CommandEmpty>Geen percelen gevonden.</CommandEmpty>
                          {recentFields.length > 0 && (
                            <CommandGroup heading="Onlangs bezocht">
                              {recentFields.map((field) => (
                                <CommandItem
                                  key={`recent-${field.b_id}`}
                                  value={field.b_name}
                                  onSelect={() => handleSelectField(field.b_id, field.b_name)}
                                  className="flex cursor-pointer items-center justify-between"
                                >
                                  <span>{field.b_name}</span>
                                  <span className="text-muted-foreground text-xs">
                                    {field.b_area} ha
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                          <CommandGroup heading="Alle percelen">
                            {regularFields.map((field) => (
                              <CommandItem
                                key={field.b_id}
                                value={field.b_name}
                                onSelect={() => handleSelectField(field.b_id, field.b_name)}
                                className="flex cursor-pointer items-center justify-between"
                              >
                                <span>{field.b_name}</span>
                                <span className="text-muted-foreground text-xs">
                                  {field.b_area} ha
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {navigationItems.map((item) => (
                        <SidebarMenuSubItem key={item.segment}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location.pathname.startsWith(item.to)}
                          >
                            <NavLink
                              to={activeFieldId ? item.to : "#"}
                              onClick={(e) => handleSubSectionClick(e, item.segment)}
                            >
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ) : (
              <SidebarMenuItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      className="cursor-not-allowed opacity-50 hover:bg-transparent"
                    >
                      <span className="flex items-center gap-2">
                        <LandPlot />
                        <span>Percelen</span>
                      </span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Selecteer een bedrijf om uw percelen te beheren
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </TooltipProvider>
  )
}

export function SidebarLabs() {
  const farmId = useFarmStore((state) => state.farmId)
  const selectedCalendar = useCalendarStore((state) => state.calendar)
  const location = useLocation()
  const isGerritEnabled = useFeatureFlagEnabled("gerrit") ?? true
  const isMineralizationEnabled = useFeatureFlagEnabled("mineralization") ?? true

  const isFarmSelected = farmId && farmId !== "undefined"
  const isCreateFarmWizard = location.pathname.includes("farm/create")
  if (!isFarmSelected) return null

  return (
    <TooltipProvider>
      <SidebarGroup>
        <SidebarGroupLabel>Labs</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {isMineralizationEnabled && (
              <SidebarMenuItem>
                {!isCreateFarmWizard ? (
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname.includes(
                      `/farm/${farmId}/${selectedCalendar}/mineralization`,
                    )}
                    tooltip="Stikstofmineralisatie per perceel"
                  >
                    <NavLink to={`/farm/${farmId}/${selectedCalendar}/mineralization`}>
                      <Bubbles />
                      <span>Mineralisatie</span>
                    </NavLink>
                  </SidebarMenuButton>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        asChild
                        className="cursor-not-allowed opacity-50 hover:bg-transparent"
                      >
                        <span className="flex items-center gap-2">
                          <Bubbles />
                          <span>Mineralisatie</span>
                        </span>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Voltooi het aanmaken van uw bedrijf om Mineralisatie te gebruiken
                    </TooltipContent>
                  </Tooltip>
                )}
              </SidebarMenuItem>
            )}
            {isGerritEnabled && (
              <SidebarMenuItem>
                {!isCreateFarmWizard ? (
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname.includes(
                      `/farm/${farmId}/${selectedCalendar}/gerrit`,
                    )}
                    tooltip="Gerrit's Bemestingsplan"
                  >
                    <NavLink to={`/farm/${farmId}/${selectedCalendar}/gerrit`}>
                      <Bot />
                      <span>Gerrit</span>
                    </NavLink>
                  </SidebarMenuButton>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        asChild
                        className="cursor-not-allowed opacity-50 hover:bg-transparent"
                      >
                        <span className="flex items-center gap-2">
                          <Bot />
                          <span>Gerrit</span>
                        </span>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Voltooi het aanmaken van uw bedrijf om Gerrit te gebruiken
                    </TooltipContent>
                  </Tooltip>
                )}
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </TooltipProvider>
  )
}
