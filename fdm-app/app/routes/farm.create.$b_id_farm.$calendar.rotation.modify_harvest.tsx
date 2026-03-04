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
    return originalLoader(props)
}

export default ModifyHarvest

export async function action(props: UpstreamRoute.ActionArgs) {
    return originalAction(props)
}
