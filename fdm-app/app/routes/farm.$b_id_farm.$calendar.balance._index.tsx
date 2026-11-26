import { redirect } from "react-router"
import type { HelpHandle } from "~/lib/manual/help-targets"

export const handle: HelpHandle = { help: "balansen" }

export async function loader() {
  // Redirect to nitrogen page
  return redirect("./nitrogen")
}
