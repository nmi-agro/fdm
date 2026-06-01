import {
    Bookmark,
    MessageSquareCheck,
    MessageSquareDashed,
    User,
} from "lucide-react"
import { NavLink } from "react-router"
import { useCurrentHelpdeskPage } from "~/components/blocks/helpdesk/navigation"
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "~/components/ui/sidebar"

export function SidebarAdminHelpdesk() {
    const currentHelpdeskPage = useCurrentHelpdeskPage()

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Medewerker</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={currentHelpdeskPage === "inbox"}
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
                            isActive={currentHelpdeskPage === "all_tickets"}
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
                            isActive={currentHelpdeskPage === "saved_replies"}
                        >
                            <NavLink to={"/support/settings/saved-replies"}>
                                <Bookmark />
                                <span>Opgeslagen Reacties</span>
                            </NavLink>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={currentHelpdeskPage === "agents"}
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
