import type { getFarm } from "@nmi-agro/fdm-core"
import {
    Calendar,
    Check,
    ChevronRight,
    House,
    LayoutGrid,
    Shapes,
    Sprout,
    Square,
} from "lucide-react"
import { useState } from "react"
import { NavLink, useLocation, useSearchParams } from "react-router"
import { getCalendarSelection } from "@/app/lib/calendar"
import { useCalendarStore } from "@/app/store/calendar"
import { useFarmStore } from "@/app/store/farm"
import { Badge } from "~/components/ui/badge"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "~/components/ui/collapsible"
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"

export function SidebarFarm({
    farm,
}: {
    farm: Awaited<ReturnType<typeof getFarm>> | undefined
}) {
    function getSuperiorRole(
        allRoles: { role: "owner" | "advisor" | "researcher" }[],
    ) {
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
    const [searchParams] = useSearchParams()
    // Check if the page or its return page contains `farm/create` in url
    const isCreateFarmWizard =
        location.pathname.includes("farm/create") ||
        searchParams.get("returnUrl")?.includes("farm/create")
    const farmRole = farm ? getSuperiorRole(farm.roles) : null

    const isFarmOverview =
        location.pathname === "/farm" || location.pathname === "/farm/"

    const isFarmSelected =
        farmId && farmId !== "undefined" && !isCreateFarmWizard

    let fieldsLink: string | undefined
    if (isCreateFarmWizard) {
        fieldsLink = undefined
    } else if (farmId && farmId !== "undefined") {
        fieldsLink = `/farm/${farmId}/${selectedCalendar}/field`
    } else {
        fieldsLink = undefined
    }

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
                                    <span>
                                        {isCreateFarmWizard
                                            ? "Terug naar bedrijven"
                                            : "Mijn bedrijven"}
                                    </span>
                                </NavLink>
                            </SidebarMenuButton>
                        </SidebarMenuItem>

                        {isFarmSelected && (
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={
                                        location.pathname ===
                                            `/farm/${farmId}` ||
                                        location.pathname.includes(
                                            `/farm/${farmId}/settings`,
                                        )
                                    }
                                    tooltip={
                                        farm?.b_name_farm ?? "Bedrijfsoverzicht"
                                    }
                                >
                                    <NavLink to={`/farm/${farmId}`}>
                                        <House />
                                        <span className="truncate font-medium">
                                            {farm?.b_name_farm ?? "Overzicht"}
                                        </span>
                                        {farmRole && (
                                            <Badge
                                                key={farmRole}
                                                variant="outline"
                                                className="ml-auto text-[10px]"
                                            >
                                                {farmRole === "owner"
                                                    ? "Eigenaar"
                                                    : farmRole === "advisor"
                                                      ? "Adviseur"
                                                      : farmRole ===
                                                          "researcher"
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
                                        <SidebarMenuButton
                                            tooltip={"Kalender"}
                                            className="flex items-center"
                                        >
                                            <Calendar />
                                            <span>Kalender </span>
                                            {!isCalendarOpen && (
                                                <Badge className="ml-1">
                                                    {selectedCalendar === "all"
                                                        ? "Alle jaren"
                                                        : selectedCalendar}
                                                </Badge>
                                            )}
                                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            {calendarSelection?.map((item) => {
                                                // Construct the new URL with the selected calendar
                                                const newUrl =
                                                    location.pathname.replace(
                                                        /\/(\d{4}|all)/,
                                                        `/${item}`,
                                                    )
                                                return (
                                                    <SidebarMenuSubItem
                                                        key={item}
                                                        className={
                                                            selectedCalendar ===
                                                            item
                                                                ? "bg-accent text-accent-foreground"
                                                                : ""
                                                        }
                                                    >
                                                        <SidebarMenuSubButton
                                                            asChild
                                                            onClick={() =>
                                                                setCalendar(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            <NavLink
                                                                to={newUrl}
                                                                className="flex items-center"
                                                            >
                                                                <span>
                                                                    {item ===
                                                                    "all"
                                                                        ? "Alle jaren"
                                                                        : item}
                                                                </span>
                                                                {selectedCalendar ===
                                                                    item && (
                                                                    <Check className="ml-auto h-4 w-4" />
                                                                )}
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
                                            className="opacity-50 cursor-not-allowed hover:bg-transparent"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Calendar />
                                                <span>Kalender</span>
                                            </span>
                                        </SidebarMenuButton>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        Selecteer een bedrijf om de kalender te
                                        gebruiken
                                    </TooltipContent>
                                </Tooltip>
                            </SidebarMenuItem>
                        )}
                        <SidebarMenuItem>
                            {fieldsLink ? (
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname.includes(
                                        fieldsLink,
                                    )}
                                >
                                    <NavLink to={fieldsLink}>
                                        <Square />
                                        <span>Percelen</span>
                                    </NavLink>
                                </SidebarMenuButton>
                            ) : (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <SidebarMenuButton
                                            asChild
                                            className="opacity-50 cursor-not-allowed hover:bg-transparent"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Square />
                                                <span>Percelen</span>
                                            </span>
                                        </SidebarMenuButton>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        Selecteer een bedrijf om uw percelen te
                                        beheren
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            {rotationLink ? (
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname.includes(
                                        rotationLink,
                                    )}
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
                                            className="opacity-50 cursor-not-allowed hover:bg-transparent"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Sprout />
                                                <span>Bouwplan</span>
                                            </span>
                                        </SidebarMenuButton>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        Selecteer een bedrijf om het bouwplan te
                                        beheren
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            {fertilizersLink ? (
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname.includes(
                                        fertilizersLink,
                                    )}
                                >
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
                                            className="opacity-50 cursor-not-allowed hover:bg-transparent"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Shapes />
                                                <span>Meststoffen</span>
                                            </span>
                                        </SidebarMenuButton>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        Selecteer een bedrijf om meststoffen te
                                        beheren
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </TooltipProvider>
    )
}
