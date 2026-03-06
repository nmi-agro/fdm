import type { FeatureCollection } from "geojson"

let cache: { data: FeatureCollection; expires: number } | null = null
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export async function getAhnIndex(): Promise<FeatureCollection> {
    const now = Date.now()

    if (cache && cache.expires > now) {
        return cache.data
    }

    try {
        const response = await fetch(
            "https://service.pdok.nl/rws/ahn/atom/downloads/dtm_05m/kaartbladindex.json",
            { signal: AbortSignal.timeout(30000) }, // 30 second timeout
        )

        if (!response.ok) {
            throw new Error(`Failed to fetch AHN index: ${response.statusText}`)
        }

        const data = (await response.json()) as FeatureCollection
        if (!data.features || !Array.isArray(data.features)) {
            throw new Error("Invalid AHN index format")
        }
        cache = {
            data,
            expires: now + CACHE_TTL,
        }
        return data
    } catch (error) {
        console.error(
            "Error fetching AHN index, serving stale cache if available",
            error,
        )
        if (cache) return cache.data
        throw error
    }
}
