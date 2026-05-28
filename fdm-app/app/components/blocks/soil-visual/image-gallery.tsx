import { useState } from "react"
import { Trash2, ZoomIn } from "lucide-react"
import type { VisualSoilImage } from "@nmi-agro/fdm-core"
import { visualImageTypeOptions } from "@nmi-agro/fdm-core"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import { SoilAnnotator } from "./soil-annotator"
import { ImageCapture } from "./image-capture"
import { cn } from "~/lib/utils"

interface ImageGalleryProps {
    images: VisualSoilImage[]
    /** Called when the user selects a new photo to upload */
    onUpload?: (file: File) => Promise<void>
    /** Called when the user deletes an image */
    onDelete?: (a_id_image: string) => Promise<void>
    /** Called when an annotation is added to an image */
    onAnnotationAdd?: (
        a_id_image: string,
        annotation: {
            type: string
            data_json: string
            text?: string
            indicator?: string
        },
    ) => Promise<void>
    readOnly?: boolean
    className?: string
    /** Whether an upload is currently in progress */
    uploading?: boolean
    b_id_farm: string
}

function getImageTypeLabel(type: string | null) {
    return (
        visualImageTypeOptions.find((o) => o.value === type)?.label ?? "Foto"
    )
}

/**
 * Photo gallery for a visual soil analysis.
 * Shows thumbnails with signed read URLs, supports upload, delete, and annotation.
 */
export function ImageGallery({
    images,
    onUpload,
    onDelete,
    onAnnotationAdd,
    readOnly = false,
    className,
    uploading = false,
}: ImageGalleryProps) {
    const [selectedImage, setSelectedImage] = useState<VisualSoilImage | null>(
        null,
    )
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleDelete = async (image: VisualSoilImage) => {
        if (!onDelete) return
        setDeletingId(image.a_id_image)
        try {
            await onDelete(image.a_id_image)
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className={cn("space-y-4", className)}>
            {/* Thumbnail grid */}
            {images.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {images.map((image) => (
                        <div
                            key={image.a_id_image}
                            className="group relative aspect-square rounded-md overflow-hidden border bg-muted"
                        >
                            <img
                                src={image.gcs_object_key}
                                alt={image.caption ?? getImageTypeLabel(image.image_type)}
                                className="h-full w-full object-cover"
                            />
                            {/* Image type badge */}
                            {image.image_type && (
                                <Badge
                                    variant="secondary"
                                    className="absolute bottom-1 left-1 text-xs"
                                >
                                    {getImageTypeLabel(image.image_type)}
                                </Badge>
                            )}
                            {/* Annotation count badge */}
                            {image.annotations.length > 0 && (
                                <Badge
                                    variant="outline"
                                    className="absolute top-1 right-1 text-xs bg-background/80"
                                >
                                    {image.annotations.length}
                                </Badge>
                            )}
                            {/* Hover actions */}
                            <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="secondary"
                                    className="h-8 w-8"
                                    onClick={() => setSelectedImage(image)}
                                    title="Openen en annoteren"
                                >
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                                {!readOnly && onDelete && (
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="destructive"
                                        className="h-8 w-8"
                                        onClick={() => handleDelete(image)}
                                        disabled={deletingId === image.a_id_image}
                                        title="Verwijderen"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                    Nog geen foto's toegevoegd.
                </p>
            )}

            {/* Upload section */}
            {!readOnly && onUpload && (
                <ImageCapture onCapture={onUpload} disabled={uploading} />
            )}

            {uploading && (
                <p className="text-xs text-muted-foreground text-center animate-pulse">
                    Foto wordt geüpload en gecomprimeerd...
                </p>
            )}

            {/* Full-screen annotator dialog */}
            {selectedImage && (
                <Dialog
                    open
                    onOpenChange={(open) => !open && setSelectedImage(null)}
                >
                    <DialogContent className="max-w-3xl w-full">
                        <DialogHeader>
                            <DialogTitle>
                                {selectedImage.caption ??
                                    getImageTypeLabel(selectedImage.image_type)}
                            </DialogTitle>
                        </DialogHeader>
                        <SoilAnnotator
                            imageUrl={selectedImage.gcs_object_key}
                            annotations={selectedImage.annotations}
                            readOnly={readOnly}
                            onAnnotationAdd={
                                onAnnotationAdd
                                    ? (ann) =>
                                          onAnnotationAdd(
                                              selectedImage.a_id_image,
                                              ann,
                                          )
                                    : undefined
                            }
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}
