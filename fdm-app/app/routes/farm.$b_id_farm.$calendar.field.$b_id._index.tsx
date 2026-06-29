import { redirect } from "react-router"

export async function loader() {
  // Redirect to overview page
  return redirect("./overview")
}
