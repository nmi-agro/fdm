import {
  Asterisk,
  MailX,
  IdCardLanyard,
  Inbox,
  MessageSquareDashed,
  CalendarOff,
  Tag,
  Users,
} from "lucide-react"
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
  isAdmin,
  numUnreadAssigned,
  numUnassigned,
}: {
  isAdmin: boolean
  numUnreadAssigned: number
  numUnassigned: number
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
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Medewerker</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentHelpdeskPage === "inbox"}
                render={
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
                }
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentHelpdeskPage === "unassigned_tickets"}
                render={
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
                }
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentHelpdeskPage === "all_tickets"}
                render={
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
                }
              />
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
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentHelpdeskPage === "profile"}
                render={
                  <NavLink to="/support/settings/profile">
                    <IdCardLanyard />
                    <span>Mijn profiel</span>
                  </NavLink>
                }
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentHelpdeskPage === "agents"}
                render={
                  <NavLink to="/support/settings/agents">
                    <Users />
                    <span>Medewerkers</span>
                  </NavLink>
                }
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentHelpdeskPage === "absences"}
                render={
                  <NavLink to="/support/settings/absences">
                    <CalendarOff />
                    <span>Afwezigheid</span>
                  </NavLink>
                }
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentHelpdeskPage === "tags"}
                render={
                  <NavLink to="/support/settings/tags">
                    <Tag />
                    <span>Tags</span>
                  </NavLink>
                }
              />
            </SidebarMenuItem>
            {isAdmin ? (
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={currentHelpdeskPage === "blocked_emails"}
                  render={
                    <NavLink to="/support/settings/blocked-emails">
                      <MailX />
                      <span>Geblokkeerde e-mailadressen</span>
                    </NavLink>
                  }
                />
              </SidebarMenuItem>
            ) : undefined}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}
