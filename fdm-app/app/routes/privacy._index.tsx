import type { LoaderFunction } from "react-router"
import { serverConfig } from "~/lib/config.server"

export const loader: LoaderFunction = async () => {
    const privacyUrl = serverConfig.privacy_url

    if (!privacyUrl || privacyUrl === "undefined") {
        return new Response("Privacy policy not configured", { status: 404 })
    }

    let response: Response
    try {
        response = await fetch(privacyUrl)
    } catch {
        return new Response("Failed to fetch privacy policy", { status: 502 })
    }

    if (!response.ok) {
        return new Response("Failed to fetch privacy policy", {
            status: response.status,
        })
    }

    const headers = new Headers()
    const contentType = response.headers.get("content-type")
    const contentDisposition = response.headers.get("content-disposition")
    if (contentType) headers.set("content-type", contentType)
    if (contentDisposition) headers.set("content-disposition", contentDisposition)

    return new Response(response.body, {
        status: 200,
        headers,
    })
}
