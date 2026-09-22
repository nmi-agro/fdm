import { PointerEventHandler, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Slider } from "~/components/ui/slider"
import { cn } from "~/lib/utils"
export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageData {
  src: string
  imageWidth: number
  imageHeight: number
}

export type ImageCropperFrameShape = "ellipse" | "rectangle" | "hidden"

export type ImageCropperCropBounds = "inner" | "outer"

/**
 * Computes the largest rectangle with the given aspect ratio that will fit into the outer rectangle.
 * It aligns the center of the new rectangle to the center of the outer rectangle.
 *
 * @param outerRect rectangle to fit the new rectangle into.
 * @param innerAspectRatio aspect ratio (width / height) for the new rectangle.
 * @returns the computed rectangle.
 */
function fitRectangleIn(outerRect: Rectangle, innerAspectRatio: number): Rectangle {
  if (outerRect.width / outerRect.height > innerAspectRatio) {
    // Fit height
    const finalWidth = outerRect.height * innerAspectRatio

    return {
      x: outerRect.x + (outerRect.width - finalWidth) / 2,
      y: outerRect.y,
      width: finalWidth,
      height: outerRect.height,
    }
  }

  // Fit width
  const finalHeight = outerRect.width / innerAspectRatio

  return {
    x: outerRect.x,
    y: outerRect.y + (outerRect.height - finalHeight) / 2,
    width: outerRect.width,
    height: finalHeight,
  }
}

/**
 * Computes the smallest rectangle with the given aspect ratio that will contain the inner rectangle.
 * It aligns the center of the new rectangle to the center of the outer rectangle.
 *
 * @param innerRect rectangle to contain in the new rectangle.
 * @param outerAspectRatio aspect ratio (width / height) for the new rectangle.
 * @returns the computed rectangle.
 */
function fitRectangleOut(innerRect: Rectangle, outerAspectRatio: number): Rectangle {
  if (innerRect.width / innerRect.height > outerAspectRatio) {
    // Fit width
    const finalHeight = innerRect.width / outerAspectRatio

    return {
      x: innerRect.x,
      y: innerRect.y + (innerRect.height - finalHeight) / 2,
      width: innerRect.width,
      height: finalHeight,
    }
  }

  // Fit height
  const finalWidth = innerRect.height * outerAspectRatio

  return {
    x: innerRect.x + (innerRect.width - finalWidth) / 2,
    y: innerRect.y,
    width: finalWidth,
    height: innerRect.height,
  }
}

/**
 * Scales the rectangle around the given center point.
 *
 * @param rect Rectangle to transform.
 * @param centerX X coordinate of the scale origin.
 * @param centerY Y coordinate of the scale origin.
 * @param scale Amount to scale relative to the rectangle's current size.
 * @returns A new rectangle object.
 */
function scaleAroundCenter(rect: Rectangle, centerX: number, centerY: number, scale: number) {
  return {
    x: (rect.x - centerX) * scale + centerX,
    y: (rect.y - centerY) * scale + centerY,
    width: rect.width * scale,
    height: rect.height * scale,
  }
}

/**
 * Get the geometric center point of a rectangle as a tuple of two numbers.
 *
 * @param rect Rectangle to get the center of.
 * @returns A tuple of two numbers for the X and Y positions respectively.
 */
function getRectangleCenter(rect: Rectangle): [number, number] {
  return [rect.x + rect.width / 2, rect.y + rect.height / 2]
}

/**
 * Gets a list of SVG path commands that would produce a rectangle.
 *
 * @param rect Rectangle to realize as a SVG path.
 * @returns An array of SVG commands like "M 3,3" or "L 5,7".
 */
function getRectangleSvgCommands(rect: Rectangle) {
  return [
    `M ${rect.x},${rect.y}`,
    `L ${rect.x + rect.width}, ${rect.y}`,
    `L ${rect.x + rect.width}, ${rect.y + rect.height}`,
    `L ${rect.x}, ${rect.y + rect.height}`,
    `L ${rect.x},${rect.y}`,
  ]
}

/**
 * Gets a list of SVG path commands that would produce an ellipse that fits into the rectangle.
 *
 * @param rect Rectangle to realize as an ellipse.
 * @returns An array of SVG commands like "M 3,3" or "A 5,7 0 1,0 2,4".
 */
function getEllipseSvgCommands(rect: Rectangle) {
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const rx = rect.width / 2
  const ry = rect.height / 2

  return [
    `M ${cx - rx}, ${cy}`,
    `A ${rx},${ry} 0 1,0 ${cx + rx},${cy}`,
    `A ${rx},${ry} 0 1,0 ${cx - rx},${cy}`,
  ]
}

/**
 * Calculates the cropped part out of the image. 0,0 is the top left corner of the image and units are
 * in image pixels.
 *
 * @param imageData Image to crop.
 * @param aspectRatio Crop frame aspect ratio.
 * @param x X coordinate relative to the center of the image.
 * @param y Y coordinate relative to the center of the image.
 * @param scale Scale of the crop rectangle compared to how it was initially.
 * @returns The rectangle to crop the image pixels with.
 */
function getResultFrameRect(
  imageData: ImageData,
  aspectRatio: number,
  x: number,
  y: number,
  scale: number,
) {
  const resultImageRect = { x: 0, y: 0, width: imageData.imageWidth, height: imageData.imageHeight }
  const resultFrameRect = fitRectangleIn(resultImageRect, aspectRatio)
  resultFrameRect.x += x
  resultFrameRect.y += y
  return scaleAroundCenter(resultFrameRect, ...getRectangleCenter(resultFrameRect), scale)
}

const SVG_VIEWBOX_HEIGHT = 500
const MIN_SCALE = 1 / 10

interface ImageCropperAppProps {
  className?: string
  aspectRatio?: number
  frameShape?: ImageCropperFrameShape
  frameRelativeSize?: number
  cropBounds?: ImageCropperCropBounds
  imageData: ImageData
  onClear: () => void
  framePosition: ImageCropperFramePosition
  onFramePositionChange: (framePosition: ImageCropperFramePosition) => void
  onFrameRectangleChange?: (rectangle: Rectangle) => void
}

interface ImageCropperFramePosition {
  x: number
  y: number
  scale: number
}

/**
 * Adjusts the new state values so that the frame rectangle stays inside the image rectangle,
 * then constructs a frame position state object.
 *
 * @param nextX value that would be passed to `setX`
 * @param nextY value that would be passed to `setY`
 * @param nextScale element of the array that would be passed to `setScaleSliderValue`
 * @returns the new frame position object
 */
function moveIntoRectangle(
  x: number,
  y: number,
  scale: number,
  imageData: ImageData,
  aspectRatio: number,
): ImageCropperFramePosition {
  const newRect = getResultFrameRect(imageData, aspectRatio, x, y, scale)

  const boundsLeft = Math.min(0, imageData.imageWidth - newRect.width)
  const boundsRight = Math.max(imageData.imageWidth, newRect.width)
  const boundsTop = Math.min(0, imageData.imageHeight - newRect.height)
  const boundsBottom = Math.max(imageData.imageHeight, newRect.height)

  if (newRect.x < boundsLeft) x = boundsLeft + newRect.width / 2 - imageData.imageWidth / 2
  if (newRect.x + newRect.width > boundsRight)
    x = boundsRight - newRect.width / 2 - imageData.imageWidth / 2

  if (newRect.y < boundsTop) y = boundsTop + newRect.height / 2 - imageData.imageHeight / 2
  if (newRect.y + newRect.height > boundsBottom)
    y = boundsBottom - newRect.height / 2 - imageData.imageHeight / 2

  return { x, y, scale }
}

export function ImageCropperApp({
  className,
  aspectRatio = 1 / 1,
  imageData,
  frameRelativeSize = 0.6,
  cropBounds = "inner",
  frameShape = "ellipse",
  framePosition,
  onFramePositionChange,
  onFrameRectangleChange,
}: ImageCropperAppProps) {
  // Instead of precisely laying out the application for the target aspect ratio, we only lay out
  // enough to have the crop frame the correct size, use object-fit: contain, and add transparent
  // fill to the out of the view-box parts of the SVG.
  const appAspectRatio = aspectRatio

  const svgRef = useRef<SVGSVGElement>(null)
  const [maxScale, setMaxScale] = useState(1)
  const framePositionRef = useRef(framePosition)

  // x and y are relative to the center of the image, in image pixel units.
  // Scaling happens around the center of the frame rectangle / ellipse.
  const { x, y, scale } = framePosition

  const scaleSliderValue = useMemo(() => [scale], [scale])

  const dragState = useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
  })

  // Reset crop rectangle
  useEffect(() => {
    let nextMaxScale = 1

    if (cropBounds === "outer") {
      const imageRect = { x: 0, y: 0, width: imageData.imageWidth, height: imageData.imageHeight }
      nextMaxScale =
        fitRectangleOut(imageRect, aspectRatio).width / fitRectangleIn(imageRect, aspectRatio).width
    }

    setMaxScale(nextMaxScale)
    const newFramePosition = { x: 0, y: 0, scale: nextMaxScale }
    onFramePositionChange(newFramePosition)
    framePositionRef.current = newFramePosition
    onFrameRectangleChange?.(getResultFrameRect(imageData, aspectRatio, 0, 0, nextMaxScale))
    dragState.current.dragging = false
  }, [imageData, aspectRatio, cropBounds, onFramePositionChange, onFrameRectangleChange])

  // all other rectangles are fit onto this
  const appRect = {
    x: 0,
    y: 0,
    width: appAspectRatio * SVG_VIEWBOX_HEIGHT,
    height: SVG_VIEWBOX_HEIGHT,
  }

  // First fit the frame
  const frameRect = fitRectangleIn(appRect, aspectRatio)

  // Fit the image around the frame
  const imageRect = fitRectangleOut(frameRect, imageData.imageWidth / imageData.imageHeight)

  // Translate the image before scaling everything
  imageRect.x -= (x * imageRect.width) / imageData.imageWidth
  imageRect.y -= (y * imageRect.height) / imageData.imageHeight

  const imageRectScaled = scaleAroundCenter(
    imageRect,
    ...getRectangleCenter(appRect),
    frameRelativeSize / scale,
  )
  const frameRectScaled = scaleAroundCenter(
    frameRect,
    ...getRectangleCenter(appRect),
    frameRelativeSize,
  )

  const handleNewFramePosition = useCallback(
    (framePosition: ImageCropperFramePosition) => {
      framePositionRef.current = framePosition
      onFramePositionChange(framePosition)
      if (onFrameRectangleChange) {
        onFrameRectangleChange(
          getResultFrameRect(
            imageData,
            aspectRatio,
            framePosition.x,
            framePosition.y,
            framePosition.scale,
          ),
        )
      }
    },
    [imageData, aspectRatio, onFramePositionChange, onFrameRectangleChange],
  )

  const handlePointerDown: PointerEventHandler = (e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const bcr = e.currentTarget.getBoundingClientRect()
    dragState.current.dragging = true
    dragState.current.lastX = ((e.clientX - bcr.left) / bcr.height) * SVG_VIEWBOX_HEIGHT
    dragState.current.lastY = ((e.clientY - bcr.top) / bcr.height) * SVG_VIEWBOX_HEIGHT
  }

  const handlePointerMove: PointerEventHandler = (e) => {
    if (!dragState.current.dragging) {
      return
    }
    e.preventDefault()
    const bcr = e.currentTarget.getBoundingClientRect()

    // svg might appear smaller than SVG_VIEWBOX_HEIGHT due to CSS
    const currentX = ((e.clientX - bcr.left) / bcr.width) * appAspectRatio * SVG_VIEWBOX_HEIGHT
    const currentY = ((e.clientY - bcr.top) / bcr.height) * SVG_VIEWBOX_HEIGHT

    // Movement amount is scaled by how large the image actually is vs how large it appears
    const speed = imageData.imageWidth / imageRectScaled.width

    let nextX = x - (currentX - dragState.current.lastX) * speed
    let nextY = y - (currentY - dragState.current.lastY) * speed

    handleNewFramePosition(moveIntoRectangle(nextX, nextY, scale, imageData, aspectRatio))
    dragState.current.lastX = currentX
    dragState.current.lastY = currentY
  }

  const handlePointerUp: PointerEventHandler = () => {
    dragState.current.dragging = false
  }

  /**
   * Handle zoom input on the slider.
   */
  function handleZoomInput(value: number[]) {
    const nextScale = value[0] > maxScale ? maxScale : value[0] < MIN_SCALE ? MIN_SCALE : value[0]

    handleNewFramePosition(moveIntoRectangle(x, y, nextScale, imageData, aspectRatio))
  }

  useEffect(() => {
    const svgElement = svgRef.current
    if (!svgElement) {
      return
    }

    // React wheel listeners can be passive in some environments.
    // Register a native non-passive listener so preventDefault always works.
    const nativeWheelHandler = (e: WheelEvent) => {
      if (e.cancelable) {
        e.preventDefault()
      }
      e.stopPropagation()

      if (!e.currentTarget) return

      const factor = e.deltaY > 0 ? 1.05 : 0.95

      const nextScale = Math.max(
        MIN_SCALE,
        Math.min(maxScale, framePositionRef.current.scale * factor),
      )

      handleNewFramePosition(
        moveIntoRectangle(
          framePositionRef.current.x,
          framePositionRef.current.y,
          nextScale,
          imageData,
          aspectRatio,
        ),
      )
    }

    svgElement.addEventListener("wheel", nativeWheelHandler, { passive: false })

    return () => {
      svgElement.removeEventListener("wheel", nativeWheelHandler)
    }
  }, [maxScale, imageData, aspectRatio, frameRelativeSize, handleNewFramePosition, appAspectRatio])

  const transparentOverlay = { fill: "black", fillOpacity: 0.75, stroke: "none" } as const
  const transparentOverlayOuterExtentX = 3 * SVG_VIEWBOX_HEIGHT
  const transparentOverlayOuterExtentY = 3 * SVG_VIEWBOX_HEIGHT
  const transparentOverlayExtentSvgCommands = getRectangleSvgCommands({
    x: appRect.x - transparentOverlayOuterExtentX,
    y: appRect.y - transparentOverlayOuterExtentY,
    width: 2 * transparentOverlayOuterExtentX + appRect.width,
    height: 2 * transparentOverlayOuterExtentY + appRect.height,
  }).join(" ")
  const frameSvgCommands =
    frameShape === "ellipse"
      ? getEllipseSvgCommands(frameRectScaled).join(" ")
      : getRectangleSvgCommands(frameRectScaled).join(" ")

  return (
    <div className={cn("flex size-full flex-col items-stretch gap-4", className)}>
      <svg
        ref={svgRef}
        viewBox={`0,0,${appAspectRatio * SVG_VIEWBOX_HEIGHT},${SVG_VIEWBOX_HEIGHT}`}
        className="min-h-0 flex-[1_1] rounded-md object-contain"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <title>Trim de profielfoto</title>
        {frameShape === "hidden" && (
          // Render a transparent overlay in the back of the image if there is no frame overlay.
          <rect
            x={-transparentOverlayOuterExtentX}
            y={-transparentOverlayOuterExtentY}
            width={2 * transparentOverlayOuterExtentX + appRect.width}
            height={2 * transparentOverlayOuterExtentY + appRect.height}
            {...transparentOverlay}
          />
        )}
        <image href={imageData.src} {...imageRectScaled} />
        {frameShape !== "hidden" && (
          // Transparent overlay that surrounds the crop frame.
          <path
            d={`${transparentOverlayExtentSvgCommands} ${frameSvgCommands}`}
            {...transparentOverlay}
            fillRule="evenodd"
          />
        )}
        {/* Outline of the cropped region. */}
        <path
          d={frameSvgCommands}
          fill="none"
          stroke="white"
          strokeWidth={SVG_VIEWBOX_HEIGHT * 0.001}
        />
      </svg>
      <Slider
        value={scaleSliderValue}
        onValueChange={(v) => handleZoomInput(v)}
        min={MIN_SCALE}
        max={maxScale}
        step={0.05}
        dir="rtl"
      />
    </div>
  )
}
