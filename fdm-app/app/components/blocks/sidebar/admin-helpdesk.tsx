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
                            isActive={/^\/admin\/support\/?$/.test(
                                location.pathname,
                            )}
                        >
                            <NavLink to={"/admin/support"}>
                                <MessageSquareCheck />
                                <span>Mijn Inbox</span>
                            </NavLink>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={location.pathname.includes(
                                "/admin/support/tickets",
                            )}
                        >
                            <NavLink to={"/admin/support/tickets"}>
                                <MessageSquareDashed />
                                <span>Alle Tickets</span>
                            </NavLink>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={location.pathname.includes(
                                "/admin/supports/settings/agents",
                            )}
                        >
                            <NavLink to={"/admin/support/saved_replies"}>
                                <Bookmark />
                                <span>Opgeslaande Antwoorden</span>
                            </NavLink>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={location.pathname.includes(
                                "/admin/supports/settings/agents",
                            )}
                        >
                            <NavLink to={"/admin"}>
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
