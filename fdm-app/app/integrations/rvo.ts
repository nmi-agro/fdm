import { serverConfig } from "../lib/config.server"
import { createCookie } from "react-router"
import { nanoid } from "nanoid"

export const rvoStateCookie = createCookie("rvo_state", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600, // 1 hour
    secrets: [serverConfig.auth.fdm_session_secret],
})

/**
 * Generates a signed OAuth state with a random nonce.
 * @returns { state, cookieHeader } The base64 state string and the serialized cookie header.
 */
export async function createRvoState(farmId: string, returnUrl: string) {
    const nonce = nanoid()
    const state = Buffer.from(
        JSON.stringify({
            farmId,
            returnUrl,
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
    const { clientId, clientSecret } = serverConfig.integrations.rvo
    const rvoConfigured =
        !!clientId?.trim() &&
        clientId !== "undefined" &&
        !!clientSecret?.trim() &&
        clientSecret !== "undefined"
    if (!rvoConfigured) {
        return undefined
    }

    return {
        clientId: serverConfig.integrations.rvo.clientId,
        clientSecret: serverConfig.integrations.rvo.clientSecret,
        redirectUri: serverConfig.integrations.rvo.redirectUri,
        clientName: serverConfig.integrations.rvo.clientName,
    }
}

type RvoCredentials = {
    clientId: string
    clientSecret: string
    redirectUri: string
    clientName: string
}
