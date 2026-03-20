import { PassThrough } from "node:stream"
import { createReadableStreamFromReadable } from "@react-router/node"
/**
 * By default, Remix will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.server
 */
import {
    getMetaTagTransformer,
    wrapSentryHandleRequest,
} from "@sentry/react-router"
import { isbot } from "isbot"
import { renderToPipeableStream } from "react-dom/server"
import type {
    AppLoadContext,
    EntryContext,
    HandleErrorFunction,
} from "react-router"
import { ServerRouter } from "react-router"
import { reportError } from "~/lib/error"
import { addSecurityHeaders, getCacheControlHeaders } from "./lib/cache.server"

export const streamTimeout = 90000

const handleRequest = async function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    reactRouterContext: EntryContext,
    // This is ignored so we can keep it in the template for visibility.  Feel
    // free to delete this parameter in your app if you're not using it!
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _loadContext: AppLoadContext,
): Promise<Response> {
    const url = new URL(request.url)
    const { hostname } = url

    // Don't redirect for the dev subdomain
    if (hostname.startsWith("dev.")) {
        // Continue with the request
    } else {
        const parts = hostname.split(".")
        // Redirect if there is a subdomain (more than 2 parts for .com, .nl, etc.)
        if (parts.length > 2) {
            const rootDomain = parts.slice(-2).join(".")
            url.hostname = rootDomain
            return new Response(null, {
                status: 301,
                headers: {
                    Location: url.toString(),
                },
            })
        }
    }

    // Add cache control headers based on the request path
    const cacheHeaders = getCacheControlHeaders(request, reactRouterContext)
    cacheHeaders.forEach((value, key) => {
        responseHeaders.set(key, value)
    })

    // Add security headers
    addSecurityHeaders(responseHeaders)

    return isbot(request.headers.get("user-agent") || "")
        ? handleBotRequest(
              request,
              responseStatusCode,
              responseHeaders,
              reactRouterContext,
          )
        : handleBrowserRequest(
              request,
              responseStatusCode,
              responseHeaders,
              reactRouterContext,
          )
}

function handleBotRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    reactRouterContext: EntryContext,
): Promise<Response> {
    return new Promise((resolve, reject) => {
        let shellRendered = false
        let currentStatus = responseStatusCode
        const { pipe, abort } = renderToPipeableStream(
            <ServerRouter context={reactRouterContext} url={request.url} />,
            {
                onAllReady() {
                    shellRendered = true
                    const body = new PassThrough()
                    const stream = createReadableStreamFromReadable(body)

                    responseHeaders.set("Content-Type", "text/html")
                    responseHeaders.set("Vary", "User-Agent")

                    resolve(
                        new Response(stream, {
                            headers: responseHeaders,
                            status: currentStatus,
                        }),
                    )

                    pipe(body)
                },
                onShellError(error: unknown) {
                    reject(error)
                },
                onError(error: unknown) {
                    currentStatus = 500
                    // Log streaming rendering errors from inside the shell.  Don't log
                    // errors encountered during initial shell rendering since they'll
                    // reject and get logged in handleDocumentRequest.
                    if (shellRendered) {
                        reportError(error, { scope: "streaming-bot" })
                    }
                },
            },
        )

        setTimeout(abort, streamTimeout + 1000)
    })
}

function handleBrowserRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    reactRouterContext: EntryContext,
): Promise<Response> {
    return new Promise((resolve, reject) => {
        let shellRendered = false
        let currentStatus = responseStatusCode
        const { pipe, abort } = renderToPipeableStream(
            <ServerRouter context={reactRouterContext} url={request.url} />,
            {
                onShellReady() {
                    shellRendered = true
                    const body = new PassThrough()
                    const stream = createReadableStreamFromReadable(body)

                    responseHeaders.set("Content-Type", "text/html")
                    responseHeaders.set("Vary", "User-Agent")

                    resolve(
                        new Response(stream, {
                            headers: responseHeaders,
                            status: currentStatus,
                        }),
                    )

                    // this enables distributed tracing between client and server
                    pipe(getMetaTagTransformer(body))
                },
                onShellError(error: unknown) {
                    reject(error)
                },
                onError(error: unknown) {
                    currentStatus = 500
                    // Log streaming rendering errors from inside the shell.  Don't log
                    // errors encountered during initial shell rendering since they'll
                    // reject and get logged in handleDocumentRequest.
                    if (shellRendered) {
                        reportError(error, { scope: "streaming" })
                    }
                },
            },
        )

        setTimeout(abort, streamTimeout + 1000)
    })
}

// wrap the default export
export default wrapSentryHandleRequest(handleRequest)

export const handleError: HandleErrorFunction = (error, { request }) => {
    // React Router may abort some interrupted requests, report those
    if (!request.signal.aborted) {
        reportError(error, { scope: "unhandled" })
    }
}
