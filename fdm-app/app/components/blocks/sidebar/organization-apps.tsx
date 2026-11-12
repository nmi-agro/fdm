import { ArrowRightLeft, Gauge, MapIcon, Minus, Plus } from "lucide-react"
import { NavLink, useLocation, useParams } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"

export function SidebarOrganizationApps() {
  const location = useLocation()
  const params = useParams()

  const storedCalendar = useCalendarStore((store) => store.calendar)
  const calendar = params.calendar ?? storedCalendar

  const nitrogenBalanceLink = params.slug
    ? `/organization/${params.slug}/${calendar}/balance/nitrogen`
    : undefined
  const omBalanceLink = params.slug
    ? `/organization/${params.slug}/${calendar}/balance/organic-matter`
    : undefined
  const indicatorsLink = params.slug
    ? `/organization/${params.slug}/${calendar}/indicators`
    : undefined
  const indicatorsAtlasLink = params.slug
    ? `/organization/${params.slug}/${calendar}/atlas/indicators`
    : undefined
  const activeAtlasTab = location.pathname.includes("/atlas") ? "indicators" : undefined

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Apps</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {indicatorsAtlasLink ? (
            <Collapsible defaultOpen={!!indicatorsAtlasLink} className="group/collapsible">
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton isActive={location.pathname.includes("/atlas")}>
                    <MapIcon />
                    <span>Atlas</span>
                    <Plus className="ml-auto group-data-open/collapsible:hidden" />
                    <Minus className="ml-auto hidden group-data-open/collapsible:block" />
                  </SidebarMenuButton>
                }
              />
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      isActive={activeAtlasTab === "indicators"}
                      render={
                        <NavLink to={indicatorsAtlasLink}>
                          <span>Indicatoren</span>
                        </NavLink>
                      }
                    />
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          ) : null}

          <Collapsible defaultOpen={!!nitrogenBalanceLink} className="group/collapsible">
            <SidebarMenuItem>
              {nitrogenBalanceLink ? (
                <CollapsibleTrigger
                  render={
                    <SidebarMenuButton>
                      <ArrowRightLeft />
                      <span>Balans</span>
                      <Plus className="ml-auto group-data-open/collapsible:hidden" />
                      <Minus className="ml-auto hidden group-data-open/collapsible:block" />
                    </SidebarMenuButton>
                  }
                />
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <SidebarMenuButton
                        isActive={false}
                        className="hover:text-muted-foreground active:text-muted-foreground cursor-not-allowed opacity-50 hover:bg-transparent active:bg-transparent"
                      >
                        <ArrowRightLeft className="text-muted-foreground" />
                        <span className="text-muted-foreground">Balans</span>
                      </SidebarMenuButton>
                    }
                  />
                  <TooltipContent side="right">
                    Selecteer een bedrijf om de balansen te raadplegen
                  </TooltipContent>
                </Tooltip>
              )}
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    {nitrogenBalanceLink ? (
                      <SidebarMenuSubButton
                        isActive={location.pathname.includes(nitrogenBalanceLink)}
                        render={
                          <NavLink to={nitrogenBalanceLink}>
                            <span>Stikstof</span>
                          </NavLink>
                        }
                      />
                    ) : null}
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    {omBalanceLink ? (
                      <SidebarMenuSubButton
                        isActive={location.pathname.includes(omBalanceLink)}
                        render={
                          <NavLink to={omBalanceLink}>
                            <span>Organische stof</span>
                          </NavLink>
                        }
                      />
                    ) : null}
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
          {indicatorsLink && (
            <SidebarMenuButton
              isActive={
                location.pathname.includes("/indicators") &&
                !location.pathname.includes("/atlas/indicators")
              }
              render={
                <NavLink to={indicatorsLink}>
                  <Gauge />
                  <span>Indicatoren</span>
                </NavLink>
              }
            />
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
