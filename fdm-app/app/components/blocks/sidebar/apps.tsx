import {
    ArrowRightLeft,
    BookOpenText,
    Landmark,
    MapIcon,
    Minus,
    Plus,
} from "lucide-react"
import { NavLink, useLocation, useSearchParams } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import { useFarmStore } from "@/app/store/farm"
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

export function SidebarApps() {
    const farmId = useFarmStore((state) => state.farmId)
    const selectedCalendar = useCalendarStore((state) => state.calendar)

    // Check if the page or its return page contains `farm/create` in url
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const isCreateFarmWizard =
        location.pathname.includes("farm/create") ||
        searchParams.get("returnUrl")?.includes("farm/create")

    const isFarmOverview =
        location.pathname === "/farm" || location.pathname === "/farm/"

    let atlasLink: string | undefined
    let atlasFieldsLink: string | undefined
    let atlasElevationLink: string | undefined
    let atlasSoilLink: string | undefined
    if (isCreateFarmWizard) {
        atlasLink = undefined
        atlasFieldsLink = undefined
        atlasElevationLink = undefined
        atlasSoilLink = undefined
    } else if (farmId) {
        atlasLink = `/farm/${farmId}/${selectedCalendar}/atlas`
        atlasFieldsLink = `/farm/${farmId}/${selectedCalendar}/atlas/fields`
        atlasElevationLink = `/farm/${farmId}/${selectedCalendar}/atlas/elevation`
        atlasSoilLink = `/farm/${farmId}/${selectedCalendar}/atlas/soil`
    } else {
        atlasLink = `/farm/undefined/${selectedCalendar}/atlas`
        atlasFieldsLink = `/farm/undefined/${selectedCalendar}/atlas/fields`
        atlasElevationLink = `/farm/undefined/${selectedCalendar}/atlas/elevation`
        atlasSoilLink = `/farm/undefined/${selectedCalendar}/atlas/soil`
    }

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
    return (
        <TooltipProvider>
            <SidebarGroup>
                <SidebarGroupLabel>Apps</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        <Collapsible
                            defaultOpen={location.pathname.includes("/atlas")}
                            className="group/collapsible"
                        >
                            <SidebarMenuItem>
                                {atlasLink ? (
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton
                                            isActive={location.pathname.includes(
                                                "/atlas",
                                            )}
                                        >
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
                                                className="hover:bg-transparent hover:text-muted-foreground active:bg-transparent active:text-muted-foreground opacity-50 cursor-not-allowed"
                                            >
                                                <MapIcon className="text-muted-foreground" />
                                                <span className="text-muted-foreground">
                                                    Atlas
                                                </span>
                                            </SidebarMenuButton>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                            Atlas is niet beschikbaar tijdens
                                            het aanmaken van een bedrijf
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        <SidebarMenuSubItem>
                                            {atlasFieldsLink ? (
                                                <SidebarMenuSubButton
                                                    asChild
                                                    isActive={location.pathname.includes(
                                                        atlasFieldsLink,
                                                    )}
                                                >
                                                    <NavLink
                                                        to={atlasFieldsLink}
                                                    >
                                                        <span>
                                                            Gewaspercelen
                                                        </span>
                                                    </NavLink>
                                                </SidebarMenuSubButton>
                                            ) : null}
                                        </SidebarMenuSubItem>
                                        <SidebarMenuSubItem>
                                            {atlasElevationLink ? (
                                                <SidebarMenuSubButton
                                                    asChild
                                                    isActive={location.pathname.includes(
                                                        atlasElevationLink,
                                                    )}
                                                >
                                                    <NavLink
                                                        to={atlasElevationLink}
                                                    >
                                                        <span>Hoogtekaart</span>
                                                    </NavLink>
                                                </SidebarMenuSubButton>
                                            ) : null}
                                        </SidebarMenuSubItem>
                                        <SidebarMenuSubItem>
                                            {atlasSoilLink ? (
                                                <SidebarMenuSubButton
                                                    asChild
                                                    isActive={location.pathname.includes(
                                                        atlasSoilLink,
                                                    )}
                                                >
                                                    <NavLink to={atlasSoilLink}>
                                                        <span>Bodemkaart</span>
                                                    </NavLink>
                                                </SidebarMenuSubButton>
                                            ) : null}
                                        </SidebarMenuSubItem>
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                        <Collapsible
                            defaultOpen={!!nitrogenBalanceLink}
                            className="group/collapsible"
                        >
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
                                ) : (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <SidebarMenuButton
                                                isActive={false}
                                                className="hover:bg-transparent hover:text-muted-foreground active:bg-transparent active:text-muted-foreground opacity-50 cursor-not-allowed"
                                            >
                                                <ArrowRightLeft className="text-muted-foreground" />
                                                <span className="text-muted-foreground">
                                                    Balans
                                                </span>
                                            </SidebarMenuButton>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                            Selecteer een bedrijf om de balansen
                                            te raadplegen
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        <SidebarMenuSubItem>
                                            {nitrogenBalanceLink ? (
                                                <SidebarMenuSubButton
                                                    asChild
                                                    isActive={location.pathname.includes(
                                                        nitrogenBalanceLink,
                                                    )}
                                                >
                                                    <NavLink
                                                        to={nitrogenBalanceLink}
                                                    >
                                                        <span>Stikstof</span>
                                                    </NavLink>
                                                </SidebarMenuSubButton>
                                            ) : null}
                                        </SidebarMenuSubItem>
                                        <SidebarMenuSubItem>
                                            {omBalanceLink ? (
                                                <SidebarMenuSubButton
                                                    asChild
                                                    isActive={location.pathname.includes(
                                                        omBalanceLink,
                                                    )}
                                                >
                                                    <NavLink to={omBalanceLink}>
                                                        <span>
                                                            Organische stof
                                                        </span>
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
                                    isActive={location.pathname.includes(
                                        nutrientAdviceLink,
                                    )}
                                >
                                    <NavLink to={nutrientAdviceLink}>
                                        <BookOpenText />
                                        <span>Bemestingsadvies</span>
                                    </NavLink>
                                </SidebarMenuButton>
                            ) : (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <SidebarMenuButton
                                            isActive={false}
                                            className="hover:bg-transparent hover:text-muted-foreground active:bg-transparent active:text-muted-foreground opacity-50 cursor-not-allowed"
                                        >
                                            <BookOpenText className="text-muted-foreground" />
                                            <span className="text-muted-foreground">
                                                Bemestingsadvies
                                            </span>
                                        </SidebarMenuButton>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        Selecteer een bedrijf voor
                                        bemestingsadvies
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            {normsLink ? (
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname.includes(
                                        normsLink,
                                    )}
                                >
                                    <NavLink to={normsLink}>
                                        <Landmark />
                                        <span>Gebruiksruimte</span>
                                    </NavLink>
                                </SidebarMenuButton>
                            ) : (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <SidebarMenuButton
                                            isActive={false}
                                            className="hover:bg-transparent hover:text-muted-foreground active:bg-transparent active:text-muted-foreground opacity-50 cursor-not-allowed"
                                        >
                                            <Landmark className="text-muted-foreground" />
                                            <span className="text-muted-foreground">
                                                Gebruiksruimte
                                            </span>
                                        </SidebarMenuButton>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        Selecteer een bedrijf om de
                                        gebruiksruimte te berekenen
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
