import {
    ArrowRightLeft,
    ClipboardList,
    Gauge,
    MapIcon,
    Minus,
    Plus,
} from "lucide-react"
import { NavLink, useLocation, useParams } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
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
    TooltipTrigger,
} from "~/components/ui/tooltip"

export function SidebarOrganizationApps() {
    const location = useLocation()
    const params = useParams()

    const storedCalendar = useCalendarStore((store) => store.calendar)
    const calendar = params.calendar ?? storedCalendar

    const nitrogenBalanceLink = params.slug
        ? `/organization/${params.slug}/${calendar}/balance/nitrogen`
        : undefined
    const omBalanceLink = params.slug
        ? `/organization/${params.slug}/${calendar}/balance/organic-matter`
        : undefined
    const indicatorsLink = params.slug
        ? `/organization/${params.slug}/${calendar}/indicators`
        : undefined
    const indicatorsAtlasLink = params.slug
        ? `/organization/${params.slug}/${calendar}/atlas/indicators`
        : undefined
    const measuresLink = params.slug
        ? `/organization/${params.slug}/${calendar}/measures`
        : undefined
    const activeAtlasTab = location.pathname.includes("/atlas")
        ? "indicators"
        : undefined

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Apps</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {indicatorsAtlasLink ? (
                        <Collapsible
                            defaultOpen={!!indicatorsAtlasLink}
                            className="group/collapsible"
                        >
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
                            <CollapsibleContent>
                                <SidebarMenuSub>
                                    <SidebarMenuSubItem>
                                        <SidebarMenuSubButton
                                            asChild
                                            isActive={
                                                activeAtlasTab === "indicators"
                                            }
                                        >
                                            <NavLink to={indicatorsAtlasLink}>
                                                <span>Indicatoren</span>
                                            </NavLink>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                </SidebarMenuSub>
                            </CollapsibleContent>
                        </Collapsible>
                    ) : null}

                    {measuresLink && (
                        <SidebarMenuButton
                            asChild
                            isActive={location.pathname.includes("/measures")}
                        >
                            <NavLink to={measuresLink}>
                                <ClipboardList />
                                <span>Maatregelen</span>
                            </NavLink>
                        </SidebarMenuButton>
                    )}
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
                                        Selecteer een bedrijf om de balansen te
                                        raadplegen
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
                                                    <span>Organische stof</span>
                                                </NavLink>
                                            </SidebarMenuSubButton>
                                        ) : null}
                                    </SidebarMenuSubItem>
                                </SidebarMenuSub>
                            </CollapsibleContent>
                        </SidebarMenuItem>
                    </Collapsible>
                    {indicatorsLink && (
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
                    )}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
