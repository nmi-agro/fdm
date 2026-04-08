import { nanoid } from "nanoid"
import { createCookie } from "react-router"
import { createRvoClient } from "~/lib/rvo.server"
import { serverConfig } from "~/lib/config.server"

const sessionSecret = serverConfig.auth.fdm_session_secret
if (!sessionSecret?.trim() || sessionSecret === "undefined") {
    throw new Error(
        "FDM_SESSION_SECRET is missing or invalid. Cannot initialize RVO state cookie.",
    )
}

export const rvoStateCookie = createCookie("rvo_state", {
    path: "/",
    httpOnly: true,
    // "lax" is required (not "strict"): the OAuth callback is a cross-site
    // top-level redirect from RVO back to our app, and "strict" would suppress
    // the cookie, breaking CSRF verification for every user.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600, // 1 hour
    secrets: [sessionSecret],
})

/**
 * Short-lived cookie that carries the RVO access token from the callback route
 * to the originating RVO page. Expires in 60 seconds to minimise exposure.
 */
export const rvoTokenCookie = createCookie("rvo_token", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60, // 60 seconds — consumed immediately by the rvo page loader
    secrets: [sessionSecret],
})

/**
 * Generates a signed OAuth state with a random nonce.
 * @returns { state, cookieHeader } The base64 state string and the serialized cookie header.
 */
export async function createRvoState(farmId: string, returnUrl: string) {
    // Store path-only to avoid fragile origin comparisons and prevent open redirects.
    // isOfOrigin returns true for root-relative paths, so no origin check needed.
    // request.url is always an absolute URL, so new URL() is safe here.
    const safeReturnUrl = returnUrl.startsWith("/")
        ? returnUrl
        : new URL(returnUrl).pathname || "/"

    const nonce = nanoid()
    const state = Buffer.from(
        JSON.stringify({
            farmId,
            returnUrl: safeReturnUrl,
            nonce,
        }),
    ).toString("base64")

    return {
        state,
        cookieHeader: await rvoStateCookie.serialize(state),
    }
}

/**
 * Verifies the OAuth state against the signed cookie and ensures the farm ID matches.
 * @throws {Response} 403 if CSRF or farm ID validation fails.
 */
export async function verifyRvoState(
    request: Request,
    stateFromUrl: string,
    expectedFarmId: string,
) {
    const cookieHeader = request.headers.get("Cookie")
    const stateFromCookie = await rvoStateCookie.parse(cookieHeader)

    if (!stateFromCookie || stateFromCookie !== stateFromUrl) {
        throw new Response("Ongeldige state parameter (CSRF)", {
            status: 403,
        })
    }

    try {
        const decodedState = JSON.parse(
            Buffer.from(stateFromUrl, "base64").toString("utf-8"),
        )
        if (decodedState.farmId !== expectedFarmId) {
            throw new Response("Ongeldig bedrijfs-ID in state", {
                status: 403,
            })
        }
        return decodedState
    } catch (e) {
        if (e instanceof Response) throw e
        throw new Response("Ongeldig state formaat", { status: 400 })
    }
}

/**
 * Verifies the OAuth CSRF state and decodes the payload.
 * Used by the dedicated `/callback/rvo` route where the farmId is decoded from the
 * state itself rather than being known upfront.
 * @throws {Response} 403 if the CSRF check fails, 400 if the state cannot be decoded.
 */
export async function parseRvoState(request: Request, stateFromUrl: string) {
    const cookieHeader = request.headers.get("Cookie")
    const stateFromCookie = await rvoStateCookie.parse(cookieHeader)

    if (!stateFromCookie || stateFromCookie !== stateFromUrl) {
        throw new Response("Ongeldige state parameter (CSRF)", {
            status: 403,
        })
    }

    try {
        const decodedState = JSON.parse(
            Buffer.from(stateFromUrl, "base64").toString("utf-8"),
        ) as { farmId: string; returnUrl: string; nonce: string }
        return decodedState
    } catch {
        throw new Response("Ongeldig state formaat", { status: 400 })
    }
}

export function getRvoCredentials(): RvoCredentials | undefined {
    const { clientId, redirectUri, clientName, pkioPrivateKey } =
        serverConfig.integrations.rvo
    const isValid = (v: string) => !!v?.trim() && v !== "undefined"
    const rvoConfigured =
        isValid(clientId) &&
        isValid(redirectUri) &&
        isValid(clientName) &&
        isValid(pkioPrivateKey)
    if (!rvoConfigured) {
        return undefined
    }

    return {
        clientId,
        redirectUri,
        clientName,
        pkioPrivateKey,
    }
}

type RvoCredentials = {
    clientId: string
    redirectUri: string
    clientName: string
    pkioPrivateKey: string
}

/**
 * Creates an RvoClient configured from the given credentials and the current NODE_ENV.
 */
export function createConfiguredRvoClient(credentials: RvoCredentials) {
    return createRvoClient(
        credentials.clientId,
        credentials.clientName,
        credentials.redirectUri,
        credentials.pkioPrivateKey,
        process.env.NODE_ENV === "production" ? "production" : "acceptance",
    )
}
