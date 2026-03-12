import type { ActionFunction, LoaderFunction } from "react-router"
import { serverConfig } from "~/lib/config.server"

const MAX_BODY_SIZE = 1 * 1024 * 1024 // 1MB limit

const sentryTunnel = async (request: Request) => {
    if (!serverConfig.analytics.sentry?.dsn) {
        return new Response(null, { status: 204 })
    }

    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 })
    }

    // Validate request size
    const contentLength = request.headers.get("content-length")
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_BODY_SIZE) {
        return new Response("Request too large", { status: 413 })
    }

    let body: string
    try {
        body = await request.text()
    } catch {
        return new Response("Failed to read request body", { status: 400 })
    }

    // The Sentry envelope format: first line is the envelope header JSON
    const envelopeHeader = body.split("\n")[0]
    let dsn: string
    try {
        const parsed = JSON.parse(envelopeHeader)
        dsn = parsed.dsn
        if (!dsn) throw new Error("No DSN in envelope header")
    } catch {
        return new Response("Invalid envelope header", { status: 400 })
    }

    // Validate the DSN matches our configured DSN to prevent proxy abuse
    const configuredDsn = serverConfig.analytics.sentry.dsn
    if (dsn !== configuredDsn) {
        return new Response("DSN mismatch", { status: 403 })
    }

    // Parse the DSN to build the upstream Sentry URL
    let dsnUrl: URL
    try {
        dsnUrl = new URL(dsn)
    } catch {
        return new Response("Invalid DSN format", { status: 400 })
    }

    const projectId = dsnUrl.pathname.replace(/^\//, "")
    const upstreamUrl = `https://${dsnUrl.hostname}/api/${projectId}/envelope/`

    let response: Response
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
        const controller = new AbortController()
        timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        const upstreamHeaders = new Headers({
            "Content-Type": "application/x-sentry-envelope",
            "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${dsnUrl.username}`,
        })

        const xForwardedFor = request.headers.get("x-forwarded-for")
        if (xForwardedFor) {
            const clientIp = xForwardedFor.split(",")[0].trim()
            upstreamHeaders.set("X-Forwarded-For", xForwardedFor)
            upstreamHeaders.set("X-Real-IP", clientIp)
        }

        response = await fetch(upstreamUrl, {
            method: "POST",
            headers: upstreamHeaders,
            body,
            signal: controller.signal,
        })
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            console.error("Sentry tunnel timeout after 10s")
            return new Response("Sentry tunnel timeout", {
                status: 504,
                statusText: "Gateway Timeout",
            })
        }
        console.error("Sentry tunnel error:", error)
        return new Response("Service unavailable", {
            status: 503,
            statusText: "Sentry tunnel error",
        })
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
    }

    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete("content-encoding")
    responseHeaders.delete("content-length")

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
    })
}

export const loader: LoaderFunction = async () =>
    new Response(null, { status: 204 })

export const action: ActionFunction = async ({ request }) =>
    sentryTunnel(request)
