import { ArrowRight } from "lucide-react"
import { Link } from "react-router"
import type { ManualNavItem } from "~/lib/manual/types"

/** A section of an index page: a heading and its pages with their descriptions. */
export function ManualIndexSection({
  id,
  title,
  intro,
  items,
}: {
  id: string
  title: string
  intro?: string
  items: ManualNavItem[]
}) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="text-foreground text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {intro ? <p className="text-muted-foreground mt-1 text-base leading-7">{intro}</p> : null}
      <ul className="divide-border border-border mt-4 divide-y border-y">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              to={item.href}
              className="group hover:bg-muted/40 -mx-2 flex items-start gap-4 rounded-md px-2 py-4 transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="text-foreground block font-medium">{item.title}</span>
                <span className="text-muted-foreground mt-1 block text-sm leading-6">
                  {item.description}
                </span>
              </span>
              <ArrowRight
                className="text-muted-foreground group-hover:text-foreground mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
