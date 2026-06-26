import type { TagSummary } from "@nmi-agro/fdm-helpdesk"
import type { MouseEventHandler } from "react"
import { BrushCleaning, CirclePlus, X } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Spinner } from "~/components/ui/spinner"
import { DEFAULT_TAG_COLOR } from "./tag-creator"

export function TagSelector({
  availableTags,
  value,
  setValue,
  disabled,
  canModify,
  canClear,
  canCreateTag,
  onCreateTag,
}: {
  availableTags: TagSummary[]
  value: string[]
  setValue?: (value: string[]) => void
  disabled: boolean
  canModify: boolean
  canClear: boolean
  canCreateTag: boolean
  onCreateTag?: MouseEventHandler
}) {
  return (
    <div>
      <div className="flex min-h-7 flex-row flex-wrap items-center gap-2">
        {value.map((tag_id) => {
          const tag = availableTags.find((item) => item.tag_id === tag_id)
          return (
            <Badge key={tag_id} variant="outline" className="gap-1 px-1 py-1 text-xs">
              <div
                className="size-2 rounded-full"
                style={{
                  backgroundColor: tag?.color ?? DEFAULT_TAG_COLOR,
                }}
              />
              {tag?.name ?? "Onbekend"}
              {canModify && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Verwijderen"
                  disabled={disabled}
                  className="h-auto has-[>svg]:p-1"
                  onClick={() => {
                    setValue?.(value.filter((other_tag_id) => other_tag_id !== tag_id))
                  }}
                >
                  <X className="size-3" />
                </Button>
              )}
            </Badge>
          )
        })}
        {canModify && (
          <DropdownMenu>
            <DropdownMenuTrigger disabled={disabled} title="Tag toevoegen">
              <CirclePlus className="text-muted-foreground size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {canCreateTag && (
                <DropdownMenuItem onClick={onCreateTag}>Nieuwe tag aanmaken...</DropdownMenuItem>
              )}
              {availableTags
                .filter((tag) => !value.includes(tag.tag_id))
                .map((tag) => (
                  <DropdownMenuItem
                    key={tag.tag_id}
                    className="flex flex-row items-center"
                    onClick={() => {
                      setValue?.([...value, tag.tag_id])
                    }}
                    disabled={disabled}
                  >
                    <div
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor: tag?.color ?? DEFAULT_TAG_COLOR,
                      }}
                    />
                    {tag.name}
                  </DropdownMenuItem>
                ))}
              {!canCreateTag && availableTags.length === 0 && (
                <DropdownMenuLabel>Geen tags beschikbaar</DropdownMenuLabel>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {canClear && value.length > 0 && (
          <Button
            type="button"
            title="Alle tags wissen"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive m-1 size-auto text-xs has-[>svg]:p-0"
            onClick={() => setValue?.([])}
          >
            <BrushCleaning />
          </Button>
        )}
        {disabled && (
          <div className="text-muted-foreground">
            <Spinner />
            Even geduld...
          </div>
        )}
      </div>
    </div>
  )
}
