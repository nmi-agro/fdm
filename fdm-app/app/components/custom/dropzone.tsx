"use client"

import { X } from "lucide-react"
import type { InputHTMLAttributes, ReactNode } from "react"
import { createContext, useContext, useEffect, useId, useRef } from "react"
import { toast as notify } from "sonner"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

type DropzoneContextType = {
    files?: File[]
    accept?: string[]
    maxSize?: number | undefined
    minSize?: number | undefined
    multiple?: boolean
}

const DropzoneContext = createContext<DropzoneContextType | undefined>(
    undefined,
)

const getFileExtension = (filename: string): string => {
    const dotIndex = filename.lastIndexOf(".")
    return dotIndex === -1 ? "" : filename.slice(dotIndex).toLowerCase()
}

export type DropzoneProps = {
    ref?: React.Ref<HTMLInputElement>
    value?: File[]
    accept?: string | string[]
    name: string
    className?: string
    allowReset?: boolean
    minSize?: number
    maxSize?: number
    multiple?: boolean
    required?: boolean
    disabled?: boolean
    readonly?: boolean
    error?: string | undefined
    onBlur?: InputHTMLAttributes<HTMLInputElement>["onBlur"]
    onFilesChange?: (files: File[]) => void
    mergeFiles?: (
        oldFiles: File[],
        newFiles: File[],
    ) => Promise<File[] | null> | File[] | null
    children?: ReactNode
}

export const Dropzone = ({
    name,
    accept,
    maxSize,
    minSize,
    multiple,
    required,
    disabled,
    className,
    children,
    allowReset = true,
    value,
    ref,
    onBlur,
    onFilesChange,
    mergeFiles,
}: DropzoneProps) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const files =
        value ??
        (inputRef.current?.files ? Array.from(inputRef.current.files) : [])
    const labelId = useId()
    const normalizeAcceptToken = (token: string) => token.trim().toLowerCase()
    const acceptedFileExtensions =
        typeof accept === "string"
            ? accept.split(",").map(normalizeAcceptToken)
            : accept?.map(normalizeAcceptToken)

    const fileNames = files.map((f) => f.name)
    const myMergeFiles =
        mergeFiles ??
        (multiple
            ? (oldFiles, newFiles) => {
                  const fileMap = new Map<string, File>()
                  for (const f of oldFiles) fileMap.set(f.name, f)
                  for (const f of newFiles) fileMap.set(f.name, f)
                  return Array.from(fileMap.values())
              }
            : (_, newFiles) => newFiles.slice(0, 1))

    useEffect(() => {
        if (files.length === 0 && inputRef.current) {
            inputRef.current.value = ""
        }
    }, [files])

    const handleFilesSet = async (oldFiles: File[], newFiles: File[]) => {
        const finalFiles = await myMergeFiles(oldFiles, newFiles)
        if (finalFiles && onFilesChange) {
            onFilesChange(finalFiles)
        }
        return finalFiles ?? files
    }

    const handleFilesClear = async () => {
        if (onFilesChange) onFilesChange([])
        else if (inputRef.current) inputRef.current.value = ""
    }

    const syncFilesToInput = (filesToSync: File[]) => {
        if (!inputRef.current) return
        try {
            const container = new DataTransfer()
            for (const f of filesToSync) {
                if (f instanceof File) {
                    container.items.add(f)
                }
            }
            inputRef.current.files = container.files
        } catch (err) {
            // Fallback or silent ignore if DataTransfer is restricted
            console.warn("Could not sync files to hidden input:", err)
        }
    }

    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault()
    }

    const checkNewFile = (file: File) => {
        const extension = getFileExtension(file.name)
        const fileExtensionCheck =
            !acceptedFileExtensions ||
            acceptedFileExtensions.includes(extension)
        const minSizeCheck = !minSize || file.size >= minSize
        const maxSizeCheck = !maxSize || file.size <= maxSize

        if (!fileExtensionCheck) {
            notify.warning(`Bestandstype niet ondersteund: ${extension}`, {
                id: `invalid-file-type-${file.name}`,
            })
        }
        if (!maxSizeCheck) {
            notify.warning(
                "Een of meerdere bestanden zijn ongeldig of te groot.",
                {
                    id: "file-too-big",
                },
            )
        }
        if (!minSizeCheck) {
            notify.warning(
                "Een of meerdere bestanden zijn ongeldig of te klein.",
                {
                    id: "file-too-small",
                },
            )
        }

        return fileExtensionCheck && minSizeCheck && maxSizeCheck
    }

    const handleFileChange = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        if (event.target.files) {
            const newFiles = Array.from(event.target.files)
            const validNewFiles = newFiles.filter(checkNewFile)

            // In order to reset the input to the previous state if the files are invalid
            let inputFiles = files
            if (validNewFiles.length > 0) {
                inputFiles = await handleFilesSet(files, validNewFiles)
            }

            syncFilesToInput(inputFiles)
        }
    }

    const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault()
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const newFiles = Array.from(e.dataTransfer.files)
            const validNewFiles = newFiles.filter(checkNewFile)

            if (validNewFiles.length === 0) return

            const finalFiles = await handleFilesSet(files, validNewFiles)

            syncFilesToInput(finalFiles)

            try {
                e.dataTransfer.clearData()
            } catch (err) {
                // clearData may throw in some browsers after drop
                console.warn("Could not clear dataTransfer:", err)
            }
        }
    }

    return (
        <DropzoneContext.Provider
            key={JSON.stringify(fileNames)}
            value={{
                files,
                accept: acceptedFileExtensions,
                maxSize,
                minSize,
                multiple,
            }}
        >
            <div className="relative">
                <input
                    id={labelId}
                    type="file"
                    name={name}
                    onBlur={onBlur}
                    onChange={(event) => {
                        handleFileChange(event)
                    }}
                    ref={(node) => {
                        inputRef.current = node
                        ref?.(node)
                    }}
                    placeholder=""
                    className="hidden"
                    accept={
                        typeof accept === "string" ? accept : accept?.join(",")
                    }
                    multiple={multiple}
                    required={required}
                    disabled={disabled}
                />
                <label
                    className={cn(
                        "flex-col items-center justify-center w-full h-32 rounded-md border border-dashed border-muted-foreground/25 px-6 py-4 text-center transition-colors hover:bg-muted/25",
                        disabled ? "hidden" : "flex",
                        className,
                    )}
                    ref={ref}
                    htmlFor={labelId}
                    aria-label="Upload shapefile files by clicking or dragging and dropping"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            inputRef.current?.click()
                        }
                    }}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    {children}
                </label>
                {fileNames.length > 0 && allowReset && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => handleFilesClear()}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </DropzoneContext.Provider>
    )
}

export const useDropzoneContext = () => {
    const context = useContext(DropzoneContext)

    if (!context) {
        throw new Error("useDropzoneContext must be used within a Dropzone")
    }

    return context
}
