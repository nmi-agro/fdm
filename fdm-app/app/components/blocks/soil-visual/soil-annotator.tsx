import { ClientOnly } from "remix-utils/client-only"
import type { SoilImageAnnotation } from "@nmi-agro/fdm-core"
import { useCallback, useRef, useState } from "react"
import { AnnotationToolbar, type AnnotationMode } from "./annotation-toolbar"
import { AnnotationPopover } from "./annotation-popover"

interface SoilAnnotatorProps {
    imageUrl: string
    annotations: SoilImageAnnotation[]
    onAnnotationAdd?: (annotation: {
        type: string
        data_json: string
        text?: string
        a_image_annotation_bcs?: string
    }) => void
    onAnnotationRemove?: (a_id_annotation: string) => void
    readOnly?: boolean
}

/** Lazy-loaded inner canvas — only rendered in the browser (no SSR) */
const SoilAnnotatorCanvas = ({
    imageUrl,
    annotations,
    onAnnotationAdd,
    onAnnotationRemove,
    readOnly = false,
}: SoilAnnotatorProps) => {
    // Dynamic imports resolved at runtime (client only)
    const { Stage, Layer, Image: KonvaImage, Circle, Arrow, Line, Text } =
        // biome-ignore lint/suspicious/noExplicitAny: konva types are complex
        require("react-konva") as any
    const useImage = require("use-image").default

    const [mode, setMode] = useState<AnnotationMode>(null)
    const [pendingAnnotation, setPendingAnnotation] = useState<{
        type: string
        data_json: string
    } | null>(null)
    const [stageSize, setStageSize] = useState({ width: 400, height: 300 })
    const containerRef = useRef<HTMLDivElement>(null)
    const isDrawing = useRef(false)
    const drawStart = useRef<{ x: number; y: number } | null>(null)
    const freehandPoints = useRef<number[]>([])

    const [image] = useImage(imageUrl, "anonymous")

    const toPercent = (px: number, dimension: number) =>
        (px / dimension) * 100
    const fromPercent = (pct: number, dimension: number) =>
        (pct / 100) * dimension

    const handleStagePointerDown = useCallback(
        (e: { target: { getStage: () => { getPointerPosition: () => { x: number; y: number } } } }) => {
            if (!mode || readOnly) return
            const stage = e.target.getStage()
            const pos = stage.getPointerPosition()
            if (!pos) return

            isDrawing.current = true
            drawStart.current = pos

            if (mode === "freehand") {
                freehandPoints.current = [pos.x, pos.y]
            }
        },
        [mode, readOnly],
    )

    const handleStagePointerUp = useCallback(
        (e: { target: { getStage: () => { getPointerPosition: () => { x: number; y: number } } } }) => {
            if (!mode || !isDrawing.current || readOnly) return
            const stage = e.target.getStage()
            const pos = stage.getPointerPosition()
            if (!pos || !drawStart.current) return

            isDrawing.current = false

            let data_json: string

            if (mode === "pin") {
                data_json = JSON.stringify({
                    x: toPercent(pos.x, stageSize.width),
                    y: toPercent(pos.y, stageSize.height),
                })
            } else if (mode === "circle") {
                const cx = toPercent(
                    (drawStart.current.x + pos.x) / 2,
                    stageSize.width,
                )
                const cy = toPercent(
                    (drawStart.current.y + pos.y) / 2,
                    stageSize.height,
                )
                const radiusPercent =
                    toPercent(
                        Math.hypot(
                            pos.x - drawStart.current.x,
                            pos.y - drawStart.current.y,
                        ) / 2,
                        Math.max(stageSize.width, stageSize.height),
                    )
                data_json = JSON.stringify({ cx, cy, radiusPercent })
            } else if (mode === "arrow") {
                data_json = JSON.stringify({
                    x1: toPercent(drawStart.current.x, stageSize.width),
                    y1: toPercent(drawStart.current.y, stageSize.height),
                    x2: toPercent(pos.x, stageSize.width),
                    y2: toPercent(pos.y, stageSize.height),
                })
            } else {
                // freehand
                const pts = freehandPoints.current
                const percentPoints = pts.map((v, i) =>
                    i % 2 === 0
                        ? toPercent(v, stageSize.width)
                        : toPercent(v, stageSize.height),
                )
                data_json = JSON.stringify({ points: percentPoints })
            }

            setPendingAnnotation({ type: mode, data_json })
        },
        [mode, readOnly, stageSize],
    )

    const handlePopoverSave = useCallback(
        (text: string, indicator?: string) => {
            if (!pendingAnnotation || !onAnnotationAdd) return
            onAnnotationAdd({ ...pendingAnnotation, text, a_image_annotation_bcs: indicator })
            setPendingAnnotation(null)
            setMode(null)
        },
        [pendingAnnotation, onAnnotationAdd],
    )

    const handlePopoverCancel = useCallback(() => {
        setPendingAnnotation(null)
    }, [])

    // Resize observer to make canvas responsive
    const containerCallback = useCallback((node: HTMLDivElement | null) => {
        if (!node) return
        const ro = new ResizeObserver(([entry]) => {
            const w = entry.contentRect.width
            // Maintain 4:3 aspect ratio
            setStageSize({ width: w, height: (w * 3) / 4 })
        })
        ro.observe(node)
    }, [])

    return (
        <div className="space-y-2">
            {!readOnly && (
                <AnnotationToolbar mode={mode} onModeChange={setMode} />
            )}

            <div ref={containerCallback} className="w-full rounded-lg overflow-hidden border bg-black">
                <Stage
                    width={stageSize.width}
                    height={stageSize.height}
                    onPointerDown={handleStagePointerDown}
                    onPointerUp={handleStagePointerUp}
                    style={{ cursor: mode ? "crosshair" : "default" }}
                >
                    <Layer>
                        {image && (
                            <KonvaImage
                                image={image}
                                width={stageSize.width}
                                height={stageSize.height}
                            />
                        )}
                        {/* Render existing annotations */}
                        {annotations.map((ann, i) => {
                            // biome-ignore lint/suspicious/noExplicitAny: jsonb returns unknown
                            const d = ann.a_image_annotation_coordinates as any
                            if (ann.a_image_annotation_type === "pin") {
                                return (
                                    <Text
                                        key={ann.a_id_annotation}
                                        x={fromPercent(d.x, stageSize.width) - 10}
                                        y={fromPercent(d.y, stageSize.height) - 10}
                                        text="📍"
                                        fontSize={20}
                                    />
                                )
                            }
                            if (ann.a_image_annotation_type === "circle") {
                                return (
                                    <Circle
                                        key={ann.a_id_annotation}
                                        x={fromPercent(d.cx, stageSize.width)}
                                        y={fromPercent(d.cy, stageSize.height)}
                                        radius={fromPercent(
                                            d.radiusPercent,
                                            Math.max(stageSize.width, stageSize.height),
                                        )}
                                        stroke="#facc15"
                                        strokeWidth={2}
                                        fill="transparent"
                                    />
                                )
                            }
                            if (ann.a_image_annotation_type === "arrow") {
                                return (
                                    <Arrow
                                        key={ann.a_id_annotation}
                                        points={[
                                            fromPercent(d.x1, stageSize.width),
                                            fromPercent(d.y1, stageSize.height),
                                            fromPercent(d.x2, stageSize.width),
                                            fromPercent(d.y2, stageSize.height),
                                        ]}
                                        stroke="#facc15"
                                        strokeWidth={2}
                                        fill="#facc15"
                                    />
                                )
                            }
                            if (ann.a_image_annotation_type === "freehand") {
                                return (
                                    <Line
                                        key={ann.a_id_annotation}
                                        points={d.points.map((v: number, idx: number) =>
                                            idx % 2 === 0
                                                ? fromPercent(v, stageSize.width)
                                                : fromPercent(v, stageSize.height),
                                        )}
                                        stroke="#facc15"
                                        strokeWidth={2}
                                        tension={0.5}
                                        lineCap="round"
                                    />
                                )
                            }
                            return null
                        })}
                    </Layer>
                </Stage>
            </div>

            {pendingAnnotation && (
                <AnnotationPopover
                    onSave={handlePopoverSave}
                    onCancel={handlePopoverCancel}
                />
            )}
        </div>
    )
}

/**
 * Canvas-based image annotation tool using react-konva.
 * Wrapped in ClientOnly because react-konva requires browser APIs (Canvas, window).
 * Same pattern as the MapLibre atlas map.
 */
export function SoilAnnotator(props: SoilAnnotatorProps) {
    return (
        <ClientOnly
            fallback={
                <div className="w-full aspect-[4/3] rounded-lg border bg-muted flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                        Canvas wordt geladen...
                    </p>
                </div>
            }
        >
            {() => <SoilAnnotatorCanvas {...props} />}
        </ClientOnly>
    )
}
