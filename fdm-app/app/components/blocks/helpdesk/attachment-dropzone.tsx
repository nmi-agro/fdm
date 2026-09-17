import { Paperclip } from "lucide-react"
import { useEffect, useState } from "react"
import { Dropzone } from "~/components/custom/dropzone"
import { ALLOWED_IMAGE_MIME_TYPES } from "~/lib/upload-utils"
import { AttachmentGrid, AttachmentGridItem, formatFileSize } from "./attachment-grid"

export const maxAttachmentSize = 25 * 1024 * 1024

export function AttachmentDropzone({
  name,
  maxSize,
  maxFiles,
}: {
  name: string
  maxSize?: number
  maxFiles?: number
}) {
  const [files, setFiles] = useState<File[]>([])
  const [fileMetas, setFileMetas] = useState<AttachmentGridItem[]>([])

  // Create object URLs for each file, then build attachment items for each file.
  useEffect(() => {
    const fileMetas = files.map((file, idx) => {
      const objectUrl = ALLOWED_IMAGE_MIME_TYPES.includes(file.type)
        ? URL.createObjectURL(file)
        : undefined
      return {
        id: objectUrl ?? String(idx),
        object: file,
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file),
        size: file.size,
      }
    })

    setFileMetas(fileMetas)

    return () => {
      for (const fileMeta of fileMetas) {
        URL.revokeObjectURL(fileMeta.url)
      }
    }
  }, [files])

  const filesPhrase = maxFiles === 1 ? "een bestand" : "een of meerdere bestanden"

  return (
    <Dropzone
      name={name}
      maxSize={maxSize}
      maxFiles={maxFiles}
      multiple={true}
      required={false}
      value={files}
      className="relative h-auto min-h-30 w-full"
      onFilesChange={setFiles}
    >
      {files.length > 0 ? (
        <AttachmentGrid
          items={fileMetas}
          canDelete={true}
          onDelete={(object) => setFiles((current) => current.filter((file) => file !== object))}
        />
      ) : (
        <Paperclip className="text-muted-foreground mb-2 h-8 w-8" />
      )}
      <div className="text-muted-foreground mt-1 text-xs">
        {maxSize
          ? `Kies ${filesPhrase} tot ${formatFileSize(maxSize)}`
          : `Hier ${filesPhrase} toevoegen`}
      </div>
    </Dropzone>
  )
}
