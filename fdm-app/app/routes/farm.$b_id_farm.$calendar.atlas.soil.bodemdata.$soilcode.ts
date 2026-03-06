import { data } from "react-router"
import type { Route } from "./+types/farm.$b_id_farm.$calendar.atlas.soil.bodemdata.$soilcode"

export async function loader({ request, params }: Route.LoaderArgs) {
    // Fetching client-side leads to CORS and CSP errors.
    // CSP issues can be resolved but CORS issues can't be without contacting Bodemdata.
    try {
        const timeoutController = new AbortController()
        const timeoutId = setTimeout(() => timeoutController.abort(), 5000)

        // Combine the request signal (navigation) with our timeout signal
        const signal = AbortSignal.any([
            timeoutController.signal,
            request.signal,
        ])

        try {
            const response = await fetch(
                `https://legenda-bodemkaart.bodemdata.nl/soilmaplegendserver/item/bodemklasse/${encodeURIComponent(params.soilcode)}`,
                { signal },
            )

            if (!response.ok) {
                return response
            }

            const json = await response.json()
            return data({ success: json.success, data: json.data })
        } finally {
            clearTimeout(timeoutId)
        }
    } catch (error) {
        if ((error as Error).name === "AbortError") {
            // If the client aborted the request, we don't need to log an error
            if (request.signal?.aborted)
                return new Response(null, { status: 499 })
        }
        console.error(error)
        return data(
            {
                success: false,
                error: error ? (error as any).message : undefined,
            },
            { status: 502 },
        )
    }
}
