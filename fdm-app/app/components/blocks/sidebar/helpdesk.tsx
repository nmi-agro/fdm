import { ArrowLeft, MessageSquareCheck, Plus } from "lucide-react"
import { NavLink, useLocation } from "react-router"
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
    const location = useLocation()
    return (
        <>
            <SidebarGroup>
                <SidebarGroupContent>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild className="p-0">
                                <NavLink to="/farm">
                                    <Button
                                        variant="default"
                                        className="w-full justify-start"
                                    >
                                        <ArrowLeft className="" />
                                        <span>Terug naar bedrijven</span>
                                    </Button>
                                </NavLink>
                            </SidebarMenuButton>
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
                                isActive={location.pathname.includes(
                                    "/support/new",
                                )}
                            >
                                <NavLink to={"/support/new"}>
                                    <Plus />
                                    <span>Nieuw Ticket</span>
                                </NavLink>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                isActive={/^\/support\/?$/.test(
                                    location.pathname,
                                )}
                            >
                                <NavLink to={"/support"}>
                                    <MessageSquareCheck />
                                    <span>Mijn Tickets</span>
                                </NavLink>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </>
    )
}
