import { Circle, MapPin, Pencil, Trash2 } from "lucide-react"
import {
    useCallback,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
    type PointerEvent,
} from "react"
import {
    BCS_FIELD_INDICATORS,
    BCS_VISUAL_INDICATOR_MAP,
    type AnnotationCoords,
    type AnnotationType,
    type ArrowCoords,
    type BcsVisualKey,
    type CircleCoords,
    type FreehandCoords,
    type PinCoords,
} from "~/lib/bcs"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

interface GalleryAnnotation {
    type: AnnotationType
    coordinates: AnnotationCoords
    text?: string
    bcsIndicator?: string
}

interface GalleryImage {
    id: string
    url: string
    caption?: string
    annotations: GalleryAnnotation[]
}

interface ImageGalleryProps {
    images: GalleryImage[]
    onAddAnnotation?: (
        imageId: string,
        type: AnnotationType,
        coords: AnnotationCoords,
        text: string,
        bcsIndicator?: string,
    ) => void
    onRemoveAnnotation?: (imageId: string, annotationIndex: number) => void
    editMode?: boolean
    defaultIndicator?: BcsVisualKey
}

interface PendingAnnotation {
    imageId: string
    type: AnnotationType
    coords: AnnotationCoords
}

interface DeleteTarget {
    imageId: string
    annotationIndex: number
}

function isPinCoords(coords: AnnotationCoords): coords is PinCoords {
    return "x" in coords && "y" in coords && !("points" in coords)
}

function isCircleCoords(coords: AnnotationCoords): coords is CircleCoords {
    return "cx" in coords
}

function isArrowCoords(coords: AnnotationCoords): coords is ArrowCoords {
    return "x1" in coords
}

function isFreehandCoords(coords: AnnotationCoords): coords is FreehandCoords {
    return "points" in coords
}

function getAnnotationTypeLabel(type: AnnotationType): string {
    switch (type) {
        case "pin":
            return "Pin"
        case "circle":
            return "Cirkel"
        case "arrow":
            return "Pijl"
        case "freehand":
            return "Tekening"
    }
}

function getRelativeCoords(
    event: MouseEvent<HTMLDivElement> | { clientX: number; clientY: number },
    rect: DOMRect,
) {
    const x = Math.max(
        0,
        Math.min(100, ((event.clientX - rect.left) / rect.width) * 100),
    )
    const y = Math.max(
        0,
        Math.min(100, ((event.clientY - rect.top) / rect.height) * 100),
    )
    return { x, y }
}

function getAnnotationCentroid(
    annotation: GalleryAnnotation,
): { x: number; y: number } | null {
    const c = annotation.coordinates
    if (annotation.type === "pin" && isPinCoords(c)) return { x: c.x, y: c.y }
    if (annotation.type === "circle" && isCircleCoords(c))
        return { x: c.cx, y: c.cy }
    if (annotation.type === "arrow" && isArrowCoords(c))
        return { x: (c.x1 + c.x2) / 2, y: (c.y1 + c.y2) / 2 }
    if (
        annotation.type === "freehand" &&
        isFreehandCoords(c) &&
        c.points.length > 0
    ) {
        const xs = c.points.map((p) => p.x)
        const ys = c.points.map((p) => p.y)
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2,
        }
    }
    return null
}

interface AnnotationOverlayProps {
    annotations: GalleryAnnotation[]
    hoveredIndex: number | null
    onHoverAnnotation: (index: number | null) => void
}

function AnnotationOverlay({
    annotations,
    hoveredIndex,
    onHoverAnnotation,
}: AnnotationOverlayProps) {
    return (
        <>
            {annotations.map((annotation, index) => {
                const centroid = getAnnotationCentroid(annotation)
                if (!centroid) return null
                const indicatorLabel = annotation.bcsIndicator
                    ? BCS_VISUAL_INDICATOR_MAP[
                          annotation.bcsIndicator as BcsVisualKey
                      ]?.name
                    : null
                const isHovered = hoveredIndex === index
                return (
                    <div
                        key={index}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={{
                            left: `${centroid.x}%`,
                            top: `${centroid.y}%`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className={cn(
                                        "flex size-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold shadow transition-colors",
                                        isHovered
                                            ? "bg-yellow-400 text-yellow-900"
                                            : "bg-primary text-primary-foreground",
                                    )}
                                    onMouseEnter={() =>
                                        onHoverAnnotation(index)
                                    }
                                    onMouseLeave={() => onHoverAnnotation(null)}
                                >
                                    {index + 1}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-left">
                                <div className="space-y-1">
                                    {indicatorLabel ? (
                                        <div className="font-semibold">
                                            {indicatorLabel}
                                        </div>
                                    ) : null}
                                    <div>
                                        {annotation.text ||
                                            "Notitie zonder tekst"}
                                    </div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                )
            })}
        </>
    )
}

export function ImageGallery({
    images,
    onAddAnnotation,
    onRemoveAnnotation,
    editMode = false,
    defaultIndicator,
}: ImageGalleryProps) {
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
    const [activeTool, setActiveTool] = useState<AnnotationType>("pin")
    const [pendingAnnotation, setPendingAnnotation] =
        useState<PendingAnnotation | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
    const [annotationText, setAnnotationText] = useState("")
    const [annotationTitle, setAnnotationTitle] = useState("")
    const [annotationIndicator, setAnnotationIndicator] = useState<string>(
        defaultIndicator ?? "none",
    )
    const [hoveredAnnotationIndex, setHoveredAnnotationIndex] = useState<
        number | null
    >(null)
    const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(
        null,
    )
    // Drawing state
    const [drawingState, setDrawingState] = useState<null | {
        tool: AnnotationType
        start: { x: number; y: number }
        current?: { x: number; y: number }
        points?: Array<{ x: number; y: number }>
        arrowPhase?: "first" // waiting for second click
    }>(null)
    const imageContainerRef = useRef<HTMLDivElement>(null)

    const selectedImage = useMemo(
        () => images.find((img) => img.id === selectedImageId) ?? null,
        [images, selectedImageId],
    )

    const resetAnnotationDialog = useCallback(() => {
        setPendingAnnotation(null)
        setAnnotationText("")
        setAnnotationTitle("")
        setAnnotationIndicator(defaultIndicator ?? "none")
    }, [defaultIndicator])

    const openAnnotationDialog = useCallback(
        (pa: PendingAnnotation) => {
            setPendingAnnotation(pa)
            setAnnotationIndicator(defaultIndicator ?? "none")
        },
        [defaultIndicator],
    )

    const handleSaveAnnotation = () => {
        if (!pendingAnnotation || !onAddAnnotation) return
        const text = [annotationTitle.trim(), annotationText.trim()]
            .filter(Boolean)
            .join(annotationTitle.trim() && annotationText.trim() ? ": " : "")
        onAddAnnotation(
            pendingAnnotation.imageId,
            pendingAnnotation.type,
            pendingAnnotation.coords,
            text,
            annotationIndicator === "none" ? undefined : annotationIndicator,
        )
        resetAnnotationDialog()
    }

    const getContainerRect = () =>
        imageContainerRef.current?.getBoundingClientRect()

    // Pointer events for drawing
    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (!editMode || !onAddAnnotation || !selectedImage) return
        const rect = getContainerRect()
        if (!rect) return
        const { x, y } = getRelativeCoords(event.nativeEvent, rect)

        if (activeTool === "pin") {
            // Pin: show dialog immediately on click
            return
        }

        if (activeTool === "circle") {
            event.currentTarget.setPointerCapture(event.pointerId)
            setDrawingState({
                tool: "circle",
                start: { x, y },
                current: { x, y },
            })
            return
        }

        if (activeTool === "arrow") {
            if (!drawingState) {
                setDrawingState({
                    tool: "arrow",
                    start: { x, y },
                    arrowPhase: "first",
                })
            } else if (
                drawingState.tool === "arrow" &&
                drawingState.arrowPhase === "first"
            ) {
                const coords: ArrowCoords = {
                    x1: drawingState.start.x,
                    y1: drawingState.start.y,
                    x2: x,
                    y2: y,
                }
                setDrawingState(null)
                openAnnotationDialog({
                    imageId: selectedImage.id,
                    type: "arrow",
                    coords,
                })
            }
            return
        }

        if (activeTool === "freehand") {
            event.currentTarget.setPointerCapture(event.pointerId)
            setDrawingState({
                tool: "freehand",
                start: { x, y },
                points: [{ x, y }],
            })
        }
    }

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!drawingState || !editMode) return
        const rect = getContainerRect()
        if (!rect) return
        const { x, y } = getRelativeCoords(event.nativeEvent, rect)

        if (drawingState.tool === "circle") {
            setDrawingState((prev) =>
                prev ? { ...prev, current: { x, y } } : prev,
            )
        } else if (drawingState.tool === "freehand") {
            setDrawingState((prev) =>
                prev
                    ? { ...prev, points: [...(prev.points ?? []), { x, y }] }
                    : prev,
            )
        }
    }

    const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
        if (!drawingState || !selectedImage || !editMode) return
        const rect = getContainerRect()
        if (!rect) return
        const { x, y } = getRelativeCoords(event.nativeEvent, rect)

        if (drawingState.tool === "circle") {
            const dx = x - drawingState.start.x
            const dy = y - drawingState.start.y
            const r = Math.sqrt(dx * dx + dy * dy)
            if (r < 1) {
                setDrawingState(null)
                return
            }
            const coords: CircleCoords = {
                cx: drawingState.start.x,
                cy: drawingState.start.y,
                r,
            }
            setDrawingState(null)
            openAnnotationDialog({
                imageId: selectedImage.id,
                type: "circle",
                coords,
            })
        } else if (drawingState.tool === "freehand") {
            const points = drawingState.points ?? []
            if (points.length < 3) {
                setDrawingState(null)
                return
            }
            const coords: FreehandCoords = { points }
            setDrawingState(null)
            openAnnotationDialog({
                imageId: selectedImage.id,
                type: "freehand",
                coords,
            })
        }
    }

    const handleImageClick = (event: MouseEvent<HTMLDivElement>) => {
        if (!editMode || !onAddAnnotation || !selectedImage) return
        // Only handle pin clicks and arrow second-click here (others handled by pointer events)
        if (activeTool !== "pin" && activeTool !== "arrow") return
        if (drawingState?.tool === "arrow") return // arrow second click handled in pointerDown

        if (activeTool === "pin") {
            const rect = getContainerRect()
            if (!rect) return
            const { x, y } = getRelativeCoords(event, rect)
            const coords: PinCoords = { x, y }
            openAnnotationDialog({
                imageId: selectedImage.id,
                type: "pin",
                coords,
            })
        }
    }

    const handleDeleteAnnotationClick = (
        imageId: string,
        annotationIndex: number,
    ) => {
        setDeleteTarget({ imageId, annotationIndex })
    }

    const confirmDeleteAnnotation = () => {
        if (!deleteTarget || !onRemoveAnnotation) return
        onRemoveAnnotation(deleteTarget.imageId, deleteTarget.annotationIndex)
        setDeleteTarget(null)
        setHoveredAnnotationIndex(null)
    }

    // Compute live drawing preview element
    const drawingPreview = useMemo(() => {
        if (!drawingState) return null
        if (drawingState.tool === "circle" && drawingState.current) {
            const dx = drawingState.current.x - drawingState.start.x
            const dy = drawingState.current.y - drawingState.start.y
            const r = Math.sqrt(dx * dx + dy * dy)
            return (
                <circle
                    cx={drawingState.start.x}
                    cy={drawingState.start.y}
                    r={r}
                    fill="rgba(255,255,255,0.15)"
                    stroke="white"
                    strokeWidth="0.5"
                    strokeDasharray="2 1"
                    vectorEffect="non-scaling-stroke"
                />
            )
        }
        if (
            drawingState.tool === "arrow" &&
            drawingState.arrowPhase === "first"
        ) {
            return (
                <circle
                    cx={drawingState.start.x}
                    cy={drawingState.start.y}
                    r={1.5}
                    fill="white"
                    vectorEffect="non-scaling-stroke"
                />
            )
        }
        if (
            drawingState.tool === "freehand" &&
            drawingState.points &&
            drawingState.points.length > 1
        ) {
            const pts = drawingState.points
                .map((p) => `${p.x},${p.y}`)
                .join(" ")
            return (
                <polyline
                    points={pts}
                    fill="none"
                    stroke="white"
                    strokeWidth="0.5"
                    strokeDasharray="2 1"
                    vectorEffect="non-scaling-stroke"
                />
            )
        }
        return null
    }, [drawingState])

    const getCursorClass = () => {
        if (!editMode || !onAddAnnotation) return "cursor-default"
        if (activeTool === "arrow" && drawingState?.tool === "arrow")
            return "cursor-crosshair"
        return "cursor-crosshair"
    }

    if (images.length === 0) {
        return (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nog geen foto&apos;s toegevoegd.
            </div>
        )
    }

    return (
        <TooltipProvider>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {images.map((image) => (
                    <button
                        key={image.id}
                        type="button"
                        className="group overflow-hidden rounded-xl border bg-card text-left"
                        onClick={() => setSelectedImageId(image.id)}
                    >
                        <div className="relative aspect-square overflow-hidden bg-muted">
                            <img
                                src={image.url}
                                alt={image.caption ?? "BCS foto"}
                                className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                            />
                            {image.annotations.length > 0 ? (
                                <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">
                                    {image.annotations.length}
                                </div>
                            ) : null}
                        </div>
                        <div className="p-3 text-sm">
                            <div className="line-clamp-2 font-medium">
                                {image.caption || "Foto zonder bijschrift"}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Lightbox */}
            <Dialog
                open={Boolean(selectedImage)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedImageId(null)
                        setDrawingState(null)
                        setHoveredAnnotationIndex(null)
                        setImgSize(null)
                        resetAnnotationDialog()
                    }
                }}
            >
                <DialogContent className="max-h-[95dvh] w-full max-w-5xl overflow-y-auto p-4 sm:p-6">
                    {selectedImage ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {selectedImage.caption || "BCS foto"}
                                </DialogTitle>
                            </DialogHeader>

                            {/* Desktop: image left, annotation list right */}
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                                <div className="flex flex-1 flex-col gap-3">
                                    {/* Tool selector */}
                                    {editMode && onAddAnnotation ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                Gereedschap:
                                            </span>
                                            {(
                                                [
                                                    {
                                                        type: "pin" as const,
                                                        Icon: MapPin,
                                                        label: "Pin",
                                                    },
                                                    {
                                                        type: "circle" as const,
                                                        Icon: Circle,
                                                        label: "Cirkel",
                                                    },
                                                    {
                                                        type: "freehand" as const,
                                                        Icon: Pencil,
                                                        label: "Tekening",
                                                    },
                                                ] as const
                                            ).map(({ type, Icon, label }) => (
                                                <Tooltip key={type}>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant={
                                                                activeTool ===
                                                                type
                                                                    ? "default"
                                                                    : "outline"
                                                            }
                                                            size="icon"
                                                            className="size-8"
                                                            onClick={() => {
                                                                setActiveTool(
                                                                    type,
                                                                )
                                                                setDrawingState(
                                                                    null,
                                                                )
                                                            }}
                                                        >
                                                            <Icon className="size-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {label}
                                                    </TooltipContent>
                                                </Tooltip>
                                            ))}
                                            {drawingState?.tool === "arrow" &&
                                            drawingState.arrowPhase ===
                                                "first" ? (
                                                <span className="text-xs text-muted-foreground">
                                                    Klik op het eindpunt van de
                                                    pijl
                                                </span>
                                            ) : activeTool === "freehand" ? (
                                                <span className="text-xs text-muted-foreground">
                                                    Houd ingedrukt en sleep om
                                                    te tekenen
                                                </span>
                                            ) : activeTool === "circle" ? (
                                                <span className="text-xs text-muted-foreground">
                                                    Sleep om een cirkel te
                                                    tekenen
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    Klik op de afbeelding om een
                                                    pin te plaatsen
                                                </span>
                                            )}
                                        </div>
                                    ) : null}

                                    {/* Image with annotation overlays */}
                                    <div className="overflow-auto rounded-xl border bg-black/5 p-2">
                                        <div
                                            ref={imageContainerRef}
                                            className={cn(
                                                "relative mx-auto w-fit max-w-full select-none",
                                                getCursorClass(),
                                            )}
                                            onClick={handleImageClick}
                                            onPointerDown={handlePointerDown}
                                            onPointerMove={handlePointerMove}
                                            onPointerUp={handlePointerUp}
                                        >
                                            <img
                                                src={selectedImage.url}
                                                alt={
                                                    selectedImage.caption ??
                                                    "BCS foto"
                                                }
                                                className="max-h-[55vh] max-w-full rounded-lg object-contain lg:max-h-[65vh]"
                                                draggable={false}
                                                onLoad={(e) => {
                                                    const el = e.currentTarget
                                                    setImgSize({
                                                        w: el.clientWidth,
                                                        h: el.clientHeight,
                                                    })
                                                }}
                                            />
                                            {/* SVG overlay for shapes */}
                                            <svg
                                                className="pointer-events-none absolute inset-0 h-full w-full"
                                                viewBox="0 0 100 100"
                                                preserveAspectRatio="none"
                                            >
                                                {selectedImage.annotations.map(
                                                    (annotation, index) => {
                                                        const c =
                                                            annotation.coordinates
                                                        const isHovered =
                                                            hoveredAnnotationIndex ===
                                                            index
                                                        const color = isHovered
                                                            ? "#facc15"
                                                            : "white"
                                                        const shapeFilter = {
                                                            filter: "drop-shadow(0 0 2px rgba(0,0,0,0.8))",
                                                        }
                                                        const strokeWidth =
                                                            isHovered
                                                                ? "1"
                                                                : "0.5"

                                                        if (
                                                            annotation.type ===
                                                                "circle" &&
                                                            isCircleCoords(c)
                                                        ) {
                                                            return (
                                                                <circle
                                                                    key={index}
                                                                    cx={c.cx}
                                                                    cy={c.cy}
                                                                    r={c.r}
                                                                    fill="none"
                                                                    stroke={
                                                                        color
                                                                    }
                                                                    strokeWidth={
                                                                        strokeWidth
                                                                    }
                                                                    vectorEffect="non-scaling-stroke"
                                                                    style={
                                                                        shapeFilter
                                                                    }
                                                                />
                                                            )
                                                        }
                                                        if (
                                                            annotation.type ===
                                                                "arrow" &&
                                                            isArrowCoords(c)
                                                        ) {
                                                            // Compute arrowhead in screen-space to avoid distortion with preserveAspectRatio="none"
                                                            let headPoints:
                                                                | string
                                                                | null = null
                                                            if (
                                                                imgSize &&
                                                                imgSize.w > 0 &&
                                                                imgSize.h > 0
                                                            ) {
                                                                const sdx =
                                                                    ((c.x2 -
                                                                        c.x1) *
                                                                        imgSize.w) /
                                                                    100
                                                                const sdy =
                                                                    ((c.y2 -
                                                                        c.y1) *
                                                                        imgSize.h) /
                                                                    100
                                                                const slen =
                                                                    Math.sqrt(
                                                                        sdx *
                                                                            sdx +
                                                                            sdy *
                                                                                sdy,
                                                                    )
                                                                if (slen > 3) {
                                                                    const sux =
                                                                            sdx /
                                                                            slen,
                                                                        suy =
                                                                            sdy /
                                                                            slen
                                                                    const arrowPx =
                                                                        Math.min(
                                                                            slen *
                                                                                0.35,
                                                                            14,
                                                                        )
                                                                    const wingPx =
                                                                        arrowPx *
                                                                        0.45
                                                                    const spx =
                                                                            -suy,
                                                                        spy =
                                                                            sux
                                                                    const sbsx =
                                                                        (c.x2 *
                                                                            imgSize.w) /
                                                                            100 -
                                                                        sux *
                                                                            arrowPx
                                                                    const sbsy =
                                                                        (c.y2 *
                                                                            imgSize.h) /
                                                                            100 -
                                                                        suy *
                                                                            arrowPx
                                                                    const sw1x =
                                                                            sbsx +
                                                                            spx *
                                                                                wingPx,
                                                                        sw1y =
                                                                            sbsy +
                                                                            spy *
                                                                                wingPx
                                                                    const sw2x =
                                                                            sbsx -
                                                                            spx *
                                                                                wingPx,
                                                                        sw2y =
                                                                            sbsy -
                                                                            spy *
                                                                                wingPx
                                                                    const toX =
                                                                        (
                                                                            sx: number,
                                                                        ) =>
                                                                            (sx *
                                                                                100) /
                                                                            imgSize.w
                                                                    const toY =
                                                                        (
                                                                            sy: number,
                                                                        ) =>
                                                                            (sy *
                                                                                100) /
                                                                            imgSize.h
                                                                    headPoints = `${c.x2},${c.y2} ${toX(sw1x)},${toY(sw1y)} ${toX(sw2x)},${toY(sw2y)}`
                                                                }
                                                            }
                                                            return (
                                                                <g key={index}>
                                                                    <line
                                                                        x1={
                                                                            c.x1
                                                                        }
                                                                        y1={
                                                                            c.y1
                                                                        }
                                                                        x2={
                                                                            c.x2
                                                                        }
                                                                        y2={
                                                                            c.y2
                                                                        }
                                                                        stroke={
                                                                            color
                                                                        }
                                                                        strokeWidth={
                                                                            strokeWidth
                                                                        }
                                                                        vectorEffect="non-scaling-stroke"
                                                                        style={
                                                                            shapeFilter
                                                                        }
                                                                    />
                                                                    {headPoints ? (
                                                                        <polygon
                                                                            points={
                                                                                headPoints
                                                                            }
                                                                            fill={
                                                                                color
                                                                            }
                                                                            style={
                                                                                shapeFilter
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        <circle
                                                                            cx={
                                                                                c.x2
                                                                            }
                                                                            cy={
                                                                                c.y2
                                                                            }
                                                                            r={
                                                                                1.5
                                                                            }
                                                                            fill={
                                                                                color
                                                                            }
                                                                        />
                                                                    )}
                                                                </g>
                                                            )
                                                        }
                                                        if (
                                                            annotation.type ===
                                                                "freehand" &&
                                                            isFreehandCoords(c)
                                                        ) {
                                                            return (
                                                                <polyline
                                                                    key={index}
                                                                    points={c.points
                                                                        .map(
                                                                            (
                                                                                p,
                                                                            ) =>
                                                                                `${p.x},${p.y}`,
                                                                        )
                                                                        .join(
                                                                            " ",
                                                                        )}
                                                                    fill="none"
                                                                    stroke={
                                                                        color
                                                                    }
                                                                    strokeWidth={
                                                                        strokeWidth
                                                                    }
                                                                    vectorEffect="non-scaling-stroke"
                                                                    style={
                                                                        shapeFilter
                                                                    }
                                                                />
                                                            )
                                                        }
                                                        return null
                                                    },
                                                )}
                                                {drawingPreview}
                                            </svg>
                                            {/* Annotation number badges */}
                                            <AnnotationOverlay
                                                annotations={
                                                    selectedImage.annotations
                                                }
                                                hoveredIndex={
                                                    hoveredAnnotationIndex
                                                }
                                                onHoverAnnotation={
                                                    setHoveredAnnotationIndex
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Annotation list sidebar (desktop) / below (mobile) */}
                                {selectedImage.annotations.length > 0 ? (
                                    <div className="lg:w-56 lg:flex-shrink-0 xl:w-64">
                                        <div className="rounded-xl border p-3">
                                            <div className="mb-2 text-sm font-medium">
                                                notities (
                                                {
                                                    selectedImage.annotations
                                                        .length
                                                }
                                                )
                                            </div>
                                            <ol className="space-y-1 text-sm text-muted-foreground">
                                                {selectedImage.annotations.map(
                                                    (annotation, index) => {
                                                        const indicatorLabel =
                                                            annotation.bcsIndicator
                                                                ? BCS_VISUAL_INDICATOR_MAP[
                                                                      annotation.bcsIndicator as BcsVisualKey
                                                                  ]?.name
                                                                : null
                                                        const isHovered =
                                                            hoveredAnnotationIndex ===
                                                            index
                                                        return (
                                                            <li
                                                                key={index}
                                                                className={cn(
                                                                    "flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors",
                                                                    isHovered &&
                                                                        "bg-yellow-50 dark:bg-yellow-950/20",
                                                                )}
                                                                onMouseEnter={() =>
                                                                    setHoveredAnnotationIndex(
                                                                        index,
                                                                    )
                                                                }
                                                                onMouseLeave={() =>
                                                                    setHoveredAnnotationIndex(
                                                                        null,
                                                                    )
                                                                }
                                                            >
                                                                <span
                                                                    className={cn(
                                                                        "mt-0.5 flex size-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                                                                        isHovered
                                                                            ? "bg-yellow-400 text-yellow-900"
                                                                            : "bg-primary text-primary-foreground",
                                                                    )}
                                                                >
                                                                    {index + 1}
                                                                </span>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-xs text-muted-foreground/70">
                                                                        {getAnnotationTypeLabel(
                                                                            annotation.type,
                                                                        )}
                                                                        {indicatorLabel
                                                                            ? ` · ${indicatorLabel}`
                                                                            : ""}
                                                                    </div>
                                                                    <div className="break-words">
                                                                        {annotation.text ||
                                                                            "Zonder tekst"}
                                                                    </div>
                                                                </div>
                                                                {editMode &&
                                                                onRemoveAnnotation ? (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="size-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                                                                        onClick={() =>
                                                                            handleDeleteAnnotationClick(
                                                                                selectedImage.id,
                                                                                index,
                                                                            )
                                                                        }
                                                                    >
                                                                        <Trash2 className="size-3.5" />
                                                                    </Button>
                                                                ) : null}
                                                            </li>
                                                        )
                                                    },
                                                )}
                                            </ol>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Annotation input dialog */}
            <Dialog
                open={Boolean(pendingAnnotation)}
                onOpenChange={(open) => {
                    if (!open) resetAnnotationDialog()
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {pendingAnnotation
                                ? `${getAnnotationTypeLabel(pendingAnnotation.type)} Notitie toevoegen`
                                : "Notitie toevoegen"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label
                                className="text-sm font-medium"
                                htmlFor="annotation-title"
                            >
                                Korte titel
                            </label>
                            <Input
                                id="annotation-title"
                                value={annotationTitle}
                                onChange={(e) =>
                                    setAnnotationTitle(e.target.value)
                                }
                                placeholder="Bijv. verdichte laag"
                            />
                        </div>
                        <div className="space-y-2">
                            <label
                                className="text-sm font-medium"
                                htmlFor="annotation-indicator"
                            >
                                Indicator
                            </label>
                            <Select
                                value={annotationIndicator}
                                onValueChange={setAnnotationIndicator}
                            >
                                <SelectTrigger id="annotation-indicator">
                                    <SelectValue placeholder="Kies een indicator" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">
                                        Geen koppeling
                                    </SelectItem>
                                    {BCS_FIELD_INDICATORS.map((indicator) => (
                                        <SelectItem
                                            key={indicator.key}
                                            value={indicator.key}
                                        >
                                            {indicator.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label
                                className="text-sm font-medium"
                                htmlFor="annotation-text"
                            >
                                Toelichting
                            </label>
                            <Textarea
                                id="annotation-text"
                                value={annotationText}
                                onChange={(e) =>
                                    setAnnotationText(e.target.value)
                                }
                                placeholder="Wat wil je op deze plek vastleggen?"
                            />
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={resetAnnotationDialog}
                            >
                                Annuleren
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSaveAnnotation}
                            >
                                Notitie opslaan
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete annotation confirmation */}
            <AlertDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Notitie verwijderen?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Deze Notitie wordt definitief verwijderd en kan niet
                            worden teruggehaald.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={confirmDeleteAnnotation}
                        >
                            Verwijderen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </TooltipProvider>
    )
}
