import type { Tag } from "@nmi-agro/fdm-helpdesk"
import { Trash2 } from "lucide-react"
import { type SetStateAction, useEffect, useState } from "react"
import { Form, useFetcher } from "react-router"
import { toast } from "sonner"
import { cn } from "@/app/lib/utils"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { Table, TableBody, TableCell, TableRow } from "~/components/ui/table"
import {
    DEFAULT_TAG_COLOR,
    DEFAULT_TAG_COLOR_LABEL,
    SWATCH,
    TagCreator,
} from "./tag-creator"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "../../ui/empty"

type TagExtended = Tag

export function HelpdeskTagManager({
    availableTags,
    canModify,
}: {
    availableTags: TagExtended[]
    canModify: boolean
}) {
    const createTagFetcher = useFetcher()

    const [tagCreateDialogOpen, setTagCreateDialogOpen] = useState(false)
    const [activeTableCell, setActiveTableCell] = useState<string | null>(null)

    return (
        <Card className="mx-auto max-w-5xl">
            {canModify && (
                <CardHeader className="flex flex-row items-center gap-2">
                    <CardTitle className="grow">Tags</CardTitle>
                    <Button onClick={() => setTagCreateDialogOpen(true)}>
                        Nieuwe tag aanmaken
                    </Button>
                    <TagCreator
                        fetcher={createTagFetcher}
                        intent="create_tag"
                        availableTags={availableTags}
                        dialogOpen={tagCreateDialogOpen}
                        setDialogOpen={setTagCreateDialogOpen}
                    />
                </CardHeader>
            )}
            <CardContent className="first:pt-6">
                {availableTags.length > 0 ? (
                    <Table className="w-full">
                        <TableBody>
                            {availableTags.map((tag) => (
                                <TagRow
                                    key={tag.tag_id}
                                    tag={tag}
                                    canModify={canModify}
                                    activeTableCell={activeTableCell}
                                    setActiveTableCell={setActiveTableCell}
                                />
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <Empty>
                        <EmptyHeader>
                            <EmptyTitle>Geen tags gevonden</EmptyTitle>
                            <EmptyDescription>
                                {canModify
                                    ? "Maak nieuwe tags aan om ze te kunnen gebruiken."
                                    : "Je kunt nieuwe tags zien zodra ze worden aangemaakt."}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
            </CardContent>
        </Card>
    )
}

export interface TagRowProps {
    tag: TagExtended
    canModify: boolean
    activeTableCell: string | null
    setActiveTableCell: (id: SetStateAction<string | null>) => void
}

export function TagRow({
    tag,
    canModify,
    activeTableCell,
    setActiveTableCell,
}: TagRowProps) {
    const fetcher = useFetcher()
    const isSubmitting = fetcher.state !== "idle"

    const activeColorOption =
        SWATCH.find((color) => color.value === tag.color) ??
        (tag.color
            ? { value: tag.color, label: tag.color }
            : { value: DEFAULT_TAG_COLOR, label: DEFAULT_TAG_COLOR_LABEL })

    return (
        <TableRow>
            <TableCell className="align-middle" width="99%">
                <TagNameCell
                    tag={tag}
                    canModify={canModify}
                    activeTableCell={activeTableCell}
                    setActiveTableCell={setActiveTableCell}
                />
            </TableCell>
            <TableCell>
                <Spinner
                    className={cn(fetcher.state === "idle" && "invisible")}
                />
            </TableCell>
            <TableCell className="align-middle">
                {canModify ? (
                    <Select
                        value={tag.color ?? undefined}
                        onValueChange={(value) => {
                            const formData = new FormData()
                            formData.append("intent", "update_tag")
                            formData.append("tag_id", tag.tag_id)
                            formData.append("color", value)
                            fetcher.submit(formData, { method: "post" })
                        }}
                    >
                        <SelectTrigger
                            className="text-start gap-2"
                            title="Kleur"
                        >
                            <div
                                className="size-4 rounded-sm"
                                style={{
                                    backgroundColor: activeColorOption.value,
                                }}
                            />
                            <div className="grow">
                                {activeColorOption.label}
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            {SWATCH.map((color) => (
                                <SelectItem
                                    key={color.value}
                                    value={color.value}
                                >
                                    <div className="flex flex-row items-center gap-2">
                                        <div
                                            className="size-4 rounded-sm"
                                            style={{
                                                backgroundColor: color.value,
                                            }}
                                        />
                                        {color.label}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    (SWATCH.find((color) => color.value === tag.color)?.label ??
                    tag.color)
                )}
            </TableCell>
            {canModify && (
                <TableCell className="text-end align-middle">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={isSubmitting}
                                title="Verwijderen"
                            >
                                <Trash2 />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    Weet je het zeker?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    Deze actie kan niet ongedaan worden gemaakt.
                                    De tag wordt van alle tickets verwijderd.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isSubmitting}>
                                    Annuleren
                                </AlertDialogCancel>
                                <Form method="POST">
                                    <input
                                        type="hidden"
                                        name="tag_id"
                                        value={tag.tag_id}
                                    />
                                    <Button
                                        type="submit"
                                        name="intent"
                                        value="delete_tag"
                                        variant="destructive"
                                        disabled={isSubmitting}
                                        className="w-full"
                                    >
                                        {isSubmitting ? (
                                            <div className="flex items-center space-x-2">
                                                <Spinner />
                                                <span>Verwijderen</span>
                                            </div>
                                        ) : (
                                            "Verwijderen"
                                        )}
                                    </Button>
                                </Form>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </TableCell>
            )}
        </TableRow>
    )
}

function TagNameCell({
    tag,
    canModify,
    activeTableCell,
    setActiveTableCell,
}: TagRowProps) {
    const fetcher = useFetcher()

    const nameCellId = `${tag.tag_id}.name`

    useEffect(() => {
        if (fetcher.state === "idle") {
            if (!fetcher.data?.errors) {
                setActiveTableCell((currentActiveCell) =>
                    currentActiveCell === nameCellId ? null : currentActiveCell,
                )
            }
        }
    }, [fetcher.state, fetcher.data, nameCellId, setActiveTableCell])

    const isSubmitting = fetcher.state !== "idle"
    const isInvalid = !!fetcher.data?.errors?.[nameCellId]

    return canModify ? (
        nameCellId === activeTableCell ? (
            <div className="relative w-[20em]">
                <Input
                    ref={(el) => el?.focus()}
                    type="text"
                    defaultValue={tag.name}
                    min={1}
                    aria-invalid={isInvalid}
                    disabled={isSubmitting}
                    onBlur={(e) => {
                        if (e.currentTarget.value === "") {
                            toast.warning("Schrijf een naam.")
                            return
                        }
                        if (e.currentTarget.value === tag.name) {
                            setActiveTableCell((currentActiveCell) =>
                                currentActiveCell === nameCellId
                                    ? null
                                    : currentActiveCell,
                            )
                            return
                        }
                        const formData = new FormData()
                        formData.append("intent", "update_tag")
                        formData.append("tag_id", tag.tag_id)
                        formData.append("name", e.currentTarget.value)
                        fetcher.submit(formData, { method: "POST" })
                    }}
                />
                {isSubmitting && (
                    <Spinner className="absolute right-2 top-1/2 -translate-y-1/2" />
                )}
            </div>
        ) : (
            <Button
                type="button"
                variant="link"
                title="Klik om te wijzigen"
                onClick={() => setActiveTableCell(nameCellId)}
            >
                {tag.name}
            </Button>
        )
    ) : (
        tag.name
    )
}
