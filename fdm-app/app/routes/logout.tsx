import { type ActionFunctionArgs, redirect } from "react-router"
import { auth } from "~/lib/auth.server"

/**
 * Signs the user out and redirects to the sign-in page.
 *
 * Delegates to better-auth's `signOut` endpoint, which reads the session cookie from the request
 * itself, deletes the corresponding session server-side, and clears the session cookie — unlike
 * `revokeSession`, it does not throw if the session was already invalid or missing, so a stale or
 * double-submitted logout can never leave the user stuck on an error page with a lingering cookie.
 * Any `Set-Cookie` header from the auth response is forwarded onto the redirect so the browser
 * still clears the cookie even on this success path. If `signOut` itself throws for an unexpected
 * reason, we fall back to a plain redirect rather than surfacing an error for what is, from the
 * user's perspective, just a logout.
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
    console.warn("Logout failed; redirecting to sign-in anyway:", error)
    return redirect("/signin")
  }
}
