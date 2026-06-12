import type { TagSummary } from "@nmi-agro/fdm-helpdesk"
import { BrushCleaning, CirclePlus, X } from "lucide-react"
import type { MouseEventHandler } from "react"
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
            <div className="flex flex-row flex-wrap items-center gap-2 min-h-7">
                {value.map((tag_id) => {
                    const tag = availableTags.find(
                        (item) => item.tag_id === tag_id,
                    )
                    return (
                        <Badge
                            key={tag_id}
                            variant="outline"
                            className="text-xs gap-1 px-1 py-1"
                        >
                            <div
                                className="size-2 rounded-full"
                                style={{
                                    backgroundColor:
                                        tag?.color ?? DEFAULT_TAG_COLOR,
                                }}
                            />
                            {tag?.name ?? "Onbekend"}
                            {canModify && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Verwijderen"
                                    disabled={disabled}
                                    className="has-[>svg]:p-1 h-auto"
                                    onClick={() => {
                                        setValue?.(
                                            value.filter(
                                                (other_tag_id) =>
                                                    other_tag_id !== tag_id,
                                            ),
                                        )
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
                        <DropdownMenuTrigger
                            disabled={disabled}
                            title="Tag toevoegen"
                        >
                            <CirclePlus className="text-muted-foreground size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {canCreateTag && (
                                <DropdownMenuItem onClick={onCreateTag}>
                                    Nieuwe tag aanmaken...
                                </DropdownMenuItem>
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
                                                backgroundColor:
                                                    tag?.color ??
                                                    DEFAULT_TAG_COLOR,
                                            }}
                                        />
                                        {tag.name}
                                    </DropdownMenuItem>
                                ))}
                            {!canCreateTag && availableTags.length === 0 && (
                                <DropdownMenuLabel>
                                    Geen tags beschikbaar
                                </DropdownMenuLabel>
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
                        className="text-xs m-1 has-[>svg]:p-0 size-auto text-muted-foreground hover:text-destructive"
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
