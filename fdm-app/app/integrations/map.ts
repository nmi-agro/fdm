import type { StyleSpecification } from "maplibre-gl"
import { clientConfig } from "@/app/lib/config"

export function getMapStyle(variant: "satellite" | "standard"): string | StyleSpecification {
  const { provider, maptilerKey } = clientConfig.integrations.map

  if (provider === "maptiler") {
    if (maptilerKey) {
      // MapTiler styles
      if (variant === "standard") {
        return `https://api.maptiler.com/maps/streets/style.json?key=${maptilerKey}`
      }
      return `https://api.maptiler.com/maps/019aca7b-e3d9-7dc7-9b70-84318d91dc9a/style.json?key=${maptilerKey}`
    }
    console.warn("MAPTILER_API_KEY is missing, falling back to standard/satellite provider")
  }

  return getFallbackStyle(variant)
}

function getFallbackStyle(variant: "satellite" | "standard"): StyleSpecification {
  // OSM / Esri
  if (variant === "standard") {
    return {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "&copy; OpenStreetMap Contributors",
        },
      },
      layers: [
        {
          id: "osm",
          type: "raster",
          source: "osm",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    }
  }

  // Esri Satellite
  return {
    version: 8,
    sources: {
      "esri-satellite": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution:
          "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
      },
    },
    layers: [
      {
        id: "esri-satellite",
        type: "raster",
        source: "esri-satellite",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  }
}
