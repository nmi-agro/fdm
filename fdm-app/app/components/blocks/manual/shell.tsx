import type { ReactNode } from "react"
import { Link, NavLink, useLocation } from "react-router"
import type { ManualNavSection } from "~/lib/manual/parse"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "~/components/ui/sidebar"
import { clientConfig } from "~/lib/config"

function NavGroup({ title, items }: { title: string; items: { href: string; title: string }[] }) {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                className="h-auto min-h-8 py-1.5 [&>span:last-child]:whitespace-normal"
              >
                <NavLink to={item.href} end onClick={() => setOpenMobile(false)}>
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/** The manual navigation: chapters grouped by section, then the background pages. */
function ManualSidebar({ sections }: { sections: ManualNavSection[] }) {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/manual">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#122023]">
                  <img className="size-6" src={clientConfig.logomark} alt="" />
                </span>
                <span className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">{clientConfig.name}</span>
                  <span className="text-muted-foreground text-xs">Handleiding</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="[scrollbar-width:thin] overflow-x-hidden">
        <NavGroup title="Handleiding" items={[{ href: "/manual", title: "Overzicht" }]} />
        {sections
          .filter((section) => section.kind === "chapter")
          .map((section) => (
            <NavGroup key={section.title} title={section.title} items={section.items} />
          ))}
        <SidebarSeparator />
        <NavGroup
          title="Achtergrond"
          items={[{ href: "/manual/background", title: "Hoe wordt het berekend?" }]}
        />
        {sections
          .filter((section) => section.kind === "background")
          .map((section) => (
            <NavGroup key={section.title} title={section.title} items={section.items} />
          ))}
      </SidebarContent>
    </Sidebar>
  )
}

/**
 * The frame of every manual page, built on the app's own sidebar: section navigation on the left
 * (a sheet on phones), a top bar with a way into the app, and the page content.
 */
export function ManualShell({
  sections,
  children,
}: {
  sections: ManualNavSection[]
  children: ReactNode
}) {
  return (
    <SidebarProvider>
      <a
        href="#inhoud"
        className="bg-background sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Naar de inhoud
      </a>
      <ManualSidebar sections={sections} />
      <SidebarInset className="selection:bg-primary selection:text-primary-foreground min-w-0">
        <header className="bg-background/95 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-sm">
          <SidebarTrigger className="-ml-1" aria-label="Inhoud van de handleiding" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <Link
            to="/manual"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Handleiding
          </Link>
          <Button asChild size="sm" className="ml-auto">
            <Link to="/farm">Naar {clientConfig.name}</Link>
          </Button>
        </header>
        <div id="inhoud" className="mx-auto w-full max-w-[72rem] px-4 sm:px-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
