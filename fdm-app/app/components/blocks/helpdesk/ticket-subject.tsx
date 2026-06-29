import { useEffect, useState } from "react"
import { useFetcher } from "react-router"
import { cn } from "@/app/lib/utils"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"

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
      <h1 className="text-3xl font-bold">
        <Button
          variant="link"
          className="h-auto p-0 text-3xl font-bold"
          onClick={() => setIsEditing(true)}
        >
          {subject ?? "Ticket"}
        </Button>
      </h1>
    )
  }

  return (
    <h1 className="relative text-3xl font-bold">
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
              void fetcher.submit(formData, { method: "POST" })
            } else {
              setValue(subject)
              setIsEditing(false)
            }
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur()
          }
          if (e.key === "Escape") {
            setValue(subject)
            setIsEditing(false)
          }
        }}
      />
      <Spinner
        className={cn(
          "absolute top-1/2 right-2 -translate-y-1/2",
          fetcher.state === "idle" && "invisible",
        )}
      />
    </h1>
  )
}
