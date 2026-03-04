import type { ActionFunctionArgs } from "react-router"
import { extractBulkSoilAnalyses } from "~/integrations/nmi"
import { getSession } from "~/lib/auth.server"

/**
 * API Route: Bulk Soil Analysis Extraction
 *
 * WHY THIS EXISTS:
 * This is a standalone API route instead of being handled in the page action because
 * bulk uploads (50+ files) require high concurrency. Sending many small parallel
 * requests to a standard React Router action causes "Session Locking" in the database
 * (Better Auth), leading to 401/302 redirects.
 *
 * THIS SOLUTION:
 * 1. The browser sends ALL files in a single POST request (one session check).
 * 2. The server processes these files in parallel (concurrency limit 10).
 * 3. Results are streamed back as NDJSON (Newline Delimited JSON).
 * 4. This allows the frontend to update the progress bar and file name for every
 *    single file in real-time while maintaining maximum performance.
 */

export async function action({ request }: ActionFunctionArgs) {
    // Single session check for the entire bulk operation
    const session = await getSession(request)
    if (!session) {
        return new Response("Unauthorized", { status: 401 })
    }

    const formData = await request.formData()
    const files = (formData.getAll("soilAnalysisFile") as File[]).filter(
        (f) => f instanceof File && f.name,
    )

    if (files.length === 0) {
        return new Response(JSON.stringify({ error: "No files uploaded" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        async start(controller) {
            let nextIndex = 0
            const concurrency = 10

            const workers = Array.from(
                { length: Math.min(concurrency, files.length) },
                async () => {
                    while (nextIndex < files.length) {
                        const file = files[nextIndex++]
                        if (!file) continue

                        try {
                            // Create a minimal FormData for a single file extraction
                            const singleFileFormData = new FormData()
                            singleFileFormData.append("soilAnalysisFile", file)

                            const analyses =
                                await extractBulkSoilAnalyses(
                                    singleFileFormData,
                                )

                            controller.enqueue(
                                encoder.encode(
                                    `${JSON.stringify({
                                        success: true,
                                        filename: file.name,
                                        analyses,
                                    })}\n`,
                                ),
                            )
                        } catch (err) {
                            controller.enqueue(
                                encoder.encode(
                                    `${JSON.stringify({
                                        success: false,
                                        filename: file.name,
                                        error:
                                            err instanceof Error
                                                ? err.message
                                                : "Analyse mislukt",
                                    })}\n`,
                                ),
                            )
                        }
                    }
                },
            )

            await Promise.all(workers)
            controller.close()
        },
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "application/x-ndjson",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    })
}
