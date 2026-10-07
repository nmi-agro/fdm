import { data, type LoaderFunctionArgs } from "react-router"
import { getKvkClient, KVK_NUMBER_PATTERN, type KvkLookupResponse } from "~/integrations/kvk.server"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"

/**
 * Looks up a KvK number in the KvK Handelsregister and returns the farm name and
 * address. Requires a signed-in user.
 *
 * Query parameters:
 * - `kvk`: KvK number of 8 digits.
 */
export async function loader({ request }: LoaderFunctionArgs): Promise<KvkLookupResponse> {
  try {
    await getSession(request)

    const kvk = new URL(request.url).searchParams.get("kvk")?.trim() ?? ""
    if (!KVK_NUMBER_PATTERN.test(kvk)) {
      throw data("KvK-nummer moet uit 8 cijfers bestaan", { status: 400 })
    }

    const client = getKvkClient()
    if (!client) {
      return { status: "disabled" }
    }

    return await client.lookupByKvk(kvk)
  } catch (error) {
    throw handleLoaderError(error)
  }
}
