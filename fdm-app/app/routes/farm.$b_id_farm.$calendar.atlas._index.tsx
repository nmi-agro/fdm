import { redirect } from "react-router"

export async function loader() {
  // Redirect to farm fields page
  return redirect("./fields")
}
