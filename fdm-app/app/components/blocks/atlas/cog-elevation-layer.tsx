import { TileLayer } from "@deck.gl/geo-layers"
import { PathLayer } from "@deck.gl/layers"
import {
    COGLayer,
    type COGLayerProps,
    parseCOGTileMatrixSet,
    proj as projUtils,
} from "@developmentseed/deck.gl-geotiff"
import { RasterLayer, RasterTileset2D } from "@developmentseed/deck.gl-raster"
import { rgb } from "d3-color"
import { interpolateSpectral } from "d3-scale-chromatic"
import { fromUrl, Pool } from "geotiff"
import proj4 from "proj4"

const pool = new Pool()

// Module using standard uniform declarations to match deck.gl-raster pattern
const ElevationModule = {
    name: "elevation",
    inject: {
        "fs:#decl": `
            uniform float elevation_min;
            uniform float elevation_max;
            uniform sampler2D elevation_texture;
            uniform sampler2D elevation_colormap;
        `,
        "fs:DECKGL_FILTER_COLOR": `
            float h = texture(elevation_texture, geometry.uv).r;
            
            if (h < -100.0 || h > 1000.0 || isnan(h)) {
                discard;
            }

            float r = elevation_max - elevation_min;
            if (abs(r) < 0.001) r = 1.0;
            float t = clamp((h - elevation_min) / r, 0.0, 1.0);
            
            vec4 c = texture(elevation_colormap, vec2(t, 0.5));
            color = vec4(c.rgb, 1.0);
        `,
    },
    getUniforms: (opts: any) => ({
        elevation_min: opts.min ?? -5.0,
        elevation_max: opts.max ?? 50.0,
        elevation_texture: opts.texture,
        elevation_colormap: opts.colormap,
    }),
}

export interface COGElevationLayerProps extends COGLayerProps {
    min?: number
    max?: number
    height: number
    width: number
}

export class COGElevationLayer extends COGLayer<COGElevationLayerProps> {
    static layerName = "COGElevationLayer"

    static defaultProps = {
        ...COGLayer.defaultProps,
        min: -5,
        max: 50,
    }

    _colormapTexture: any = null

    _getColormapTexture(device: any) {
        if (this._colormapTexture && this._colormapTexture.device === device) {
            return this._colormapTexture
        }

        const size = 256
        const data = new Uint8Array(size * 4)
        for (let i = 0; i < size; i++) {
            const t = i / (size - 1)
            const c = rgb(interpolateSpectral(1.0 - t))
            data[i * 4] = c.r
            data[i * 4 + 1] = c.g
            data[i * 4 + 2] = c.b
            data[i * 4 + 3] = 255
        }

        this._colormapTexture = device.createTexture({
            data,
            width: size,
            height: 1,
            format: "rgba8unorm",
            mipmaps: false,
            sampler: {
                minFilter: "linear",
                magFilter: "linear",
                addressModeU: "clamp-to-edge",
                addressModeV: "clamp-to-edge",
            },
        })
        this._colormapTexture.device = device

        return this._colormapTexture
    }

    async _parseGeoTIFF() {
        const {
            geotiff: geotiffUrl,
            geoKeysParser = projUtils.epsgIoGeoKeyParser,
        } = this.props

        let geotiff
        if (typeof geotiffUrl === "string") {
            geotiff = await fromUrl(geotiffUrl)
        } else {
            geotiff = geotiffUrl
        }

        const metadata = await parseCOGTileMatrixSet(geotiff, geoKeysParser)
        const imageCount = await geotiff.getImageCount()
        const images = []
        for (let i = 0; i < imageCount; i++) {
            images.push(await geotiff.getImage(i))
        }

        const image = images[0]
        const sourceProjection = await geoKeysParser(image.getGeoKeys())
        if (!sourceProjection) {
            throw new Error("Could not determine source projection")
        }

        const converter = proj4(sourceProjection.def, "EPSG:4326")
        const forwardReproject = (x: number, y: number) =>
            converter.forward([x, y], false)
        const inverseReproject = (x: number, y: number) =>
            converter.inverse([x, y], false)

        const getTileData = async (img: any, options: any) => {
            const { device } = options
            const rasterData = await img.readRasters({
                ...options,
                interleave: false,
                pool: pool,
            })
            const data = rasterData[0]

            const texture = device.createTexture({
                data,
                format: "r32float",
                width: rasterData.width,
                height: rasterData.height,
                mipmaps: false,
                sampler: {
                    minFilter: "nearest",
                    magFilter: "nearest",
                    addressModeU: "clamp-to-edge",
                    addressModeV: "clamp-to-edge",
                },
            })

            return {
                texture,
                height: rasterData.height,
                width: rasterData.width,
            }
        }

        this.setState({
            metadata,
            forwardReproject,
            inverseReproject,
            images,
            defaultGetTileData: getTileData,
        })
    }

    _renderSubLayers(
        props: any,
        metadata: any,
        forwardReproject: any,
        inverseReproject: any,
    ) {
        const { maxError, debug, debugOpacity, min, max } = this.props
        const { tile } = props

        if (!props.data) return null
        const { data, forwardTransform, inverseTransform } = props.data

        const layers: any[] = []
        if (data && data.texture) {
            layers.push(
                new RasterLayer(
                    this.getSubLayerProps({
                        id: `${props.id}-raster`,
                        width: data.width,
                        height: data.height,
                        renderPipeline: [
                            {
                                module: ElevationModule,
                                props: {
                                    texture: data.texture,
                                    colormap: this._getColormapTexture(
                                        this.context.device,
                                    ),
                                    min: min,
                                    max: max,
                                },
                            },
                        ],
                        maxError,
                        reprojectionFns: {
                            forwardTransform,
                            inverseTransform,
                            forwardReproject,
                            inverseReproject,
                        },
                        debug,
                        debugOpacity,
                    }),
                ),
            )
        }

        if (debug) {
            const projectedBounds = (tile as any)?.projectedBounds
            if (projectedBounds && metadata) {
                const { topLeft, topRight, bottomLeft, bottomRight } =
                    projectedBounds
                const path = [
                    metadata.projectToWgs84(topLeft),
                    metadata.projectToWgs84(topRight),
                    metadata.projectToWgs84(bottomRight),
                    metadata.projectToWgs84(bottomLeft),
                    metadata.projectToWgs84(topLeft),
                ]
                layers.push(
                    new PathLayer({
                        id: `${this.id}-${tile.id}-bounds`,
                        data: [path],
                        getPath: (d: any) => d,
                        getColor: [255, 0, 0, 255],
                        getWidth: 2,
                        widthUnits: "pixels",
                    }),
                )
            }
        }
        return layers
    }

    renderTileLayer(
        metadata: any,
        forwardReproject: any,
        inverseReproject: any,
        images: any,
    ) {
        const { min, max } = this.props

        class RasterTileset2DFactory extends RasterTileset2D {
            constructor(opts: any) {
                super(metadata, opts)
            }
        }

        return new TileLayer(
            this.getSubLayerProps({
                id: "tile-layer",
                TilesetClass: RasterTileset2DFactory,
                getTileData: async (tile: any) =>
                    this._getTileData(tile, images, metadata),
                renderSubLayers: (props: any) =>
                    this._renderSubLayers(
                        props,
                        metadata,
                        forwardReproject,
                        inverseReproject,
                    ),
                updateTriggers: {
                    renderSubLayers: [min, max],
                },
            }),
        )
    }

    renderLayers() {
        const { forwardReproject, inverseReproject, metadata, images } =
            this.state
        if (!forwardReproject || !inverseReproject || !metadata || !images)
            return null
        return this.renderTileLayer(
            metadata,
            forwardReproject,
            inverseReproject,
            images,
        )
    }
}
