import type { RenderTileResult } from "@developmentseed/deck.gl-raster"
import type { Device, Texture } from "@luma.gl/core"
import type { FeatureCollection } from "geojson"
import { Deck, type LayerContext, type LayersList, MapView } from "@deck.gl/core"
import { PathStyleExtension } from "@deck.gl/extensions"
import { GeoJsonLayer } from "@deck.gl/layers"
import {
  COGLayer,
  type COGLayerProps,
  COGSource,
  type COGSourceOptions,
  type GetTileDataOptions,
  MosaicLayer,
} from "@developmentseed/deck.gl-geotiff"
import {
  Colormap,
  CreateTexture,
  createColormapTexture,
  FilterNoDataVal,
  LinearRescale,
} from "@developmentseed/deck.gl-raster/gpu-modules"
import proj4 from "proj4"
import { useEffect, useRef } from "react"
import { useMap } from "react-map-gl/maplibre"
import { ELEVATION_COLOR_STOPS } from "./atlas-elevation-colors"

/** Proj4 definition of RD New (EPSG:28992), the CRS of the AHN kaartbladen. */
const RD_NEW = "EPSG:28992"
proj4.defs(
  RD_NEW,
  "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +units=m +no_defs",
)
const toRd = proj4("EPSG:4326", RD_NEW)

/**
 * Sentinel for pixels without a valid elevation. The AHN nodata value (the largest float32) and
 * values outside the plausible range are replaced with it when a tile loads, so the shader can
 * discard them with an exact comparison.
 */
const NO_DATA = -9999
/**
 * Plausible elevation range in m NAP. The Netherlands lies between about -7 m and +323 m; values
 * outside this wide margin are artefacts and are treated as nodata.
 */
const MIN_VALID = -100
const MAX_VALID = 1000

/** One AHN kaartblad, as an item of the {@link MosaicLayer}. */
export interface AhnItem {
  /** Kaartblad number, or the URL when the index has none. */
  id: string
  /** URL of the kaartblad's Cloud-Optimized GeoTIFF. */
  url: string
  /** Bounds in WGS84: `[west, south, east, north]`. */
  bbox: [number, number, number, number]
}

/**
 * Turns the AHN kaartbladindex (polygons in RD New) into mosaic items with WGS84 bounds.
 *
 * @param index - The kaartbladindex as served by `/atlas/ahn-index`.
 * @returns One item per kaartblad that has a polygon and a download URL.
 */
export function buildAhnItems(index: FeatureCollection): AhnItem[] {
  const items: AhnItem[] = []
  for (const feature of index.features) {
    if (feature.geometry?.type !== "Polygon" || !feature.properties) continue
    const url: unknown =
      feature.properties.url ?? feature.properties.href ?? feature.properties.download_url
    if (typeof url !== "string") continue

    let west = Infinity
    let south = Infinity
    let east = -Infinity
    let north = -Infinity
    for (const [x, y] of feature.geometry.coordinates[0]) {
      const [lng, lat] = toRd.inverse([x, y])
      west = Math.min(west, lng)
      south = Math.min(south, lat)
      east = Math.max(east, lng)
      north = Math.max(north, lat)
    }
    const id = feature.properties.kaartbladNr
    items.push({
      id: typeof id === "string" ? id : url,
      url,
      bbox: [west, south, east, north],
    })
  }
  return items
}

/** Resolves the CRS of the AHN files locally, instead of the default lookup on epsg.io. */
const resolveRdNew: NonNullable<COGSourceOptions["epsgResolver"]> = async (epsg) => {
  if (epsg !== 28992) {
    throw new Error(`Unexpected CRS EPSG:${epsg} for an AHN kaartblad`)
  }
  return Object.assign(new proj4.Proj(RD_NEW), { title: RD_NEW })
}

/** A decoded AHN tile: the elevation values on the CPU, and as a texture on the GPU. */
export interface ElevationTile {
  /** Id of the {@link COGLayer} (one per kaartblad) that loaded the tile. */
  layerId: string
  width: number
  height: number
  byteLength: number
  /** Elevation in m NAP, row by row; {@link NO_DATA} where there is none. */
  values: Float32Array
  /** Affine transform from pixel (col, row) to RD New: `[a, b, c, d, e, f]`. */
  transform: readonly number[]
  /** Elevation values as an `r32float` texture. */
  texture: Texture
  /** The shared colormap texture of the device the tile was uploaded to. */
  colormap: Texture
}

/** The full-resolution image or an overview of a kaartblad, as passed to `getTileData`. */
type TileImage = Parameters<NonNullable<COGLayerProps<ElevationTile>["getTileData"]>>[0]

export type ElevationTilesStatus = "idle" | "loading" | "slow" | "error"

const SLOW_AFTER_MS = 2000

/** Percentiles of the pixels in view that set the ends of the colour scale. */
const LOWER_PERCENTILE = 0.02
const UPPER_PERCENTILE = 0.98
const HISTOGRAM_BINS = 2048

/** Colormap texture per GPU device, built once from {@link ELEVATION_COLOR_STOPS}. */
const colormapTextures = new WeakMap<Device, Texture>()

function getColormapTexture(device: Device): Texture {
  let texture = colormapTextures.get(device)
  if (!texture) {
    const stops = ELEVATION_COLOR_STOPS.map((hex) => [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ])
    const pixels = new Uint8ClampedArray(256 * 4)
    for (let i = 0; i < 256; i++) {
      const position = (i / 255) * (stops.length - 1)
      const lower = Math.floor(position)
      const upper = Math.min(lower + 1, stops.length - 1)
      const t = position - lower
      for (let channel = 0; channel < 3; channel++) {
        pixels[i * 4 + channel] = Math.round(
          stops[lower][channel] * (1 - t) + stops[upper][channel] * t,
        )
      }
      pixels[i * 4 + 3] = 255
    }
    texture = createColormapTexture(device, new ImageData(pixels, 256, 1))
    colormapTextures.set(device, texture)
  }
  return texture
}

/**
 * Keeps the decoded AHN tiles the map currently holds, so the legend range and the hover value
 * are read from pixels already loaded instead of from extra requests.
 *
 * Its `getTileData`, `onTileUnload` and `onTileError` are stable callbacks for {@link COGLayer},
 * and it reports the loading status through `subscribe`/`getStatus` (for `useSyncExternalStore`).
 */
export class ElevationTiles {
  /** Loaded tiles per layer id, so a removed layer can release all of its tiles at once. */
  private readonly layers = new Map<string, Set<ElevationTile>>()
  /**
   * Per layer, the tiles it last showed for the whole view (`onViewportLoad`): one zoom level,
   * without the tiles of other levels its cache still holds.
   */
  private readonly displayed = new Map<string, readonly ElevationTile[]>()
  private readonly listeners = new Set<() => void>()
  private pending = 0
  /** Whether a tile of the current loading round failed. */
  private failed = false
  private status: ElevationTilesStatus = "idle"
  private slowTimer: ReturnType<typeof setTimeout> | undefined;

  private *tiles(): Generator<ElevationTile> {
    for (const layer of this.layers.values()) yield* layer
  }

  /**
   * Registers a listener that is called after every change of the store: a tile loaded or
   * released, a layer finished loading its view, or the loading status changed. The listener
   * gets no arguments; read what you need with {@link getStatus}, {@link rangeIn} or
   * {@link valueAt}.
   *
   * The signature fits `useSyncExternalStore(subscribe, getStatus)`.
   *
   * @returns A function that removes the listener again.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** The loading status of the tiles in view, for the legend. */
  getStatus = (): ElevationTilesStatus => this.status

  private setStatus(status: ElevationTilesStatus) {
    this.status = status
    this.notify()
  }

  private notify() {
    for (const listener of this.listeners) listener()
  }

  private beginLoad() {
    this.pending++
    if (this.pending === 1) {
      this.failed = false
      this.setStatus("loading")
      this.slowTimer = setTimeout(() => {
        if (this.pending > 0) this.setStatus("slow")
      }, SLOW_AFTER_MS)
    }
  }

  private endLoad() {
    this.pending = Math.max(0, this.pending - 1)
    if (this.pending === 0) {
      clearTimeout(this.slowTimer)
      this.setStatus(this.failed ? "error" : "idle")
    }
  }

  /**
   * Fetches and decodes one tile of a kaartblad, and uploads it as a float texture.
   *
   * @param layerId - Id of the {@link COGLayer} the tile belongs to.
   */
  async getTileData(
    layerId: string,
    image: TileImage,
    options: GetTileDataOptions,
  ): Promise<ElevationTile> {
    const { device, x, y, signal, pool } = options
    this.beginLoad()
    try {
      const { array } = await image.fetchTile(x, y, { boundless: false, pool, signal })
      // deck.gl drops the result of an aborted tile without unloading it, so don't keep it.
      signal?.throwIfAborted()
      const raw = array.layout === "pixel-interleaved" ? array.data : array.bands[0]
      const values = raw instanceof Float32Array ? raw : Float32Array.from(raw)
      const nodata = array.nodata
      for (let i = 0; i < values.length; i++) {
        const value = values[i]
        if (value === nodata || Number.isNaN(value) || value <= MIN_VALID || value >= MAX_VALID) {
          values[i] = NO_DATA
        }
      }

      const texture = device.createTexture({
        data: values,
        format: "r32float",
        width: array.width,
        height: array.height,
        // Float textures are not filterable in WebGL2 without an extension; at 0,5 m per pixel
        // nearest sampling is also the honest view of the data.
        sampler: { minFilter: "nearest", magFilter: "nearest" },
      })
      const tile: ElevationTile = {
        layerId,
        width: array.width,
        height: array.height,
        byteLength: values.byteLength,
        values,
        transform: array.transform,
        texture,
        colormap: getColormapTexture(device),
      }
      let layer = this.layers.get(layerId)
      if (!layer) {
        layer = new Set()
        this.layers.set(layerId, layer)
      }
      layer.add(tile)
      this.notify()
      return tile
    } finally {
      this.endLoad()
    }
  }

  /** Releases a tile that its layer's tile cache evicted. */
  onTileUnload = (tile: { content: ElevationTile | null }) => {
    const data = tile.content
    if (!data) return
    this.layers.get(data.layerId)?.delete(data)
    data.texture.destroy()
  }

  /**
   * Releases every tile of a layer that deck.gl removed, such as the layer of a kaartblad that
   * left the view. deck.gl doesn't call `onTileUnload` for those.
   */
  releaseLayer(layerId: string) {
    const layer = this.layers.get(layerId)
    if (!layer) return
    for (const tile of layer) tile.texture.destroy()
    this.layers.delete(layerId)
    this.displayed.delete(layerId)
    this.notify()
  }

  /** Records the tiles a layer shows once all tiles in view have loaded. */
  onViewportLoad(layerId: string, tiles: readonly { content: ElevationTile | null }[]) {
    this.displayed.set(
      layerId,
      tiles.flatMap((tile) => (tile.content ? [tile.content] : [])),
    )
    this.notify()
  }

  /** Counts a request, such as opening a kaartblad's header, towards the loading status. */
  async track<T>(request: Promise<T>): Promise<T> {
    this.beginLoad()
    try {
      return await request
    } finally {
      this.endLoad()
    }
  }

  onTileError = (error: unknown) => {
    if (error instanceof Error && error.name === "AbortError") return
    console.error("Error loading AHN tile:", error)
    this.failed = true
    // The tile's own load has already ended; report it now unless others are still loading.
    if (this.pending === 0) this.setStatus("error")
  }

  /**
   * The elevation range of the loaded pixels inside an area of the map, from the 2nd to the 98th
   * percentile, so a few dikes, yards or ditch bottoms don't flatten the contrast of the rest.
   *
   * The percentiles are read from a histogram of {@link HISTOGRAM_BINS} bins between the lowest
   * and highest value, so they are accurate to one bin width (a few centimetres in most views).
   *
   * @param corners - The corners of the area, as `[lng, lat]` in WGS84.
   * @returns The range in m NAP, or `null` when no loaded pixel with data lies in the area.
   */
  rangeIn(corners: [number, number][]): { min: number; max: number } | null {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const corner of corners) {
      const [x, y] = toRd.forward(corner)
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }

    // Pixel window of the area in each tile. The AHN files are north-up (b = d = 0, e < 0).
    const windows: {
      tile: ElevationTile
      col0: number
      col1: number
      row0: number
      row1: number
    }[] = []
    // Only the tiles on screen: cached tiles of other zoom levels would count areas twice and
    // weigh earlier views.
    const displayedTiles = [...this.displayed.values()].flat()
    for (const tile of displayedTiles) {
      const [a, , c, , e, f] = tile.transform
      const col0 = Math.max(0, Math.floor((minX - c) / a))
      const col1 = Math.min(tile.width - 1, Math.floor((maxX - c) / a))
      const row0 = Math.max(0, Math.floor((maxY - f) / e))
      const row1 = Math.min(tile.height - 1, Math.floor((minY - f) / e))
      if (col0 <= col1 && row0 <= row1) windows.push({ tile, col0, col1, row0, row1 })
    }
    const forEachValue = (callback: (value: number) => void) => {
      for (const { tile, col0, col1, row0, row1 } of windows) {
        for (let row = row0; row <= row1; row++) {
          const offset = row * tile.width
          for (let col = col0; col <= col1; col++) {
            const value = tile.values[offset + col]
            if (value !== NO_DATA) callback(value)
          }
        }
      }
    }

    let min = Infinity
    let max = -Infinity
    let count = 0
    forEachValue((value) => {
      if (value < min) min = value
      if (value > max) max = value
      count++
    })
    if (count === 0) return null
    if (max === min) return { min, max }

    const bins = new Uint32Array(HISTOGRAM_BINS)
    const scale = (HISTOGRAM_BINS - 1) / (max - min)
    forEachValue((value) => {
      bins[Math.floor((value - min) * scale)]++
    })
    const lowerRank = count * LOWER_PERCENTILE
    const upperRank = count * UPPER_PERCENTILE
    let lowerBin = 0
    let upperBin = HISTOGRAM_BINS - 1
    let cumulative = 0
    for (let bin = 0; bin < HISTOGRAM_BINS; bin++) {
      const previous = cumulative
      cumulative += bins[bin]
      if (previous <= lowerRank && cumulative > lowerRank) lowerBin = bin
      if (previous < upperRank && cumulative >= upperRank) {
        upperBin = bin
        break
      }
    }
    return {
      min: min + lowerBin / scale,
      max: Math.min(max, min + (upperBin + 1) / scale),
    }
  }

  /**
   * The elevation at a point, from the most detailed loaded tile that covers it.
   *
   * @returns The elevation in m NAP, or `null` when no loaded tile has data there.
   */
  valueAt(lng: number, lat: number): number | null {
    const [x, y] = toRd.forward([lng, lat])
    let best: { size: number; value: number } | null = null
    for (const tile of this.tiles()) {
      const [a, , c, , e, f] = tile.transform
      const col = Math.floor((x - c) / a)
      const row = Math.floor((y - f) / e)
      if (col < 0 || row < 0 || col >= tile.width || row >= tile.height) continue
      const value = tile.values[row * tile.width + col]
      if (value === NO_DATA) continue
      if (!best || a < best.size) best = { size: a, value }
    }
    return best?.value ?? null
  }
}

/**
 * Builds the deck.gl layer that draws the AHN kaartbladen in view, coloured from `min` (blue) to
 * `max` (red). Changing `min` or `max` only updates shader uniforms; no tile is fetched again.
 */
export function createElevationLayer({
  items,
  tiles,
  min,
  max,
}: {
  items: AhnItem[]
  tiles: ElevationTiles
  min: number
  max: number
}) {
  const renderTile = (data: ElevationTile): RenderTileResult => ({
    renderPipeline: [
      { module: CreateTexture, props: { textureName: data.texture } },
      { module: FilterNoDataVal, props: { value: NO_DATA } },
      { module: LinearRescale, props: { rescaleMin: min, rescaleMax: max } },
      { module: Colormap, props: { colormapTexture: data.colormap } },
    ],
  })

  return new MosaicLayer<AhnItem, COGSource>({
    id: "ahn-elevation",
    data: items,
    getSource: (item, options) =>
      tiles.track(COGSource.open(item.url, { ...options, epsgResolver: resolveRdNew })),
    // A kaartblad whose header fails to open has no COGLayer yet, so report it here.
    onSourceError: (_item, { error }) => tiles.onTileError(error),
    renderSource: (_item, { source, subLayerProps }) => {
      if (!source) return null
      const props: ElevationCOGLayerProps = {
        ...subLayerProps,
        source,
        tiles,
        getTileData: (image, options) => tiles.getTileData(subLayerProps.id, image, options),
        renderTile,
        onTileUnload: tiles.onTileUnload,
        onTileError: tiles.onTileError,
        onViewportLoad: (loaded) => tiles.onViewportLoad(subLayerProps.id, loaded),
        updateTriggers: { renderTile: [min, max] },
      }
      return new ElevationCOGLayer(props)
    },
  })
}

type ElevationCOGLayerProps = COGLayerProps<ElevationTile> & {
  /** The store the layer's tiles are kept in. */
  tiles: ElevationTiles
}

/**
 * A {@link COGLayer} that releases its tiles from {@link ElevationTiles} when deck.gl removes
 * it: deck.gl's tile cache is cleared without `onTileUnload` then, which would keep their
 * textures and values alive.
 */
class ElevationCOGLayer extends COGLayer<ElevationTile> {
  static layerName = "ElevationCOGLayer"

  finalizeState(context: LayerContext) {
    super.finalizeState(context)
    const { tiles } = this.props as typeof this.props & Partial<ElevationCOGLayerProps>
    tiles?.releaseLayer(this.props.id)
  }
}

const dashExtension = new PathStyleExtension({ dash: true })

/**
 * Field outlines drawn by deck.gl on top of the elevation: the white dotted line of the thematic
 * atlas layers (`getDottedFieldOutlineStyle` in `atlas-styles.tsx`), which the deck.gl canvas
 * would otherwise cover: 2,5 px dots with 5 px gaps. deck.gl draws dashes with square ends, so a
 * 2,5 px dash stands in for MapLibre's round dot.
 */
export function createFieldOutlineLayer(fields: FeatureCollection, visible: boolean) {
  return new GeoJsonLayer({
    id: "fields-outline",
    data: fields,
    visible,
    filled: false,
    stroked: true,
    getLineColor: [255, 255, 255],
    getLineWidth: 2.5,
    lineWidthUnits: "pixels",
    lineJointRounded: true,
    lineCapRounded: true,
    getDashArray: [2.5, 5],
    dashUnits: "pixels",
    dashJustified: true,
    extensions: [dashExtension],
  })
}

/**
 * Draws deck.gl layers on a canvas of their own, just above the MapLibre canvas and below the
 * map's controls and overlays, and keeps its camera in step with the map.
 *
 * deck.gl's own MapLibre integration (`@deck.gl/mapbox`) reads the map's private `transform`,
 * which MapLibre 6 no longer has on the map, so it is not used. The canvas ignores pointer
 * events: hover and clicks still reach the map.
 */
export function DeckGlCanvas({ layers }: { layers: LayersList }) {
  const { current: mapRef } = useMap()
  const deckRef = useRef<Deck<MapView> | null>(null)

  useEffect(() => {
    if (!mapRef) return
    const map = mapRef.getMap()
    const canvas = document.createElement("canvas")
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none"
    map.getCanvasContainer().after(canvas)

    const getViewState = () => {
      const center = map.getCenter()
      return {
        longitude: center.lng,
        latitude: center.lat,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      }
    }
    const deck = new Deck<MapView>({
      canvas,
      views: new MapView({ repeat: true }),
      viewState: getViewState(),
      controller: false,
    })
    const sync = () => deck.setProps({ viewState: getViewState() })
    map.on("move", sync)
    map.on("resize", sync)
    deckRef.current = deck

    return () => {
      map.off("move", sync)
      map.off("resize", sync)
      deck.finalize()
      canvas.remove()
      deckRef.current = null
    }
  }, [mapRef])

  useEffect(() => {
    deckRef.current?.setProps({ layers })
  }, [layers])

  return null
}
