import { Bot, Loader2, Send, User } from "lucide-react"
import { useEffect, useRef, useState } from "react"
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
}

export function GerritChat({
    messages,
    suggestedFollowUps,
    isStreaming,
    onSendMessage,
}: GerritChatProps) {
    const [input, setInput] = useState("")
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    function handleSend() {
        const trimmed = input.trim()
        if (!trimmed || isStreaming) return
        onSendMessage(trimmed)
        setInput("")
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Bot className="w-5 h-5 text-primary" />
                    Stel Gerrit een vraag
                </CardTitle>
                <CardDescription>
                    Vraag om uitleg, stel alternatieve scenario's voor, of
                    verzoek aanpassingen aan het plan.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Suggested follow-ups */}
                {messages.length === 0 && (
                    <SuggestedFollowUps
                        suggestions={suggestedFollowUps}
                        onSelect={(text) => {
                            setInput(text)
                        }}
                        disabled={isStreaming}
                    />
                )}

                {/* Message thread */}
                {messages.length > 0 && (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {messages.map((msg, i) => (
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
                                    className={`rounded-lg px-3 py-2 max-w-[85%] leading-relaxed ${
                                        msg.role === "user"
                                            ? "bg-secondary text-secondary-foreground"
                                            : msg.type === "error"
                                              ? "bg-destructive/10 text-destructive"
                                              : "bg-muted text-muted-foreground"
                                    }`}
                                >
                                    {msg.content}
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
                        <div ref={bottomRef} />
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

                {/* Input area */}
                <div className="flex gap-2 items-end">
                    <Textarea
                        placeholder="Stel je vraag aan Gerrit…"
                        className="resize-none min-h-[42px] max-h-32 text-sm"
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
                        className="shrink-0"
                        aria-label="Versturen"
                    >
                        {isStreaming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
