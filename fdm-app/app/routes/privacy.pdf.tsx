import type { LoaderFunction } from "react-router"
import { serverConfig } from "~/lib/config.server"

export const loader: LoaderFunction = async () => {
    const privacyUrl = serverConfig.privacy_url

    if (!privacyUrl || privacyUrl === "undefined") {
        return new Response("Privacy policy not configured", { status: 404 })
    }

    let response: Response
    try {
        response = await fetch(privacyUrl, {
            signal: AbortSignal.timeout(5000),
        })
    } catch (error) {
        const message =
            error instanceof DOMException && error.name === "TimeoutError"
                ? "Privacy policy request timed out"
                : "Failed to fetch privacy policy"
        return new Response(message, { status: 502 })
    }

    if (!response.ok) {
        return new Response("Failed to fetch privacy policy", { status: 502 })
    }

    if (response.body === null) {
        return new Response("Privacy policy returned empty body", {
            status: 500,
        })
    }

    const headers = new Headers()
    const contentType = response.headers.get("content-type")
    const contentDisposition = response.headers.get("content-disposition")
    if (contentType) headers.set("content-type", contentType)
    if (contentDisposition)
        headers.set("content-disposition", contentDisposition)

    return new Response(response.body, {
        status: 200,
        headers,
    })
}
