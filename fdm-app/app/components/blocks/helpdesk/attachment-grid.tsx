import { LucideFile, Trash2, X } from "lucide-react"
import { HTMLAttributes, useState } from "react"
import { ALLOWED_IMAGE_MIME_TYPES } from "@/app/lib/upload-utils"
import { PdfViewerDialogContent } from "~/components/custom/pdf-viewer"
import { Button } from "~/components/ui/button"
import { Dialog } from "~/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

export function formatFileSize(sizeInBytes: number) {
  return sizeInBytes > 1024 * 1024
    ? `${Math.round((sizeInBytes / 1024 / 1024) * 10) / 10}MB`
    : sizeInBytes > 1024
      ? `${Math.round((sizeInBytes / 1024) * 10) / 10}KB`
      : `${sizeInBytes}B`
}

export interface AttachmentGridItem {
  id: string
  name: string
  type: string
  size: number
  url: string
  object?: any
}

/**
 * A component that renders all the specified image attachment side by side and other attachments below them. Each item can be clicked to open it, which calls `onOpen`. Each item also get a delete button if `canDelete` is set, and `onDelete` is called when they are clicked.
 *
 * `onOpen` and `onDelete` will be called with each item's `object` property. In addition, `id` should be a string unique between the items.
 */
export function AttachmentGrid({
  items,
  canDelete,
  onDelete,
}: {
  items: AttachmentGridItem[]
  canDelete: boolean
  onDelete?: (object: any) => void
}) {
  const imageItems = items.filter((item) => ALLOWED_IMAGE_MIME_TYPES.includes(item.type))
  const nonImageItems = items.filter((item) => !ALLOWED_IMAGE_MIME_TYPES.includes(item.type))
  const [openedItem, setOpenedItem] = useState<AttachmentGridItem | null>(null)

  return (
    <div className="space-y-4">
      {imageItems.length > 0 ? (
        <div className="flex h-40 flex-wrap items-stretch gap-1 sm:h-50">
          {imageItems.map((item) => (
            <AttachmentGridImage
              key={item.id}
              name={item.name}
              src={item.url as string}
              alt={item.name}
              canDelete={canDelete}
              onDelete={() => onDelete?.(item.object)}
              onClick={() => setOpenedItem(item)}
            />
          ))}
        </div>
      ) : undefined}
      {nonImageItems.length > 0 ? (
        <div className="space-y-2">
          {nonImageItems.map((item) => (
            <div key={item.id} className="bg-muted flex items-center gap-2 rounded-sm text-xs">
              <Button
                variant="link"
                className="has-[>svg]:px-1"
                onClick={() => setOpenedItem(item)}
              >
                <LucideFile />
                {item.name}
              </Button>
              <span className="self-end">{formatFileSize(item.size)}</span>
              {canDelete ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete?.(item.object)}
                      className="text-muted-foreground hover:text-destructive h-8 self-end px-2 text-xs"
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
        <PdfViewerDialogContent
          downloadUrl={openedItem?.url ?? ""}
          filename={openedItem?.name ?? ""}
          title={openedItem?.name ?? ""}
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
    flexGrow: "none",
  })
  return (
    <div className={cn("box-border h-full max-w-60", canDelete && "pt-3 pr-3")} style={style}>
      <div className="group relative size-full">
        <img
          key={src}
          src={src}
          alt={alt}
          className="size-full object-cover"
          onLoad={(e) => {
            setStyle((current) => ({
              ...current,
              flexGrow: e.currentTarget ? e.currentTarget.width / 1000 : "none",
            }))
          }}
          onClick={onClick}
        />
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
