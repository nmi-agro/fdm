import type { MetaFunction } from "react-router"
import { ArrowLeft } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Link, useLoaderData } from "react-router"
import remarkGfm from "remark-gfm"
import { Button } from "~/components/ui/button"
import { clientConfig } from "~/lib/config"
import { serverConfig } from "~/lib/config.server"

export const meta: MetaFunction = () => {
  return [
    { title: `Privacyvoorwaarden | ${clientConfig.name}` },
    {
      name: "description",
      content: `Bekijk de privacyvoorwaarden van ${clientConfig.name}.`,
    },
  ]
}

export async function loader() {
  const privacyUrl = serverConfig.privacy_url

  if (!privacyUrl) {
    return { content: null }
  }

  try {
    // Relative paths are resolved against the app's own base URL
    // (e.g. "privacy.md" → "http://localhost:5173/privacy.md")
    // Files placed in public/ are served statically at the root.
    const absoluteUrl =
      privacyUrl.startsWith("http://") || privacyUrl.startsWith("https://")
        ? privacyUrl
        : new URL(privacyUrl, serverConfig.url).toString()

    const response = await fetch(absoluteUrl, {
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return { content: null }
    const content = await response.text()
    return { content }
  } catch {
    return { content: null }
  }
}

export default function PrivacyPage() {
  const { content } = useLoaderData<typeof loader>()

  return (
    <div className="bg-muted/20 flex min-h-screen flex-col">
      {/* Top navigation bar — matches signin sticky header style */}
      <header className="bg-background/80 sticky top-0 z-10 border-b px-4 py-3 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#122023]">
              <img className="size-6" src={clientConfig.logomark} alt={clientConfig.name} />
            </div>
            <span className="text-sm font-semibold">{clientConfig.name}</span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/signin">
              <ArrowLeft className="size-4" />
              Terug naar aanmelden
            </Link>
          </Button>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="border-border/40 bg-background rounded-xl border px-6 py-10 shadow-sm sm:px-10">
          {content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-foreground mb-2 text-3xl font-bold tracking-tight">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-foreground border-border mt-10 mb-3 border-b pb-2 text-xl font-semibold">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-foreground mt-6 mb-2 text-base font-semibold">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-muted-foreground mb-4 text-sm leading-7">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-4 list-outside list-disc space-y-1.5 pl-5">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-4 list-outside list-decimal space-y-1.5 pl-5">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-muted-foreground text-sm leading-7">{children}</li>
                ),
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
                strong: ({ children }) => (
                  <strong className="text-foreground font-semibold">{children}</strong>
                ),
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
              }}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-muted-foreground text-sm">
                Het privacybeleid is niet geconfigureerd.
              </p>
              <p className="text-muted-foreground/60 text-xs">
                Stel{" "}
                <code className="bg-muted rounded px-1.5 py-0.5 font-mono">FDM_PRIVACY_URL</code> in
                om het privacybeleid te tonen.
              </p>
            </div>
          )}
        </div>

        {/* Footer attribution */}
        <p className="text-muted-foreground/60 mt-6 text-center text-xs">{clientConfig.name}</p>
      </main>
    </div>
  )
}
