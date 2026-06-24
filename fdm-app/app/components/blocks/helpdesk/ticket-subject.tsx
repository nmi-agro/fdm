import { useEffect, useState } from "react"
import { useFetcher } from "react-router"
import { Input } from "~/components/ui/input"
import { Button } from "../../ui/button"
import { Spinner } from "../../ui/spinner"
import { cn } from "@/app/lib/utils"

export function TicketSubjectEditor({
    subject = "Ticket",
    canModify,
}: {
    subject?: string
    canModify: boolean
}) {
    const fetcher = useFetcher()
    const [isEditing, setIsEditing] = useState(false)
    const [value, setValue] = useState(subject)

    useEffect(() => {
        if (fetcher.state === "idle") {
            setIsEditing(false)
        }
    }, [fetcher.state])

    useEffect(() => {
        setValue(subject)
    }, [subject])

    if (!canModify) {
        return <h1 className="text-3xl font-bold">{subject}</h1>
    }

    if (!isEditing && fetcher.state === "idle") {
        return (
            <Button
                variant="link"
                className="text-3xl font-bold"
                onClick={() => setIsEditing(true)}
            >
                {subject ?? "Ticket"}
            </Button>
        )
    }

    return (
        <div className="relative">
            <Input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={fetcher.state !== "idle"}
                autoFocus
                onBlur={() => {
                    if (isEditing) {
                        if (value !== subject) {
                            const formData = new FormData()
                            formData.set("intent", "update_subject")
                            formData.set("subject", value)
                            fetcher.submit(formData, { method: "POST" })
                        } else {
                            setIsEditing(false)
                        }
                    }
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.currentTarget.blur()
                    }
                    if (e.key === "Escape") {
                        setIsEditing(false)
                    }
                }}
            />
            <Spinner
                className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2",
                    fetcher.state === "idle" && "invisible",
                )}
            />
        </div>
    )
}
