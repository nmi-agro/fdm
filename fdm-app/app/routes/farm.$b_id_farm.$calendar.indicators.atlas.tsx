import { type LoaderFunctionArgs, redirect } from "react-router"

export async function loader({ params }: LoaderFunctionArgs) {
  const { b_id_farm, calendar } = params
  return redirect(`/farm/${b_id_farm}/${calendar}/atlas/indicators`)
}
