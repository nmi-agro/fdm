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
import { NavLink, useLocation, useSearchParams, useNavigate, useFetcher } from "react-router"
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
import { FarmPickerDialog } from "~/components/blocks/sidebar/farm-picker-dialog"
import { FieldPickerDialog } from "~/components/blocks/sidebar/field-picker-dialog"

export function SidebarFarm({
  farm,
  farms = [],
  fields = [],
  activeFieldId,
  fieldWritePermission = false,
}: {
  farm: Awaited<ReturnType<typeof getFarm>> | undefined
  farms?: { b_id_farm: string; b_name_farm: string | null }[]
  fields?: { b_id: string; b_name: string; b_area: number }[]
  activeFieldId?: string | null
  fieldWritePermission?: boolean
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
  const [targetSegment, setTargetSegment] = useState("")

  // Which farm-scoped feature the user tried to reach without a farm selected.
  const [pendingFeature, setPendingFeature] = useState<
    | { kind: "navigate"; label: string; resolvePath: (b_id_farm: string) => string }
    | { kind: "pick-field"; label: string }
    | null
  >(null)
  // Once a farm has been picked for the "pick-field" flow, load that farm's fields.
  const [fieldPickerFarmId, setFieldPickerFarmId] = useState<string | null>(null)
  const fieldOptionsFetcher = useFetcher<{
    fields: { b_id: string; b_name: string; b_area: number }[]
  }>()

  const openFarmPicker = (label: string, resolvePath: (b_id_farm: string) => string) => {
    setPendingFeature({ kind: "navigate", label, resolvePath })
  }

  const openFieldFarmPicker = (label: string) => {
    setPendingFeature({ kind: "pick-field", label })
  }

  const handleFarmPicked = (b_id_farm: string) => {
    if (pendingFeature?.kind === "navigate") {
      void navigate(pendingFeature.resolvePath(b_id_farm))
    } else if (pendingFeature?.kind === "pick-field") {
      setFieldPickerFarmId(b_id_farm)
      fieldOptionsFetcher.load(`/farm/${b_id_farm}/${selectedCalendar}/field-options`)
    }
    setPendingFeature(null)
  }

  const handleFieldPickedForNewFarm = (b_id: string) => {
    if (fieldPickerFarmId) {
      void navigate(`/farm/${fieldPickerFarmId}/${selectedCalendar}/field/${b_id}`)
    }
    setFieldPickerFarmId(null)
  }

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
    if (location.pathname.includes("/delete")) return "delete"
    if (location.pathname.includes("/settings")) return "settings"
    return ""
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

    void navigate(
      segment
        ? `/farm/${farmId}/${selectedCalendar}/field/${b_id}/${segment}`
        : `/farm/${farmId}/${selectedCalendar}/field/${b_id}`,
    )
  }

  // LRU order: iterate recentFieldIds so most-recent-first is preserved
  const recentFields = recentFieldIds
    .map((id) => fields.find((f) => f.b_id === id))
    .filter((f): f is NonNullable<typeof f> => f !== undefined)
  const regularFields = fields.filter((f) => !recentFieldIds.includes(f.b_id))

  const navigationItems = activeFieldId
    ? getFieldNavigationItems(farmId!, selectedCalendar!, activeFieldId, fieldWritePermission)
    : getFieldNavigationItems(farmId ?? "", selectedCalendar ?? "", "", false)

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
                      className="text-muted-foreground"
                      onClick={() =>
                        openFarmPicker("de kalender", (b_id_farm) => `/farm/${b_id_farm}`)
                      }
                    >
                      <Calendar />
                      <span>Kalender</span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Selecteer een bedrijf om de kalender te gebruiken
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            )}
            {isFarmSelected ? (
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
            ) : (
              <SidebarMenuItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      className="text-muted-foreground"
                      onClick={() =>
                        openFarmPicker(
                          "uw percelen",
                          (b_id_farm) => `/farm/${b_id_farm}/${selectedCalendar}/field`,
                        )
                      }
                    >
                      <Grid2x2 />
                      <span>Percelen</span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Selecteer een bedrijf om uw percelen te bekijken
                  </TooltipContent>
                </Tooltip>
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
                      className="text-muted-foreground"
                      onClick={() =>
                        openFarmPicker(
                          "het bouwplan",
                          (b_id_farm) => `/farm/${b_id_farm}/${selectedCalendar}/rotation`,
                        )
                      }
                    >
                      <Sprout />
                      <span>Bouwplan</span>
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
                      className="text-muted-foreground"
                      onClick={() =>
                        openFarmPicker(
                          "de maatregelen",
                          (b_id_farm) => `/farm/${b_id_farm}/${selectedCalendar}/measures`,
                        )
                      }
                    >
                      <ClipboardList />
                      <span>Maatregelen</span>
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
                      className="text-muted-foreground"
                      onClick={() =>
                        openFarmPicker("meststoffen", (b_id_farm) => `/farm/${b_id_farm}/fertilizers`)
                      }
                    >
                      <Shapes />
                      <span>Meststoffen</span>
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
                  <div className="flex w-full items-center">
                    <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                      <PopoverTrigger asChild>
                        <SidebarMenuButton
                          tooltip={"Perceel"}
                          className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
                        >
                          <LandPlot className="size-4 shrink-0" />
                          <span className="truncate font-medium">
                            {activeFieldName ?? "Kies een perceel"}
                          </span>
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
                            {regularFields.length > 0 && (
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
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        aria-label="Perceel sectie in- of uitklappen"
                        className="hover:bg-sidebar-accent/50 rounded-sm p-1 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                      >
                        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                      </button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {navigationItems.map((item) => (
                        <SidebarMenuSubItem key={item.segment}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={
                              item.segment === ""
                                ? location.pathname === item.to || location.pathname === `${item.to}/`
                                : location.pathname.startsWith(item.to)
                            }
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
                      className="text-muted-foreground"
                      onClick={() => openFieldFarmPicker("een perceel")}
                    >
                      <LandPlot />
                      <span>Kies een perceel</span>
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
      <FarmPickerDialog
        open={pendingFeature !== null}
        onOpenChange={(open) => {
          if (!open) setPendingFeature(null)
        }}
        farms={farms}
        featureLabel={pendingFeature?.label ?? ""}
        onSelectFarm={handleFarmPicked}
      />
      <FieldPickerDialog
        open={fieldPickerFarmId !== null}
        onOpenChange={(open) => {
          if (!open) setFieldPickerFarmId(null)
        }}
        farmName={
          farms.find((f) => f.b_id_farm === fieldPickerFarmId)?.b_name_farm ?? "dit bedrijf"
        }
        loading={fieldOptionsFetcher.state !== "idle"}
        fields={fieldOptionsFetcher.data?.fields ?? []}
        createFieldLink={
          fieldPickerFarmId ? `/farm/${fieldPickerFarmId}/${selectedCalendar}/field/new` : "#"
        }
        onSelectField={handleFieldPickedForNewFarm}
      />
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
