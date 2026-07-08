import type { TagSummary } from "@nmi-agro/fdm-helpdesk"
import { useState } from "react"
import { useFetcher } from "react-router"
import { TagCreator } from "./tag-creator"
import { TagSelector } from "./tag-selector"

export function TicketTags({
  availableTags,
  tags,
  isAgent,
}: {
  availableTags: TagSummary[]
  tags: TagSummary[]
  isAgent: boolean
}) {
  const fetcher = useFetcher()

  const [createTagDialogOpen, setCreateTagDialogOpen] = useState(false)

  if (tags.length === 0 && !isAgent) return null

  return (
    <>
      <TagSelector
        availableTags={availableTags}
        value={tags.map((tag) => tag.tag_id)}
        setValue={(value) => {
          const formData = new FormData()
          formData.append("intent", "set_tags")
          formData.append("tags", JSON.stringify(value))
          void fetcher.submit(formData, { method: "POST" })
        }}
        disabled={fetcher.state !== "idle"}
        canModify={isAgent}
        canClear={false}
        canCreateTag={isAgent}
        onCreateTag={() => setCreateTagDialogOpen(true)}
      />
      <TagCreator
        fetcher={fetcher}
        availableTags={availableTags}
        intent={"create_tag"}
        dialogOpen={createTagDialogOpen}
        setDialogOpen={setCreateTagDialogOpen}
      />
    </>
  )
}
