import { getCookies } from "better-auth/cookies"
import { type ActionFunctionArgs, redirect } from "react-router"
import { auth } from "~/lib/auth.server"

/**
 * Serializes a `Set-Cookie` header value that immediately expires the given cookie, using the
 * same name and attributes better-auth itself configured the cookie with (so the browser
 * recognises it as the same cookie and actually overwrites/clears it).
 */
function serializeExpiredCookie(
  name: string,
  attributes: ReturnType<typeof getCookies>["sessionToken"]["attributes"],
): string {
  const parts = [`${name}=`, "Max-Age=0"]
  if (attributes.path) parts.push(`Path=${attributes.path}`)
  if (attributes.domain) parts.push(`Domain=${attributes.domain}`)
  if (attributes.sameSite) parts.push(`SameSite=${attributes.sameSite}`)
  if (attributes.secure) parts.push("Secure")
  if (attributes.httpOnly) parts.push("HttpOnly")
  return parts.join("; ")
}

/**
 * Signs the user out and redirects to the sign-in page.
 *
 * Delegates to better-auth's `signOut` endpoint, which reads the session cookie from the request
 * itself, deletes the corresponding session server-side, and clears the session cookie — unlike
 * `revokeSession`, it does not throw if the session was already invalid or missing, so a stale or
 * double-submitted logout can never leave the user stuck on an error page with a lingering cookie.
 * Any `Set-Cookie` header from the auth response is forwarded onto the redirect so the browser
 * still clears the cookie even on this success path. If `signOut` itself throws for an unexpected
 * reason (e.g. better-auth's own middleware/adapter fails before it can clear anything), we still
 * expire the session cookies ourselves using the same names/attributes better-auth configured
 * them with, so the browser doesn't keep presenting a still-valid session cookie after a "failed"
 * logout, then redirect to sign-in rather than surfacing an error for what is, from the user's
 * perspective, just a logout.
 *
 * @param request - The HTTP request containing session and header data.
 * @returns A redirect response to the sign-in page.
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    const response = await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    })

    // `signOut` expires several cookies (session token, session data, oauth state, ...), so there
    // can be more than one `Set-Cookie` header. `Headers#get` would incorrectly join them with a
    // comma, corrupting the cookie syntax — `getSetCookie()` preserves them as separate values.
    const setCookies = response.headers.getSetCookie()
    const headers = new Headers()
    for (const setCookie of setCookies) {
      headers.append("Set-Cookie", setCookie)
    }
    return redirect("/signin", { headers })
  } catch (error) {
    console.warn("Logout failed; clearing session cookies manually and redirecting anyway:", error)
    const headers = new Headers()
    const cookies = getCookies(auth.options)
    for (const cookie of [cookies.sessionToken, cookies.sessionData]) {
      headers.append("Set-Cookie", serializeExpiredCookie(cookie.name, cookie.attributes))
    }
    return redirect("/signin", { headers })
  }
}
