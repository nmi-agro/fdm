import {
    Bookmark,
    MessageSquareCheck,
    MessageSquareDashed,
    User,
} from "lucide-react"
import { NavLink, useLocation } from "react-router"
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "~/components/ui/sidebar"

export function SidebarAdminHelpdesk() {
    const location = useLocation()
    return (
        <SidebarGroup>
            <SidebarGroupLabel>Medewerker</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={location.pathname.startsWith(
                                "/support?inbox",
                            )}
                        >
                            <NavLink to={"/support?inbox"}>
                                <MessageSquareCheck />
                                <span>Mijn Inbox</span>
                            </NavLink>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={location.pathname.includes(
                                "/support?all",
                            )}
                        >
                            <NavLink to={"/support?all"}>
                                <MessageSquareDashed />
                                <span>Alle Tickets</span>
                            </NavLink>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={location.pathname.includes(
                                "/support/settings/saved-replies",
                            )}
                        >
                            <NavLink to={"/support/settings/saved-replies"}>
                                <Bookmark />
                                <span>Opgeslaande Antwoorden</span>
                            </NavLink>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={location.pathname.includes(
                                "/support/settings/agents",
                            )}
                        >
                            <NavLink to="/support/settings/agents">
                                <User />
                                <span>Collega</span>
                            </NavLink>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
