import { nanoid } from "nanoid"
import { createCookie } from "react-router"
import { z } from "zod"
import { serverConfig } from "~/lib/config.server"
import { createRvoClient, type RvoLogXml } from "~/lib/rvo.server"

/**
 * Whose RVO data the user requests.
 *
 * - `own_farm`: the user logs in with the eHerkenning of the farm itself. The KvK number is not
 *   sent to RVO; RVO derives the farm from the authenticated identity.
 * - `machtiging`: the user logs in with the eHerkenning of their own organisation and holds a
 *   machtiging at RVO for the farm. The farm's KvK number is sent as `ThirdPartyFarmID`.
 */
export const RvoRequestModeSchema = z.enum(["own_farm", "machtiging"])
export type RvoRequestMode = z.infer<typeof RvoRequestModeSchema>

/** Mode used when an older state or token cookie does not contain a mode. */
const DEFAULT_RVO_REQUEST_MODE: RvoRequestMode = "machtiging"

function parseRvoRequestMode(value: unknown): RvoRequestMode {
  const result = RvoRequestModeSchema.safeParse(value)
  return result.success ? result.data : DEFAULT_RVO_REQUEST_MODE
}

/**
 * Returns the message shown when RVO denies access to the requested farm data (`EDI009`).
 * The likely cause differs per request mode.
 * @param mode The eHerkenning the user chose to log in with.
 * @param farmName Name of the farm the fields are imported into, if known.
 */
export function getRvoPermissionDeniedMessage(
  mode: RvoRequestMode,
  farmName?: string | null,
): string {
  const farm = farmName?.trim() || "dit bedrijf"
  if (mode === "own_farm") {
    return `RVO heeft de toegang geweigerd. Controleer of u bent ingelogd met de eHerkenning van ${farm}. Logt u in met de eHerkenning van uw eigen organisatie? Kies dan die optie en probeer het opnieuw.`
  }
  // FARM_VERIFICATION_HIDDEN: re-enable when farmers can verify their own farm
  // return "U heeft met deze eHerkenning geen machtiging voor dit KvK-nummer bij RVO. Dit bedrijf kon daarom niet worden geverifieerd."
  return `De eHerkenning waarmee u bent ingelogd heeft bij RVO geen machtiging voor ${farm}. Controleer de machtiging bij RVO en het KvK-nummer van dit bedrijf. Logt u in met de eHerkenning van ${farm} zelf? Kies dan die optie en probeer het opnieuw.`
}

const sessionSecret = serverConfig.auth.fdm_session_secret
if (!sessionSecret?.trim() || sessionSecret === "undefined") {
  throw new Error("FDM_SESSION_SECRET is missing or invalid. Cannot initialize RVO state cookie.")
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
 * Short-lived cookie that carries the RVO access token and the request mode from the callback
 * route to the originating RVO page. Expires in 60 seconds to minimise exposure.
 * Use {@link serializeRvoToken} and {@link parseRvoToken} to read and write it.
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
 * Serializes the RVO access token and the request mode into the signed `rvo_token` cookie.
 * @returns The `Set-Cookie` header value.
 */
export async function serializeRvoToken(accessToken: string, mode: RvoRequestMode) {
  return await rvoTokenCookie.serialize({ accessToken, mode })
}

/**
 * Reads the RVO access token and the request mode from the signed `rvo_token` cookie.
 * A cookie that only contains the access token is read with the `machtiging` mode.
 * @returns The access token and mode, or `null` when the cookie is missing or empty.
 */
export async function parseRvoToken(
  cookieHeader: string | null,
): Promise<{ accessToken: string; mode: RvoRequestMode } | null> {
  const value: unknown = await rvoTokenCookie.parse(cookieHeader)
  if (typeof value === "string") {
    return value ? { accessToken: value, mode: DEFAULT_RVO_REQUEST_MODE } : null
  }
  if (value && typeof value === "object" && "accessToken" in value) {
    const { accessToken, mode } = value as { accessToken: unknown; mode?: unknown }
    if (typeof accessToken === "string" && accessToken) {
      return { accessToken, mode: parseRvoRequestMode(mode) }
    }
  }
  return null
}

/**
 * Generates a signed OAuth state with a random nonce.
 * @param farmId The farm the RVO data is requested for.
 * @param returnUrl The page to return to after the callback.
 * @param mode Whose RVO data the user requests; carried through the OAuth round trip.
 * @returns { state, cookieHeader } The base64 state string and the serialized cookie header.
 */
export async function createRvoState(farmId: string, returnUrl: string, mode: RvoRequestMode) {
  // Store path-only to avoid fragile origin comparisons and prevent open redirects.
  // isOfOrigin returns true for root-relative paths, so no origin check needed.
  // request.url is always an absolute URL, so new URL() is safe here.
  const safeReturnUrl = returnUrl.startsWith("/") ? returnUrl : new URL(returnUrl).pathname || "/"

  const nonce = nanoid()
  const state = Buffer.from(
    JSON.stringify({
      farmId,
      returnUrl: safeReturnUrl,
      mode,
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
    const decodedState = JSON.parse(Buffer.from(stateFromUrl, "base64").toString("utf-8"))
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
    const decodedState = JSON.parse(Buffer.from(stateFromUrl, "base64").toString("utf-8")) as {
      farmId: string
      returnUrl: string
      mode?: unknown
      nonce: string
    }
    return { ...decodedState, mode: parseRvoRequestMode(decodedState.mode) }
  } catch {
    throw new Response("Ongeldig state formaat", { status: 400 })
  }
}

export function getRvoCredentials(): RvoCredentials | undefined {
  const { clientId, redirectUri, clientName, pkioPrivateKey, logXml } =
    serverConfig.integrations.rvo
  const isValid = (v: string) => !!v?.trim() && v !== "undefined"
  const rvoConfigured =
    isValid(clientId) && isValid(redirectUri) && isValid(clientName) && isValid(pkioPrivateKey)
  if (!rvoConfigured) {
    return undefined
  }

  return {
    clientId,
    redirectUri,
    clientName,
    pkioPrivateKey,
    logXml,
  }
}

type RvoCredentials = {
  clientId: string
  redirectUri: string
  clientName: string
  pkioPrivateKey: string
  logXml: RvoLogXml
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
    credentials.logXml,
  )
}
