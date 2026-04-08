import fs from "node:fs"
import { RvoClient } from "@nmi-agro/rvo-connector"

/**
 * Creates and configures an instance of the RVO Client.
 *
 * This client is the main entry point for interacting with RVO services.
 * It handles OAuth authentication and API requests.
 *
 * @param clientId - The OAuth 2.0 Client ID issued by RVO.
 * @param clientName - A human-readable name for your application, used in logs or RVO consent screens.
 * @param redirectUri - The callback URL where RVO will redirect the user after login. Must match the registered URI.
 * @param pkioPrivateKey - The private key (PKIO) used for signing client assertions in the OAuth flow.
 * @param environment - The RVO environment to connect to. Defaults to "production". Use "acceptance" for testing.
 * @returns An initialized `RvoClient` instance ready for authentication.
 */
export const createRvoClient = (
    clientId: string,
    clientName: string,
    redirectUri: string,
    pkioPrivateKey: string,
    environment: "acceptance" | "production" = "production",
) => {
    let privateKey = pkioPrivateKey
    if (
        pkioPrivateKey.startsWith("/") ||
        pkioPrivateKey.startsWith("./") ||
        pkioPrivateKey.startsWith("../") ||
        /^[a-zA-Z]:[/\\]/.test(pkioPrivateKey)
    ) {
        if (fs.existsSync(pkioPrivateKey)) {
            privateKey = fs.readFileSync(pkioPrivateKey, "utf8")
        } else {
            throw new Error(
                `PKIO private key file not found: ${pkioPrivateKey}`,
            )
        }
    }

    return new RvoClient({
        clientId,
        clientName,
        environment,
        tvs: {
            clientId,
            redirectUri,
            pkioPrivateKey: privateKey,
        },
    })
}

/**
 * Generates the authorization URL for the RVO OAuth 2.0 flow.
 *
 * This URL is where you should redirect the user to log in with eHerkenning.
 *
 * @param rvoClient - The initialized `RvoClient` instance.
 * @param state - A unique, random string used to prevent CSRF attacks and maintain state (e.g., farm ID) across the redirect.
 * @returns The full URL to redirect the user to.
 */
export const generateAuthUrl = (rvoClient: RvoClient, state: string) => {
    return rvoClient.getAuthorizationUrl({
        state,
        services: ["opvragenBedrijfspercelen", "opvragenRegelingspercelenMest"],
    })
}

/**
 * Exchanges an authorization code for an access token.
 *
 * This function should be called in the callback route after the user returns from RVO.
 *
 * @param rvoClient - The initialized `RvoClient` instance.
 * @param code - The authorization code received in the query parameters of the callback URL.
 * @returns A promise that resolves to the `accessToken` string.
 * @throws Will throw an error if the token exchange fails (e.g., invalid code, network error).
 */
export const exchangeToken = async (rvoClient: RvoClient, code: string) => {
    const tokenResponse = await rvoClient.exchangeAuthCode(code)
    return tokenResponse.access_token
}
