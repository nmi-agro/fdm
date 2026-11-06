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
import { NumberBadge } from "./number-badge"

export function SidebarHelpdesk({ numUnreadRequested }: { numUnreadRequested: number }) {
  const currentHelpdeskPage = useCurrentHelpdeskPage()
  const location = useLocation()
  const ticketViewerPages = {
    all_tickets: "all",
    inbox: "inbox",
    unassigned_tickets: "unassigned",
  } as const
  const isTicketViewerPage = currentHelpdeskPage && currentHelpdeskPage in ticketViewerPages
  const urlWithNoFilters = isTicketViewerPage
    ? modifySearchParams(`${location.pathname}${location.search}`, (searchParams) =>
        searchParams.delete(
          ticketViewerPages[currentHelpdeskPage as keyof typeof ticketViewerPages],
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
                variant="default"
                className="w-full justify-start"
                nativeButton={false}
                render={
                  <NavLink to="/farm">
                    <ArrowLeft className="" />
                    <span>Terug naar bedrijven</span>
                  </NavLink>
                }
              />
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
                isActive={currentHelpdeskPage === "new_ticket"}
                render={
                  <NavLink to={"/support/new"}>
                    <Plus />
                    <span>Nieuw ticket</span>
                  </NavLink>
                }
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentHelpdeskPage === "my_tickets"}
                render={
                  <NavLink to={isTicketViewerPage ? urlWithNoFilters : "/support"}>
                    <MessageSquareCheck />
                    <span>Mijn tickets</span>
                    <NumberBadge number={numUnreadRequested} />
                  </NavLink>
                }
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}
