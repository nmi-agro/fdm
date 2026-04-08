import { type LoaderFunctionArgs, redirect } from "react-router"
import {
    createConfiguredRvoClient,
    getRvoCredentials,
    parseRvoState,
    rvoStateCookie,
    rvoTokenCookie,
} from "~/integrations/rvo.server"
import { exchangeToken } from "~/lib/rvo.server"

/**
 * Dedicated OAuth callback route for RVO eHerkenning.
 *
 * RVO redirects here after the user completes eHerkenning login. This route:
 * 1. Verifies the CSRF state parameter against the signed cookie
 * 2. Exchanges the authorization code for an access token
 * 3. Stores the access token in a short-lived signed cookie
 * 4. Redirects to the originating RVO page (decoded from the state payload)
 *
 * The originating page reads the token cookie, calls rvoClient.setAccessToken(),
 * and proceeds to fetch the user's RVO fields.
 */
export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")

    if (!code || !state) {
        throw new Response("Ontbrekende code of state parameter", {
            status: 400,
        })
    }

    // Verify CSRF state and decode returnUrl + farmId
    const { returnUrl } = await parseRvoState(request, state)

    const rvoCredentials = getRvoCredentials()
    if (!rvoCredentials) {
        throw new Response("RVO client is not configured.", { status: 500 })
    }

    const rvoClient = createConfiguredRvoClient(rvoCredentials)

    let accessToken: string
    try {
        accessToken = await exchangeToken(rvoClient, code)
    } catch (e: any) {
        const originalError = e?.message || ""
        if (
            originalError.includes("invalid_grant") ||
            originalError.includes("expired")
        ) {
            throw new Response(
                "De eHerkenning sessie is verlopen. Klik op 'Verbinden met RVO' om opnieuw te verbinden.",
                { status: 401 },
            )
        }
        throw e
    }

    // Store access token in a short-lived signed cookie; clear the state cookie
    const tokenCookieHeader = await rvoTokenCookie.serialize(accessToken)
    const clearedStateCookieHeader = await rvoStateCookie.serialize("", {
        maxAge: 0,
    })

    return redirect(returnUrl || "/", {
        headers: [
            ["Set-Cookie", tokenCookieHeader],
            ["Set-Cookie", clearedStateCookieHeader],
        ],
    })
}
