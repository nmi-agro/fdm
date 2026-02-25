import type { Organization } from "better-auth/plugins"
import {
    Building,
    Calendar,
    Check,
    ChevronRight,
    Cog,
    House,
    Users,
} from "lucide-react"
import { useState } from "react"
import { NavLink, useLocation } from "react-router"
import { getCalendarSelection } from "@/app/lib/calendar"
import { useCalendarStore } from "@/app/store/calendar"
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

export function SidebarOrganization({
    organization,
    roles,
}: {
    organization?: Organization
    roles?: ("owner" | "admin" | "member" | "viewer")[]
}) {
    function getSuperiorRole(
        allRoles: ("owner" | "admin" | "member" | "viewer")[],
    ) {
        if (allRoles.length > 0) {
            const ordering = ["owner", "admin", "member", "viewer"] as const
            const sorted = [...allRoles].sort(
                (a, b) => ordering.indexOf(a) - ordering.indexOf(b),
            )
            return sorted[0]
        }
        return null
    }

    const location = useLocation()

    const selectedCalendar = useCalendarStore((state) => state.calendar)
    const setCalendar = useCalendarStore((state) => state.setCalendar)
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const calendarSelection = getCalendarSelection()

    const organizationRole = roles?.length ? getSuperiorRole(roles) : null
    // Set the farm link
    let organizationLink: string
    let organizationLinkDisplay: string
    if (organization?.slug) {
        organizationLink = `/organization/${organization.slug}`
        organizationLinkDisplay = organization?.name
            ? organization.name
            : "Organisatie"
    } else {
        organizationLink = "/organization"
        organizationLinkDisplay = "Organisatie Dashboard"
    }

    // Determine the active (highlighted) tab
    let activeTab: string | undefined
    if (organization) {
        const prefix = `/organization/${organization.slug}/`
        if (location.pathname.startsWith(prefix)) {
            const subPath = location.pathname.substring(prefix.length)
            if (subPath.includes("settings")) activeTab = "settings"
            if (subPath.includes("members")) activeTab = "members"
            if (subPath.includes("farms")) activeTab = "farms"
        }
    }

    function getLinkForYear(pathname: string, item: string) {
        // Construct the new URL with the selected calendar
        if (!organization) return pathname
        const prefix = `/organization/${organization.slug}/`
        if (pathname.length <= prefix.length) {
            return pathname
        }
        const suffixStart = pathname.indexOf("/", prefix.length)
        if (suffixStart === -1) {
            return pathname
        }
        const toReplace = pathname.substring(prefix.length, suffixStart)
        if (!/(\d{4}|all)/.test(toReplace)) {
            return pathname
        }
        return `${prefix}${item}${pathname.substring(suffixStart)}`
    }

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Organisatie</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                isActive={location.pathname === "/organization"}
                            >
                                <NavLink to={"/organization"}>
                                    <Users />
                                    <span>Mijn organisaties</span>
                                </NavLink>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        {organization && (
                            <SidebarMenuButton
                                asChild
                                isActive={
                                    location.pathname === organizationLink
                                }
                            >
                                <NavLink to={organizationLink}>
                                    <Building />
                                    <span className="truncate">
                                        {organizationLinkDisplay}
                                    </span>
                                    {organizationRole && (
                                        <Badge
                                            key={organizationRole}
                                            variant="outline"
                                            className="ml-auto"
                                        >
                                            {
                                                {
                                                    owner: "Eigenaar",
                                                    admin: "Admin",
                                                    member: "Lid",
                                                    viewer: "Kijker",
                                                }[organizationRole]
                                            }
                                        </Badge>
                                    )}
                                </NavLink>
                            </SidebarMenuButton>
                        )}
                    </SidebarMenuItem>
                    {organization ? (
                        <Collapsible
                            asChild
                            defaultOpen={false}
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
                                        {calendarSelection?.map((item) => (
                                            <SidebarMenuSubItem
                                                key={item}
                                                className={
                                                    selectedCalendar === item
                                                        ? "bg-accent text-accent-foreground"
                                                        : ""
                                                }
                                            >
                                                <SidebarMenuSubButton
                                                    asChild
                                                    onClick={() =>
                                                        setCalendar(item)
                                                    }
                                                >
                                                    <NavLink
                                                        to={getLinkForYear(
                                                            location.pathname,
                                                            item,
                                                        )}
                                                        className="flex items-center"
                                                    >
                                                        <span>
                                                            {item === "all"
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
                                        ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    ) : (
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                className="hover:bg-transparent hover:text-muted-foreground active:bg-transparent active:text-muted-foreground"
                            >
                                <span className="flex items-center gap-2 cursor-default text-muted-foreground">
                                    <Calendar />
                                    <span>Kalender</span>
                                </span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    )}
                    <SidebarMenuItem>
                        {organization ? (
                            <SidebarMenuButton
                                asChild
                                isActive={activeTab === "settings"}
                            >
                                <NavLink
                                    to={`/organization/${organization.slug}/settings`}
                                >
                                    <Cog />
                                    <span>Instellingen</span>
                                </NavLink>
                            </SidebarMenuButton>
                        ) : (
                            <SidebarMenuButton
                                asChild
                                className="hover:bg-transparent hover:text-muted-foreground active:bg-transparent active:text-muted-foreground"
                            >
                                <span className="flex items-center gap-2 cursor-default text-muted-foreground">
                                    <Cog />
                                    <span>Instellingen</span>
                                </span>
                            </SidebarMenuButton>
                        )}
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        {organization ? (
                            <SidebarMenuButton
                                asChild
                                isActive={activeTab === "members"}
                            >
                                <NavLink
                                    to={`/organization/${organization.slug}/members`}
                                >
                                    <Users />
                                    <span>Leden</span>
                                </NavLink>
                            </SidebarMenuButton>
                        ) : (
                            <SidebarMenuButton
                                asChild
                                className="hover:bg-transparent hover:text-muted-foreground active:bg-transparent active:text-muted-foreground"
                            >
                                <span className="flex items-center gap-2 cursor-default text-muted-foreground">
                                    <Users />
                                    <span>Leden</span>
                                </span>
                            </SidebarMenuButton>
                        )}
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        {organization ? (
                            <SidebarMenuButton
                                asChild
                                isActive={activeTab === "farms"}
                            >
                                <NavLink
                                    to={`/organization/${organization.slug}/${selectedCalendar}/farms`}
                                >
                                    <House />
                                    <span>Bedrijven</span>
                                </NavLink>
                            </SidebarMenuButton>
                        ) : (
                            <SidebarMenuButton
                                asChild
                                className="hover:bg-transparent hover:text-muted-foreground active:bg-transparent active:text-muted-foreground"
                            >
                                <span className="flex items-center gap-2 cursor-default text-muted-foreground">
                                    <House />
                                    <span>Bedrijven</span>
                                </span>
                            </SidebarMenuButton>
                        )}
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
