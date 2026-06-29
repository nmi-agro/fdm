import { type MetaFunction, redirect } from "react-router"
import { clientConfig } from "~/lib/config"

// Meta
export const meta: MetaFunction = () => {
  return [
    { title: `Instellingen - Bedrijf | ${clientConfig.name}` },
    {
      name: "description",
      content: "Bekijk en bewerk de instellingen van je bedrijf.",
    },
  ]
}

export async function loader() {
  // Redirect to properties page
  return redirect("./properties")
}
