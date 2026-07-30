import { redirect } from "react-router"

export async function loader() {
  // Redirect to nitrogen page
  return redirect("./nitrogen")
}
