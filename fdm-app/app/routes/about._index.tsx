import { redirect } from "react-router"

export async function loader() {
  // Redirect to whats-new page
  return redirect("./whats-new")
}
