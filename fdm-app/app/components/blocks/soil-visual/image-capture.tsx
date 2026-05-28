import { Camera, Upload, X } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

interface ImageCaptureProps {
    onCapture: (file: File) => void
    disabled?: boolean
    className?: string
}

/**
 * Mobile-first image capture component.
 * - On mobile: opens the rear camera directly
 * - On desktop: shows a drag-and-drop zone with file browse
 */
export function ImageCapture({
    onCapture,
    disabled = false,
    className,
}: ImageCaptureProps) {
    const cameraInputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isDragging, setIsDragging] = useState(false)

    const handleFiles = useCallback(
        (files: FileList | null) => {
            if (!files || files.length === 0) return
            const file = files[0]
            if (!file.type.startsWith("image/")) return
            onCapture(file)
        },
        [onCapture],
    )

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            setIsDragging(false)
            handleFiles(e.dataTransfer.files)
        },
        [handleFiles],
    )

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback(() => {
        setIsDragging(false)
    }, [])

    return (
        <div className={cn("space-y-2", className)}>
            {/* Mobile camera button — opens rear camera directly */}
            <Button
                type="button"
                variant="outline"
                className="w-full sm:hidden"
                disabled={disabled}
                onClick={() => cameraInputRef.current?.click()}
            >
                <Camera className="mr-2 h-4 w-4" />
                Foto maken
            </Button>
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
            />

            {/* Desktop drag-and-drop zone */}
            <div
                className={cn(
                    "hidden sm:flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
                    isDragging
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-muted-foreground/50",
                    disabled && "opacity-50 pointer-events-none",
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                    Sleep een foto hierheen of{" "}
                    <button
                        type="button"
                        className="text-primary underline-offset-4 hover:underline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled}
                    >
                        blader
                    </button>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG, WEBP of HEIC — max. 10 MB
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                />
            </div>

            {/* Mobile file browse fallback */}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full sm:hidden text-muted-foreground"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload className="mr-2 h-3 w-3" />
                Bestand kiezen
            </Button>
        </div>
    )
}
