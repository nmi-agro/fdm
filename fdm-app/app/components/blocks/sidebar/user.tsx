import {
    BadgeCheck,
    Building,
    ChevronsUpDown,
    Cookie,
    Languages,
    LogOut,
    Settings,
    Sparkles,
} from "lucide-react"
import posthog from "posthog-js"
import { Form, NavLink } from "react-router"
import { useIsMobile } from "@/app/hooks/use-mobile"
import { clientConfig } from "@/app/lib/config"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
    SidebarFooter,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "~/components/ui/sidebar"

export function SidebarUser({
    name,
    email,
    image,
    avatarInitials,
    userName,
}: {
    name: string
    email: string
    image?: string | null
    avatarInitials: string
    userName: string
}) {
    const isMobile = useIsMobile()

    return (
        <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <SidebarMenuButton
                                size="lg"
                                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                            >
                                <Avatar className="h-8 w-8 rounded-lg">
                                    <AvatarImage
                                        src={image ?? undefined}
                                        alt={name}
                                    />
                                    <AvatarFallback className="rounded-lg">
                                        {avatarInitials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">
                                        {userName}
                                    </span>
                                    <span className="truncate text-xs">
                                        {email}
                                    </span>
                                </div>
                                <ChevronsUpDown className="ml-auto size-4" />
                            </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                            side={isMobile ? "bottom" : "right"}
                            align="end"
                            sideOffset={4}
                        >
                            <DropdownMenuLabel className="p-0 font-normal">
                                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                    <Avatar className="h-8 w-8 rounded-lg">
                                        <AvatarImage
                                            src={image ?? undefined}
                                            alt={name}
                                        />
                                        <AvatarFallback className="rounded-lg">
                                            {avatarInitials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-semibold">
                                            {userName}
                                        </span>
                                        <span className="truncate text-xs">
                                            {email}
                                        </span>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuItem asChild>
                                    <NavLink to="/user">
                                        <BadgeCheck className="mr-2 h-4 w-4" />
                                        Account
                                    </NavLink>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={openCookieSettings}>
                                    <Cookie className="mr-2 h-4 w-4" />
                                    Cookies
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    asChild
                                    className="hover:bg-transparent hover:text-muted-foreground active:bg-transparent active:text-muted-foreground"
                                >
                                    <span className="flex items-center gap-2 cursor-default text-muted-foreground">
                                        <Languages className="mr-2 h-4 w-4" />
                                        <span>Taal</span>
                                    </span>
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <NavLink to="/organization">
                                    <Building className="mr-2 h-4 w-4" />
                                    Organisaties
                                </NavLink>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuItem
                                    asChild
                                    className="hover:bg-transparent hover:text-muted-foreground active:bg-transparent active:text-muted-foreground"
                                >
                                    <span className="flex items-center gap-2 cursor-default text-muted-foreground">
                                        <Settings className="mr-2 h-4 w-4" />
                                        <span>Instellingen</span>
                                    </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <NavLink to="/about/whats-new">
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Wat is er nieuw?
                                    </NavLink>
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Form method="post" action="/logout">
                                    <Button
                                        type="submit"
                                        variant="link"
                                        onClick={() => {
                                            if (
                                                clientConfig.analytics.posthog
                                            ) {
                                                posthog.reset()
                                            }
                                        }}
                                    >
                                        <LogOut />
                                        Uitloggen
                                    </Button>
                                </Form>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
    )
}

const openCookieSettings = () => {
    if (window?.openCookieSettings) {
        window.openCookieSettings()
    }
}
