import { ArrowLeft, MessageSquareCheck, Plus } from "lucide-react"
import { NavLink } from "react-router"
import { useCurrentHelpdeskPage } from "~/components/blocks/helpdesk/navigation"
import { Button } from "~/components/ui/button"
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "~/components/ui/sidebar"

export function SidebarHelpdesk() {
    const currentHelpdeskPage = useCurrentHelpdeskPage()

    return (
        <>
            <SidebarGroup>
                <SidebarGroupContent>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <Button
                                asChild
                                variant="default"
                                className="w-full justify-start"
                            >
                                <NavLink to="/farm">
                                    <ArrowLeft className="" />
                                    <span>Terug naar bedrijven</span>
                                </NavLink>
                            </Button>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
                <SidebarGroupLabel>Ondersteuning</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                isActive={currentHelpdeskPage === "new_ticket"}
                            >
                                <NavLink to={"/support/new"}>
                                    <Plus />
                                    <span>Nieuw ticket</span>
                                </NavLink>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                isActive={currentHelpdeskPage === "my_tickets"}
                            >
                                <NavLink to={"/support"}>
                                    <MessageSquareCheck />
                                    <span>Mijn tickets</span>
                                </NavLink>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </>
    )
}
