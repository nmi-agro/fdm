// Imported from https://www.shadcnblocks.com/block/changelog1
import { ArrowUpRight } from "lucide-react"
import { NavLink } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"

export type ChangelogEntry = {
  version: string
  date: string
  title: string
  description: string
  items?: string[]
  image?: string
  button?: {
    url: string
    text: string
  }
}

export interface Changelog1Props {
  title?: string
  description?: string
  entries?: ChangelogEntry[]
  className?: string
}

export const defaultEntries: ChangelogEntry[] = []

const Changelog1 = ({
  title = "Changelog",
  description = "Get the latest updates and improvements to our platform.",
  entries = defaultEntries,
}: Changelog1Props) => {
  return (
    <section className="py-32">
      <div className="container">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
          <p className="text-muted-foreground mb-6 text-base md:text-lg">{description}</p>
        </div>
        <div className="mx-auto mt-16 max-w-3xl space-y-16 md:mt-24 md:space-y-24">
          {entries.map((entry) => (
            <div
              key={`${entry.version}-${entry.date}`}
              className="relative flex flex-col gap-4 md:flex-row md:gap-16"
            >
              <div className="top-8 flex h-min w-64 shrink-0 items-center gap-4 md:sticky">
                <Badge variant="secondary" className="text-xs">
                  {entry.version}
                </Badge>
                <span className="text-muted-foreground text-xs font-medium">{entry.date}</span>
              </div>
              <div className="flex flex-col">
                <h2 className="text-foreground/90 mb-3 text-lg leading-tight font-bold md:text-2xl">
                  {entry.title}
                </h2>
                <p className="text-muted-foreground text-sm md:text-base">{entry.description}</p>
                {entry.items && entry.items.length > 0 && (
                  <ul className="text-muted-foreground mt-4 ml-4 space-y-1.5 text-sm md:text-base">
                    {entry.items.map((item, itemIndex) => (
                      <li key={`${entry.version}-item-${itemIndex}`} className="list-disc">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                {entry.image && (
                  <img
                    src={entry.image}
                    alt={`${entry.version} visual`}
                    className="mt-8 w-full rounded-lg object-cover"
                  />
                )}
                {entry.button && (
                  <Button variant="link" className="mt-4 self-end" asChild>
                    <NavLink to={entry.button.url} target="_blank" rel="noopener noreferrer">
                      {entry.button.text} <ArrowUpRight className="h-4 w-4" />
                    </NavLink>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export { Changelog1 }
