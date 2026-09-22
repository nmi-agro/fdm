import { Paperclip } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Dropzone, DropzoneProps } from "~/components/custom/dropzone"
import { cn } from "~/lib/utils"
import { AttachmentGrid, AttachmentGridItem, formatFileSize } from "./attachment-grid"

export function AttachmentDropzone({
  value,
  onFilesChange,
  maxSize,
  maxFiles,
  ...props
}: DropzoneProps & { onFilesChange: Exclude<DropzoneProps["onFilesChange"], undefined> }) {
  const [fileMetas, setFileMetas] = useState<AttachmentGridItem[]>([])

  const objectUrls = useRef<Map<File, string>>(new Map())

  // Create object URLs for each file, then build attachment items for each file.
  useEffect(() => {
    const files = value ?? []
    const filesSet = new Set(files ?? [])

    for (const oldFile of [...objectUrls.current.keys()]) {
      if (!filesSet.has(oldFile)) {
        URL.revokeObjectURL(objectUrls.current.get(oldFile) as string)
        objectUrls.current.delete(oldFile)
      }
    }

    for (const newFile of filesSet) {
      if (!objectUrls.current.has(newFile)) {
        objectUrls.current.set(newFile, URL.createObjectURL(newFile))
      }
    }

    const fileMetas = (files ?? []).map((file) => {
      return {
        attachment_id: objectUrls.current.get(file) as string,
        object: file,
        file_name: file.name,
        mime_type: file.type,
        file_path: objectUrls.current.get(file) as string,
        file_size: file.size,
      }
    })

    setFileMetas(fileMetas)
  }, [value])

  // Revoke any leftover object URLs on unmount.
  useEffect(() => {
    const urls = objectUrls.current
    return () => {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url)
      }
      urls.clear()
    }
  }, [])

  const filesPhrase =
    maxFiles === 1
      ? "een bestand"
      : typeof maxFiles === "number"
        ? `maximaal ${maxFiles} bestanden`
        : "een of meerdere bestanden"

  return (
    <Dropzone
      maxSize={maxSize}
      maxFiles={maxFiles}
      multiple={true}
      required={false}
      value={value}
      onFilesChange={onFilesChange}
      {...props}
      className={cn("relative h-auto min-h-30 w-full space-y-4", props.className)}
    >
      {fileMetas.length > 0 ? (
        <AttachmentGrid
          className="self-stretch"
          items={fileMetas}
          canDelete={true}
          onDelete={(object) => onFilesChange((value ?? []).filter((file) => file !== object))}
        />
      ) : (
        <Paperclip className="text-muted-foreground h-8 w-8" />
      )}
      <div className="text-muted-foreground mt-1 text-xs">
        {maxSize
          ? `Kies ${filesPhrase} tot ${formatFileSize(maxSize)}`
          : `Hier ${filesPhrase} toevoegen`}
      </div>
    </Dropzone>
  )
}
