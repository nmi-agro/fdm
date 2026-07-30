import { NavLink } from "react-router"
import { clientConfig } from "@/app/lib/config"
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar"

export function SidebarTitle() {
  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" asChild>
            <NavLink to="/">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#122023]">
                <img
                  className="size-6"
                  src="/fdm-high-resolution-logo-transparent-no-text.png"
                  alt={clientConfig.name}
                />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">{clientConfig.name}</span>
              </div>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}
