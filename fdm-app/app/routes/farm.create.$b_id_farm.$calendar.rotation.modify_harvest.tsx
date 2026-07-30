import type { MetaFunction } from "react-router"
import { clientConfig } from "~/lib/config"
import type { Route as UpstreamRoute } from "./+types/farm.$b_id_farm.$calendar.rotation"
import ModifyHarvest, {
  action as originalAction,
  loader as originalLoader,
} from "./farm.$b_id_farm.$calendar.rotation.modify_harvest"

// Meta
export const meta: MetaFunction = () => {
  return [
    { title: `Bouwplan - Bedrijf toevoegen | ${clientConfig.name}` },
    {
      name: "description",
      content: "Beheer de gewassen op je percelen.",
    },
  ]
}

export async function loader(props: UpstreamRoute.LoaderArgs) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return originalLoader(props as any)
}

export default ModifyHarvest

export async function action(props: UpstreamRoute.ActionArgs) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return originalAction(props as any)
}
