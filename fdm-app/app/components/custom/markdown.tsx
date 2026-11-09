import type { Components } from "react-markdown"

/**
 * Styled react-markdown components for long-form text on public pages, such as the privacy
 * policy. The manual extends these with anchors, internal links and screenshots.
 */
export const markdownComponents = {
  h1: ({ children }) => (
    <h1 className="text-foreground mb-2 text-3xl font-bold tracking-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-foreground border-border mt-10 mb-3 border-b pb-2 text-xl font-semibold">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-foreground mt-6 mb-2 text-base font-semibold">{children}</h3>
  ),
  p: ({ children }) => <p className="text-muted-foreground mb-4 text-sm leading-7">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-4 list-outside list-disc space-y-1.5 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 list-outside list-decimal space-y-1.5 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="text-muted-foreground text-sm leading-7">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary decoration-primary/30 hover:decoration-primary underline underline-offset-4 transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-muted-foreground italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-primary/30 text-muted-foreground bg-muted/30 mb-4 rounded-r-md border-l-4 py-2 pr-2 pl-4 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border my-8" />,
  table: ({ children }) => (
    <div className="border-border mb-6 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-border bg-muted text-muted-foreground border-b px-4 py-2.5 text-left text-xs font-medium tracking-wide uppercase">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-border/50 text-muted-foreground border-b px-4 py-2.5 text-sm last:border-b-0">
      {children}
    </td>
  ),
  code: ({ children }) => (
    <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  ),
} satisfies Components
