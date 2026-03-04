import { ArrowLeft, Cookie, Languages, Sparkles, User } from "lucide-react"
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

export function SidebarPlatform() {
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
                <SidebarGroupLabel>Account</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                isActive={location.pathname.includes("/user")}
                            >
                                <NavLink to={"/user"}>
                                    <User />
                                    <span>Profiel</span>
                                </NavLink>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                className="hover:bg-transparent hover:text-muted-foreground active:bg-transparent active:text-muted-foreground"
                            >
                                <span className="flex items-center gap-2 cursor-default text-muted-foreground">
                                    <Languages />
                                    <span>Taal</span>
                                </span>
                            </SidebarMenuButton>
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
                                asChild
                                isActive={location.pathname.includes(
                                    "/about/whats-new",
                                )}
                            >
                                <NavLink to={"/about/whats-new"}>
                                    <Sparkles />
                                    <span>Wat is er nieuw?</span>
                                </NavLink>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </>
    )
}

const openCookieSettings = () => {
    if (window?.openCookieSettings) {
        window.openCookieSettings()
    }
}
