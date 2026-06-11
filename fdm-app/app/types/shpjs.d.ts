declare module "shpjs" {
    import type {
        FeatureCollection,
        GeoJsonProperties,
        Geometry,
    } from "geojson"

    export function parseShp(
        shp: ArrayBuffer,
        shx?: ArrayBuffer,
    ): Promise<Geometry[]>

    export function parseDbf<T extends GeoJsonProperties = GeoJsonProperties>(
        dbf: ArrayBuffer,
        cpg?: ArrayBuffer | string,
    ): Promise<T[]>

    export function combine<
        TGeometry extends Geometry = Geometry,
        TProperties extends GeoJsonProperties = GeoJsonProperties,
    >(
        input: [TGeometry[], TProperties[]],
    ): FeatureCollection<TGeometry, TProperties>
}
