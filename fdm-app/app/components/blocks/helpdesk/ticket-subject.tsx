import { useState } from "react"
import { useFetcher } from "react-router"
import { cn } from "@/app/lib/utils"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { useKeyedState } from "~/hooks/use-keyed-state"

export function TicketSubjectEditor({
  subject = "Ticket",
  canModify,
}: {
  subject?: string
  canModify: boolean
}) {
  const fetcher = useFetcher()
  const [isEditing, setIsEditing] = useState(false)
  // Resets to the (possibly externally updated) subject whenever it changes, while surviving
  // this component's own in-progress edits.
  const [value, setValue] = useKeyedState(subject, (s) => s)

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
        onBlur={async () => {
          if (isEditing) {
            if (value !== subject) {
              const formData = new FormData()
              formData.set("intent", "update_subject")
              formData.set("subject", value)
              await fetcher.submit(formData, { method: "POST" })
              setIsEditing(false)
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
