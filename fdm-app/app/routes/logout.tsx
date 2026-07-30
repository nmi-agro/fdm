import { type ActionFunctionArgs, redirect } from "react-router"
import { auth, getSession } from "~/lib/auth.server"
import { handleActionError } from "~/lib/error"

/**
 * Revokes the user session and redirects to the sign-in page.
 *
 * This function retrieves the current session from the provided HTTP request and attempts to revoke it through the
 * authentication API. On successful revocation, it returns a redirect response to the sign-in route. Any error during
 * session retrieval or revocation is caught, processed by the error handler, and re-thrown.
 *
 * @param request - The HTTP request containing session and header data.
 * @returns A redirect response to the sign-in page.
 *
 * @throws {Error} If an error occurs while retrieving or revoking the session.
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get the session
    const session = await getSession(request)

    // Revoke the session
    // Revoke the session
    await auth.api.revokeSession({
      headers: request.headers,
      body: {
        token: session?.session?.token ?? "",
      },
    })
    return redirect("/signin")
  } catch (error) {
    return handleActionError(error)
  }
}
