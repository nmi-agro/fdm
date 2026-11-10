import { cn } from "cn"
import { Menu } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Link, NavLink } from "react-router"
import type { ManualNavSection } from "~/lib/manual/parse"
import { Button } from "~/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet"
import { clientConfig } from "~/lib/config"

function NavGroup({
  title,
  items,
  onNavigate,
}: {
  title: string
  items: { href: string; title: string }[]
  onNavigate?: () => void
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 px-2 text-xs font-medium">{title}</p>
      <ul className="space-y-px">
        {items.map((item) => (
          <li key={item.href}>
            <NavLink
              to={item.href}
              end
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "block rounded-md px-2 py-1.5 text-sm leading-snug transition-colors",
                  isActive
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )
              }
            >
              {item.title}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The manual navigation: chapters grouped by section, then the background pages. */
export function ManualNav({
  sections,
  onNavigate,
}: {
  sections: ManualNavSection[]
  onNavigate?: () => void
}) {
  const chapters = sections.filter((s) => s.kind === "chapter")
  const background = sections.filter((s) => s.kind === "background")
  return (
    <nav aria-label="Handleiding" className="space-y-6">
      <NavGroup
        title="Handleiding"
        items={[{ href: "/manual", title: "Overzicht" }]}
        onNavigate={onNavigate}
      />
      {chapters.map((section) => (
        <NavGroup
          key={section.title}
          title={section.title}
          items={section.items}
          onNavigate={onNavigate}
        />
      ))}
      <div className="border-border space-y-6 border-t pt-6">
        <NavGroup
          title="Achtergrond"
          items={[{ href: "/manual/background", title: "Hoe wordt het berekend?" }]}
          onNavigate={onNavigate}
        />
        {background.map((section) => (
          <NavGroup
            key={section.title}
            title={section.title}
            items={section.items}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  )
}

function MobileNav({ sections }: { sections: ManualNavSection[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Inhoud van de handleiding"
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Handleiding</SheetTitle>
          <SheetDescription className="sr-only">
            Alle hoofdstukken van de handleiding
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-8">
          <ManualNav sections={sections} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * The frame of every manual page: a header with the product name and a way into the app, the
 * section navigation (a sidebar on desktop, a sheet on phones), and the page content.
 */
export function ManualShell({
  sections,
  children,
}: {
  sections: ManualNavSection[]
  children: ReactNode
}) {
  return (
    <div className="bg-background selection:bg-primary selection:text-primary-foreground min-h-screen">
      <a
        href="#inhoud"
        className="bg-background sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Naar de inhoud
      </a>
      <header className="bg-background/95 border-border sticky top-0 z-40 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-1">
            <MobileNav sections={sections} />
            <Link to="/manual" className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#122023]">
                <img className="size-6" src={clientConfig.logomark} alt="" />
              </span>
              <span className="truncate text-sm font-semibold">{clientConfig.name}</span>
              <span className="text-muted-foreground hidden text-sm sm:inline">Handleiding</span>
            </Link>
          </div>
          <Button asChild size="sm">
            <Link to="/farm">Naar {clientConfig.name}</Link>
          </Button>
        </div>
      </header>
      <div className="mx-auto flex max-w-[90rem] gap-10 px-4 sm:px-6">
        <aside className="border-border sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 [scrollbar-width:thin] overflow-y-auto border-r py-8 pr-4 lg:block">
          <ManualNav sections={sections} />
        </aside>
        <div id="inhoud" className="min-w-0 flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
