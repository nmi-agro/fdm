import { Bot, Loader2, RefreshCw, Send, User } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Textarea } from "~/components/ui/textarea"
import type { GerritMessage } from "~/store/gerrit-session"
import { SuggestedFollowUps } from "./suggested-follow-ups"

interface GerritChatProps {
    messages: GerritMessage[]
    suggestedFollowUps: string[]
    isStreaming: boolean
    onSendMessage: (text: string) => void
    onUpdatePlan?: (note: string) => void
}

export function GerritChat({
    messages,
    suggestedFollowUps,
    isStreaming,
    onSendMessage,
    onUpdatePlan,
}: GerritChatProps) {
    const [input, setInput] = useState("")
    const [mode, setMode] = useState<"ask" | "update">("ask")
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: "smooth",
            })
        }
    }, [messages, isStreaming])

    function handleSend() {
        const trimmed = input.trim()
        if (!trimmed || isStreaming) return
        if (mode === "update" && onUpdatePlan) {
            onUpdatePlan(trimmed)
        } else {
            onSendMessage(trimmed)
        }
        setInput("")
        setMode("ask")
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const isUpdateMode = mode === "update" && !!onUpdatePlan

    return (
        <Card className={`shadow-sm ${isUpdateMode ? "border-amber-400" : ""}`}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Bot className="w-5 h-5 text-primary" />
                    Stel Gerrit een vraag
                </CardTitle>
                <CardDescription>
                    Vraag om uitleg of verzoek een aanpassing aan het plan.
                </CardDescription>
            </CardHeader>
            <CardContent id="chat" className="space-y-4">
                {/* Suggested follow-ups */}
                {messages.length === 0 && (
                    <SuggestedFollowUps
                        suggestions={suggestedFollowUps}
                        onSelect={(text) => setInput(text)}
                        disabled={isStreaming}
                    />
                )}

                {/* Message thread */}
                {messages.length > 0 && (
                    <div
                        ref={scrollContainerRef}
                        className="space-y-3 max-h-80 overflow-y-auto pr-1 scroll-smooth"
                    >
                        {messages.filter(msg => msg.content.length > 0).map((msg, i) => (
                            <div
                                key={i}
                                className={`flex gap-3 text-sm ${
                                    msg.role === "user"
                                        ? "flex-row-reverse"
                                        : "flex-row"
                                }`}
                            >
                                <div
                                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                                        msg.role === "user"
                                            ? "bg-secondary"
                                            : "bg-primary/10"
                                    }`}
                                >
                                    {msg.role === "user" ? (
                                        <User className="w-3.5 h-3.5 text-secondary-foreground" />
                                    ) : (
                                        <Bot className="w-3.5 h-3.5 text-primary" />
                                    )}
                                </div>
                                <div
                                    className={`rounded-lg px-3 py-2 max-w-[90%] leading-relaxed ${
                                        msg.role === "user"
                                            ? "bg-secondary text-secondary-foreground"
                                            : msg.type === "error"
                                              ? "bg-destructive/10 text-destructive"
                                              : "bg-muted text-muted-foreground"
                                    }`}
                                >
                                    {msg.role === "assistant" ? (
                                        <div className="text-current break-words">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    p: ({ children }) => (
                                                        <p className="mb-2 last:mb-0">
                                                            {children}
                                                        </p>
                                                    ),
                                                    ul: ({ children }) => (
                                                        <ul className="list-disc pl-4 mb-2 space-y-1">
                                                            {children}
                                                        </ul>
                                                    ),
                                                    ol: ({ children }) => (
                                                        <ol className="list-decimal pl-4 mb-2 space-y-1">
                                                            {children}
                                                        </ol>
                                                    ),
                                                    li: ({ children }) => (
                                                        <li className="leading-snug">
                                                            {children}
                                                        </li>
                                                    ),
                                                    strong: ({ children }) => (
                                                        <strong className="font-semibold text-foreground">
                                                            {children}
                                                        </strong>
                                                    ),
                                                    a: ({ href, children }) => (
                                                        <a
                                                            href={href}
                                                            className="underline decoration-primary/30 underline-offset-2 hover:decoration-primary transition-colors"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            {children}
                                                        </a>
                                                    ),
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                        ))}
                        {isStreaming && (
                            <div className="flex gap-3 text-sm">
                                <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-primary/10">
                                    <Bot className="w-3.5 h-3.5 text-primary animate-pulse" />
                                </div>
                                <div className="rounded-lg px-3 py-2 bg-muted text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Gerrit antwoordt…</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* After first messages: show suggestions again */}
                {messages.length > 0 && !isStreaming && (
                    <SuggestedFollowUps
                        suggestions={suggestedFollowUps}
                        onSelect={onSendMessage}
                        disabled={isStreaming}
                    />
                )}

                {/* Mode toggle */}
                {onUpdatePlan && (
                    <div className="flex gap-1 p-1 bg-muted rounded-lg">
                        <button
                            type="button"
                            onClick={() => setMode("ask")}
                            className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                                mode === "ask"
                                    ? "bg-background shadow-sm font-medium text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Vraag stellen
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("update")}
                            className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                                mode === "update"
                                    ? "bg-amber-100 shadow-sm font-medium text-amber-800"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Plan aanpassen
                        </button>
                    </div>
                )}

                {/* Context hint for update mode */}
                {isUpdateMode && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 leading-relaxed">
                        Gerrit herberekent het plan met jouw instructie als extra context. Beschrijf zo specifiek mogelijk wat je anders wilt.
                    </p>
                )}

                {/* Input area */}
                <div className="flex gap-2 items-end">
                    <Textarea
                        placeholder={
                            isUpdateMode
                                ? "Bijv. 'Gebruik alleen drijfmest op perceel Noord' of 'Verhoog N op grasland'"
                                : "Stel je vraag aan Gerrit…"
                        }
                        className={`resize-none min-h-[42px] max-h-32 text-sm ${isUpdateMode ? "border-amber-300 focus-visible:ring-amber-400" : ""}`}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isStreaming}
                        rows={1}
                    />
                    <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={!input.trim() || isStreaming}
                        className={`shrink-0 ${isUpdateMode ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                        aria-label={isUpdateMode ? "Plan herberekenen" : "Versturen"}
                    >
                        {isStreaming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isUpdateMode ? (
                            <RefreshCw className="h-4 w-4" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
