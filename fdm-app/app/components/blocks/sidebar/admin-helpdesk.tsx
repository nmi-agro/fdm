import { Asterisk, Inbox, MailX, MessageSquareDashed, Tag, Users } from "lucide-react"
import { NavLink, useLocation } from "react-router"
import { modifySearchParams } from "@/app/lib/url-utils"
import { useCurrentHelpdeskPage } from "~/components/blocks/helpdesk/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar"
import { NumberBadge } from "./number-badge"

export function SidebarAdminHelpdesk({
  numUnreadAssigned,
  numUnassigned,
  isAdmin,
}: {
  numUnreadAssigned: number
  numUnassigned: number
  isAdmin: boolean
}) {
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
    <SidebarGroup>
      <SidebarGroupLabel>Medewerker</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={currentHelpdeskPage === "inbox"}>
              <NavLink
                to={
                  isTicketViewerPage
                    ? modifySearchParams(urlWithNoFilters, (searchParams) => {
                        searchParams.set("inbox", "")
                      })
                    : "/support?inbox"
                }
              >
                <Inbox />
                <span>Mijn inbox</span>
                <NumberBadge number={numUnreadAssigned} />
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={currentHelpdeskPage === "unassigned_tickets"}>
              <NavLink
                to={
                  isTicketViewerPage
                    ? modifySearchParams(urlWithNoFilters, (searchParams) => {
                        searchParams.set("unassigned", "")
                      })
                    : "/support?unassigned"
                }
              >
                <Asterisk />
                <span>Niet toegewezen</span>
                <NumberBadge number={numUnassigned} />
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={currentHelpdeskPage === "all_tickets"}>
              <NavLink
                to={
                  isTicketViewerPage
                    ? modifySearchParams(urlWithNoFilters, (searchParams) => {
                        searchParams.set("all", "")
                      })
                    : "/support?all"
                }
              >
                <MessageSquareDashed />
                <span>Alle tickets</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={currentHelpdeskPage === "saved_replies"}
                        >
                            <NavLink to={"/support/settings/saved-replies"}>
                                <Bookmark />
                                <span>Opgeslagen reacties</span>
                            </NavLink>
                        </SidebarMenuButton>
                    </SidebarMenuItem> */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={currentHelpdeskPage === "agents"}>
              <NavLink to="/support/settings/agents">
                <Users />
                <span>Medewerkers</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={currentHelpdeskPage === "tags"}>
              <NavLink to="/support/settings/tags">
                <Tag />
                <span>Tags</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {isAdmin ? (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={currentHelpdeskPage === "blocked_emails"}>
                <NavLink to="/support/settings/blocked-emails">
                  <MailX />
                  <span>Geblokkeerde e-mailadressen</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : undefined}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
