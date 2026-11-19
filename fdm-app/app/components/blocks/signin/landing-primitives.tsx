import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "cn"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Link } from "react-router"
import { useAnalytics } from "~/hooks/use-analytics"
import { MANUAL_EVENTS } from "~/lib/manual/analytics"
import { getHelpHref, type HelpTargetId } from "~/lib/manual/help-targets"
import { getScreenshot } from "~/lib/manual/screenshots"

const SECTION_TONES = {
  plain: "bg-background",
  muted: "bg-muted/50 border-y",
  // Brand dark of the public pages (see DESIGN.md, "Unauthenticated pages")
  dark: "bg-[#122023] text-white",
}

/**
 * A full-width band of the public landing page with a centred content column.
 * The content rises into place once, when the section scrolls into view.
 *
 * @param tone - `plain` for the white surface, `muted` for the second neutral layer,
 * `dark` for the brand dark.
 */
export function LandingSection({
  id,
  tone = "plain",
  className,
  children,
}: {
  id?: string
  tone?: keyof typeof SECTION_TONES
  className?: string
  children: ReactNode
}) {
  return (
    <section id={id} className={cn("scroll-mt-14 py-16 lg:py-24", SECTION_TONES[tone], className)}>
      <motion.div
        className="mx-auto w-full max-w-6xl px-4 lg:px-8"
        // Only the offset animates: the content stays visible without JavaScript
        initial={{ y: 24 }}
        whileInView={{ y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </section>
  )
}

/** Left-aligned heading block of a landing section: small label, title and lead. */
export function SectionHeading({
  label,
  title,
  children,
  className,
}: {
  label: string
  title: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className="text-muted-foreground mb-3 text-sm font-medium">{label}</p>
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {children ? (
        <div className="text-muted-foreground mt-4 space-y-4 text-lg leading-relaxed text-pretty">
          {children}
        </div>
      ) : null}
    </div>
  )
}

/** Overview pages of the manual; they are not help targets of their own. */
const MANUAL_OVERVIEWS = {
  background: "/manual/background",
}

/**
 * Link from the landing page to a page of the public manual, with analytics.
 *
 * @param target - A registered help target, so the manual tests catch a link that no longer resolves.
 * @param overview - An overview page of the manual, instead of a help target.
 */
export function ManualLink({
  target,
  overview,
  children,
  className,
  onDark = false,
}: {
  children: ReactNode
  className?: string
  /** Set on the brand dark surface, where the link is white. */
  onDark?: boolean
} & (
  | { target: HelpTargetId; overview?: never }
  | { overview: keyof typeof MANUAL_OVERVIEWS; target?: never }
)) {
  const { capture } = useAnalytics()
  const to = target ? getHelpHref(target) : MANUAL_OVERVIEWS[overview]
  return (
    <Link
      to={to}
      onClick={() =>
        capture(MANUAL_EVENTS.helpLinkClicked, {
          help_target: to,
          source: "signin",
          from_path: "/signin",
        })
      }
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4 hover:no-underline",
        onDark ? "text-white" : "text-foreground",
        className,
      )}
    >
      <span>{children}</span>
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  )
}

/** One item of a feature list: a quiet icon, a title and a short explanation. */
export function FeatureItem({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: LucideIcon
  title: string
  badge?: string
  children: ReactNode
}) {
  return (
    <div className="flex gap-4">
      <Icon className="text-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
          <span>{title}</span>
          {badge ? (
            <span className="text-muted-foreground rounded-md border px-1.5 py-0.5 text-xs font-medium">
              {badge}
            </span>
          ) : null}
        </h3>
        <div className="text-muted-foreground mt-1 text-[0.9375rem] leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * A product screenshot in a hairline frame, with an optional caption.
 *
 * `manualId` shows a screenshot of the user manual and hides the app sidebar,
 * so the picture starts at the content of the screen.
 */
export function ProductShot({
  src,
  manualId,
  alt,
  caption,
  className,
  imageClassName,
  frameClassName,
  eager = false,
}: {
  src?: string
  manualId?: string
  alt: string
  caption?: ReactNode
  className?: string
  imageClassName?: string
  /** Classes for the frame, for example an aspect ratio that crops empty space below the content. */
  frameClassName?: string
  eager?: boolean
}) {
  const manual = manualId ? getScreenshot(manualId) : undefined
  const source = manual?.src ?? src
  if (!source) return null

  return (
    <figure className={className}>
      <div
        className={cn("bg-background overflow-hidden rounded-xl border shadow-xs", frameClassName)}
      >
        {manual ? (
          // The sidebar takes the first 15% of a manual screenshot
          <img
            src={source}
            alt={alt}
            width={manual.width}
            height={manual.height}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className={cn("ml-[-17.7%] block h-auto w-[117.7%] max-w-none", imageClassName)}
          />
        ) : (
          <img
            src={source}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className={cn("block h-auto w-full", imageClassName)}
          />
        )}
      </div>
      {caption ? (
        <figcaption className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
