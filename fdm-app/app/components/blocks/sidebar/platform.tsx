import { ArrowLeft, Cookie, KeyRound, Languages, Sparkles, User } from "lucide-react"
import { NavLink, useLocation } from "react-router"
import { clientConfig } from "@/app/lib/config"
import { Button } from "~/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar"
import { useCookieConsentStore } from "~/store/cookie-consent"

export function SidebarPlatform() {
  const location = useLocation()
  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="p-0"
                render={
                  <NavLink to="/farm">
                    <Button variant="default" className="w-full justify-start">
                      <ArrowLeft className="" />
                      <span>Terug naar bedrijven</span>
                    </Button>
                  </NavLink>
                }
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Account</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={location.pathname === "/user/settings/profile"}
                render={
                  <NavLink to="/user/settings/profile">
                    <User />
                    <span>Profiel</span>
                  </NavLink>
                }
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={location.pathname === "/user/settings/api-keys"}
                render={
                  <NavLink to="/user/settings/api-keys">
                    <KeyRound />
                    <span>API-sleutels</span>
                  </NavLink>
                }
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <span className="hover:text-muted-foreground active:text-muted-foreground text-muted-foreground flex cursor-default items-center gap-2 hover:bg-transparent active:bg-transparent">
                    <Languages />
                    <span>Taal</span>
                  </span>
                }
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={openCookieSettings}>
                <Cookie />
                <span>Cookies</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Over {clientConfig.name}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={location.pathname.includes("/about/whats-new")}
                render={
                  <NavLink to={"/about/whats-new"}>
                    <Sparkles />
                    <span>Wat is er nieuw?</span>
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

const openCookieSettings = () => {
  useCookieConsentStore.getState().openCookieSettings()
}
