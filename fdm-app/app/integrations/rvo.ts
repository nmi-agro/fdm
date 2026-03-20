import { serverConfig } from "../lib/config.server"
import { createCookie } from "react-router"
import { nanoid } from "nanoid"
import { createRvoClient } from "@nmi-agro/fdm-rvo"
import { isOfOrigin } from "../lib/url-utils"

const sessionSecret = serverConfig.auth.fdm_session_secret
if (!sessionSecret?.trim() || sessionSecret === "undefined") {
    throw new Error(
        "FDM_SESSION_SECRET is missing or invalid. Cannot initialize RVO state cookie.",
    )
}

export const rvoStateCookie = createCookie("rvo_state", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600, // 1 hour
    secrets: [sessionSecret],
})

/**
 * Generates a signed OAuth state with a random nonce.
 * @returns { state, cookieHeader } The base64 state string and the serialized cookie header.
 */
export async function createRvoState(farmId: string, returnUrl: string) {
    const appOrigin = new URL(serverConfig.url).origin
    const safeReturnUrl = isOfOrigin(returnUrl, appOrigin) ? returnUrl : "/"

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

export function getRvoCredentials(): RvoCredentials | undefined {
    // Check if RVO is configured
    const { clientId, clientSecret, redirectUri, clientName, pkioPrivateKey } =
        serverConfig.integrations.rvo
    const isValid = (v: string) => !!v?.trim() && v !== "undefined"
    const rvoConfigured =
        isValid(clientId) &&
        isValid(clientSecret) &&
        isValid(redirectUri) &&
        isValid(clientName) &&
        isValid(pkioPrivateKey)
    if (!rvoConfigured) {
        return undefined
    }

    return {
        clientId,
        clientSecret,
        redirectUri,
        clientName,
        pkioPrivateKey,
    }
}

type RvoCredentials = {
    clientId: string
    clientSecret: string
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
