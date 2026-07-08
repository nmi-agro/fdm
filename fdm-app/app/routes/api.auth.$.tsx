import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { auth } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"

export const meta: MetaFunction = () => {
  return [
    { title: `Authenticatie | ${clientConfig.name}` },
    {
      name: "description",
      content: "Beveiligde authenticatie voor toegang tot het platform.",
    },
  ]
}

/**
 * Processes an incoming HTTP request for authentication and handles errors.
 *
 * This asynchronous function attempts to process the request by calling the authentication handler. If an error is thrown
 * during processing, it catches the error and returns an appropriate error response.
 *
 * @param request - The HTTP request extracted from LoaderFunctionArgs.
 * @returns The result of the authentication handler, or an error response if an error occurs.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    return auth.handler(request)
  } catch (error) {
    return handleLoaderError(error)
  }
}

/**
 * Processes an authentication request for the action route.
 *
 * This function calls the authentication handler with the incoming request and returns its outcome.
 * If an error occurs during authentication, the function catches it and passes the error to the
 * action error handler to produce an appropriate response.
 *
 * @returns A promise that resolves to either the authentication result or an error response.
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    return auth.handler(request)
  } catch (error) {
    return handleActionError(error)
  }
}
