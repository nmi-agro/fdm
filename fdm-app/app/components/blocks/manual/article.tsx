import type { ComponentProps, ReactNode } from "react"
import { ExternalLink, Info, Link2 } from "lucide-react"
import ReactMarkdown, { type Components } from "react-markdown"
import { Link } from "react-router"
import remarkGfm from "remark-gfm"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "~/components/ui/dialog"
import { manualUrlTransform, remarkHeadingIds } from "~/lib/manual/markdown"
import { getScreenshot } from "~/lib/manual/screenshots"
import { cn } from "~/lib/utils"

/**
 * A UI label as it appears in the app: a small outlined button-like chip. In manual content every
 * **bold** text is a UI label, so the reader recognises exactly what to click. Like a button in
 * the app, the chip never wraps. `data-slot` keeps typeset from restyling it.
 */
export function UiLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <strong
      data-slot="ui-label"
      className={cn(
        "border-border bg-background text-foreground rounded-md border px-1.5 py-px text-[0.9375em] font-medium whitespace-nowrap shadow-xs",
        className,
      )}
    >
      {children}
    </strong>
  )
}

function HeadingAnchor({ id }: { id?: string }) {
  if (!id) return null
  return (
    <a
      href={`#${id}`}
      aria-label="Link naar deze sectie"
      className="text-muted-foreground hover:text-foreground ml-2 inline-flex align-middle no-underline opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
    >
      <Link2 className="size-4" />
    </a>
  )
}

function Screenshot({ src, alt }: { src?: string; alt?: string }) {
  const screenshot = src ? getScreenshot(src) : undefined
  if (!screenshot) {
    if (!import.meta.env.DEV) return null
    return (
      <figure className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
        <span>Screenshot ontbreekt: {src}</span>
      </figure>
    )
  }
  // Screenshots are captured at full screen size, so the article shows them scaled down. Clicking
  // one opens it at full size.
  return (
    <figure>
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={alt ? `Vergroot afbeelding: ${alt}` : "Vergroot afbeelding"}
            className="focus-visible:ring-ring block w-full cursor-zoom-in rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <img
              src={screenshot.src}
              alt={alt ?? ""}
              width={screenshot.width}
              height={screenshot.height}
              loading="lazy"
              className="border-border w-full border"
            />
          </button>
        </DialogTrigger>
        <DialogContent className="w-[96vw] max-w-[96vw] p-2 pt-10 sm:max-w-[96vw]">
          <DialogTitle className="sr-only">{alt || "Afbeelding"}</DialogTitle>
          <img
            src={screenshot.src}
            alt={alt ?? ""}
            width={screenshot.width}
            height={screenshot.height}
            className="h-auto max-h-[85vh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
      {alt ? <figcaption>{alt}</figcaption> : null}
    </figure>
  )
}

/**
 * Element overrides on top of shadcn typeset (`app/typeset.css`), which sets the type scale,
 * rhythm, lists and tables. Only behaviour lives here: heading anchors, UI-label chips,
 * client-side links, notes and screenshots.
 */
const articleComponents: Components = {
  h2: ({ id, children }) => (
    <h2 id={id} className="group scroll-mt-20 text-balance">
      <span>{children}</span>
      <HeadingAnchor id={id} />
    </h2>
  ),
  h3: ({ id, children }) => (
    <h3 id={id} className="group scroll-mt-20 text-balance">
      <span>{children}</span>
      <HeadingAnchor id={id} />
    </h3>
  ),
  p: ({ node, children }) => {
    const only = node?.children.length === 1 ? node.children[0] : undefined
    if (only?.type === "element" && only.tagName === "img") return <>{children}</>
    return <p>{children}</p>
  },
  strong: ({ children }) => <UiLabel>{children}</UiLabel>,
  a: ({ href = "", children }) => {
    if (href.startsWith("/")) return <Link to={href}>{children}</Link>
    if (href.startsWith("#")) return <a href={href}>{children}</a>
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <ExternalLink aria-hidden className="ml-0.5 inline size-3.5 align-[-0.125em]" />
        <span className="sr-only"> (opent in een nieuw tabblad)</span>
      </a>
    )
  },
  blockquote: ({ children }) => (
    <aside
      data-slot="manual-note"
      className="bg-muted/50 border-border mt-[var(--typeset-flow)] flex gap-3 rounded-lg border p-4 text-[0.9375em] leading-relaxed [&_p+p]:mt-2"
    >
      <Info className="text-muted-foreground mt-1 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </aside>
  ),
  img: ({ src, alt }) => <Screenshot src={typeof src === "string" ? src : undefined} alt={alt} />,
  table: ({ children }) => (
    <div className="typeset-scroll">
      <table className="text-[0.9375em]">{children}</table>
    </div>
  ),
}

/**
 * Renders the Markdown body of a manual page with shadcn typeset: headings with anchors, UI labels
 * as chips, internal links as client-side navigation and `screenshot:` images as figures.
 */
export function ManualArticle({
  markdown,
  className,
  ...props
}: { markdown: string } & ComponentProps<"div">) {
  return (
    <div className={cn("typeset typeset-manual min-w-0", className)} {...props}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkHeadingIds]}
        urlTransform={manualUrlTransform}
        components={articleComponents}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
