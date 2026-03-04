import { ArrowLeft } from "lucide-react"
import type { MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router"
import ReactMarkdown from "react-markdown"
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
            privacyUrl.startsWith("http://") ||
            privacyUrl.startsWith("https://")
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
        <div className="min-h-screen bg-muted/20 flex flex-col">
            {/* Top navigation bar — matches signin sticky header style */}
            <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md px-4 py-3 shadow-xs">
                <div className="mx-auto flex max-w-4xl items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-[#122023]">
                            <img
                                className="size-6"
                                src={clientConfig.logomark}
                                alt={clientConfig.name}
                            />
                        </div>
                        <span className="font-semibold text-sm">
                            {clientConfig.name}
                        </span>
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
            <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
                <div className="rounded-xl border border-border/40 bg-background shadow-sm px-6 py-10 sm:px-10">
                    {content ? (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({ children }) => (
                                    <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">
                                        {children}
                                    </h1>
                                ),
                                h2: ({ children }) => (
                                    <h2 className="text-xl font-semibold mb-3 mt-10 text-foreground border-b border-border pb-2">
                                        {children}
                                    </h2>
                                ),
                                h3: ({ children }) => (
                                    <h3 className="text-base font-semibold mb-2 mt-6 text-foreground">
                                        {children}
                                    </h3>
                                ),
                                p: ({ children }) => (
                                    <p className="mb-4 text-sm text-muted-foreground leading-7">
                                        {children}
                                    </p>
                                ),
                                ul: ({ children }) => (
                                    <ul className="list-disc list-outside pl-5 mb-4 space-y-1.5">
                                        {children}
                                    </ul>
                                ),
                                ol: ({ children }) => (
                                    <ol className="list-decimal list-outside pl-5 mb-4 space-y-1.5">
                                        {children}
                                    </ol>
                                ),
                                li: ({ children }) => (
                                    <li className="text-sm text-muted-foreground leading-7">
                                        {children}
                                    </li>
                                ),
                                a: ({ href, children }) => (
                                    <a
                                        href={href}
                                        className="text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary transition-colors"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {children}
                                    </a>
                                ),
                                strong: ({ children }) => (
                                    <strong className="font-semibold text-foreground">
                                        {children}
                                    </strong>
                                ),
                                em: ({ children }) => (
                                    <em className="italic text-muted-foreground">
                                        {children}
                                    </em>
                                ),
                                blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground mb-4 bg-muted/30 py-2 pr-2 rounded-r-md">
                                        {children}
                                    </blockquote>
                                ),
                                hr: () => <hr className="my-8 border-border" />,
                                table: ({ children }) => (
                                    <div className="overflow-x-auto mb-6 rounded-lg border border-border">
                                        <table className="w-full text-sm border-collapse">
                                            {children}
                                        </table>
                                    </div>
                                ),
                                th: ({ children }) => (
                                    <th className="border-b border-border px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide bg-muted text-muted-foreground">
                                        {children}
                                    </th>
                                ),
                                td: ({ children }) => (
                                    <td className="border-b border-border/50 px-4 py-2.5 text-sm text-muted-foreground last:border-b-0">
                                        {children}
                                    </td>
                                ),
                                code: ({ children }) => (
                                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
                                        {children}
                                    </code>
                                ),
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                            <p className="text-muted-foreground text-sm">
                                Het privacybeleid is niet geconfigureerd.
                            </p>
                            <p className="text-xs text-muted-foreground/60">
                                Stel{" "}
                                <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                                    FDM_PRIVACY_URL
                                </code>{" "}
                                in om het privacybeleid te tonen.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer attribution */}
                <p className="text-center text-xs text-muted-foreground/60 mt-6">
                    {clientConfig.name}
                </p>
            </main>
        </div>
    )
}
