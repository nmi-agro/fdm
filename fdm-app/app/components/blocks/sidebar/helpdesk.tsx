import { ArrowLeft, MessageSquareCheck, Plus } from "lucide-react"
import { NavLink, useLocation } from "react-router"
import { modifySearchParams } from "@/app/lib/url-utils"
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
    const location = useLocation()
    const ticketViewerPages = {
        all_tickets: "all",
        inbox: "inbox",
        unassigned_tickets: "unassigned",
    } as const
    const isTicketViewerPage =
        currentHelpdeskPage && currentHelpdeskPage in ticketViewerPages
    const urlWithNoFilters = isTicketViewerPage
        ? modifySearchParams(
              `${location.pathname}${location.search}`,
              (searchParams) =>
                  searchParams.delete(
                      ticketViewerPages[
                          currentHelpdeskPage as keyof typeof ticketViewerPages
                      ],
                  ),
          )
        : `${location.pathname}${location.search}`

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
                                <NavLink
                                    to={
                                        isTicketViewerPage
                                            ? urlWithNoFilters
                                            : "/support"
                                    }
                                >
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
