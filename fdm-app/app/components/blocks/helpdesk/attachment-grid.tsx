import { Eye, LucideFile, Trash2, X } from "lucide-react"
import { HTMLAttributes, useState } from "react"
import { Button } from "~/components/ui/button"
import { Dialog } from "~/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { ALLOWED_IMAGE_MIME_TYPES } from "~/lib/upload-utils"
import { cn } from "~/lib/utils"
import { AttachmentViewerDialogContent } from "./attachment-viewer"

export function formatFileSize(sizeInBytes: number) {
  return sizeInBytes > 1024 * 1024
    ? `${Math.round((sizeInBytes / 1024 / 1024) * 10) / 10}MB`
    : sizeInBytes > 1024
      ? `${Math.round((sizeInBytes / 1024) * 10) / 10}KB`
      : `${sizeInBytes}B`
}

export interface AttachmentGridItem {
  attachment_id: string
  file_name: string
  mime_type: string
  file_size: number
  file_path: string
  object?: any
}

/**
 * A component that renders all the specified image attachments side by side and other attachments below them. Each item can be clicked to open it, which calls `onOpen`. Each item also get a delete button if `canDelete` is set, and `onDelete` is called when they are clicked.
 *
 * `onOpen` and `onDelete` will be called with each item's `object` property. In addition, `id` should be a string unique between the items.
 */
export function AttachmentGrid({
  className,
  items,
  canDelete,
  onDelete,
}: {
  className?: string
  items: AttachmentGridItem[]
  canDelete: boolean
  onDelete?: (object: any) => void
}) {
  const imageItems = items.filter((item) => ALLOWED_IMAGE_MIME_TYPES.includes(item.mime_type))
  const nonImageItems = items.filter((item) => !ALLOWED_IMAGE_MIME_TYPES.includes(item.mime_type))
  const [openedItem, setOpenedItem] = useState<AttachmentGridItem | null>(null)

  return (
    <div className={cn("space-y-4", className)}>
      {imageItems.length > 0 ? (
        <div className="flex flex-wrap items-stretch gap-4">
          {imageItems.map((item) => (
            <AttachmentGridImage
              key={item.attachment_id}
              name={item.file_name}
              src={item.file_path as string}
              alt={item.file_name}
              canDelete={canDelete}
              onDelete={() => onDelete?.(item.object)}
              onClick={() => setOpenedItem(item)}
            />
          ))}
        </div>
      ) : undefined}
      {nonImageItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {nonImageItems.map((item) => (
            <div
              key={item.attachment_id}
              className="bg-card border-muted flex min-w-0 items-center gap-2 rounded-sm border px-2 text-xs"
            >
              <Button
                type="button"
                variant="link"
                title="Klik om bijlage te bekijken"
                className="text-muted-foreground hover:text-foreground min-w-0 shrink grow justify-start overflow-hidden text-xs has-[>svg]:ps-0 has-[>svg]:pe-2"
                onClick={() => setOpenedItem(item)}
              >
                <LucideFile />
                <span className="min-w-0 truncate underline-offset-2">{item.file_name}</span>
              </Button>
              <span className="text-muted-foreground ms-auto text-xs">
                {formatFileSize(item.file_size)}
              </span>
              {canDelete ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete?.(item.object)}
                      className="text-muted-foreground hover:text-destructive h-8 px-2 text-xs"
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Bijlage verwijderen</TooltipContent>
                </Tooltip>
              ) : undefined}
            </div>
          ))}
        </div>
      ) : undefined}
      <Dialog
        open={!!openedItem}
        onOpenChange={(value) => {
          if (!value) setOpenedItem(null)
        }}
      >
        <AttachmentViewerDialogContent
          attachment={openedItem ?? { file_path: "", file_name: "", mime_type: "" }}
        />
      </Dialog>
    </div>
  )
}

function AttachmentGridImage({
  name,
  src,
  alt,
  canDelete,
  onDelete,
  onClick,
}: {
  name: string
  src: string
  alt: string
  canDelete: boolean
  onDelete?: () => void
  onClick?: HTMLAttributes<HTMLImageElement>["onClick"]
}) {
  const [style, setStyle] = useState<HTMLAttributes<HTMLDivElement>["style"]>({
    flexGrow: 1,
  })
  return (
    <div className={cn("box-border h-40 max-w-60 sm:h-50", canDelete && "pt-3 pr-3")} style={style}>
      <div className="group border-muted-foreground relative size-full border">
        <img
          key={src}
          src={src}
          alt={alt}
          className="text-muted-foreground size-full cursor-pointer object-cover text-xs"
          onLoad={(e) => {
            setStyle((current) => ({
              ...current,
              flexGrow:
                e.currentTarget && e.currentTarget.width > 0 && e.currentTarget.height > 0
                  ? e.currentTarget.width / e.currentTarget.height
                  : 1,
            }))
          }}
          onClick={onClick}
        />
        <div
          className="pointer-events-none invisible absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100"
          aria-hidden="true"
        >
          <Eye className="size-6 text-white drop-shadow" />
        </div>
        <div
          className={
            "invisible absolute bottom-0 box-border w-full bg-black/50 p-1 text-xs wrap-break-word text-white group-hover:visible"
          }
        >
          {name}
        </div>
        {canDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete?.()
                }}
                className="invisible absolute top-0 right-0 size-6 translate-x-1/2 -translate-y-1/2 rounded-full group-hover:visible"
                aria-label="Afbeelding verwijderen"
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bijlage verwijderen</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
