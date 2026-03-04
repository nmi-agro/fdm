import type { Route as UpstreamRoute } from "./+types/farm.$b_id_farm.$calendar.rotation.modify_fertilizer.$p_id"
import ModifyFertilizer, {
    action as originalAction,
    loader as originalLoader,
} from "./farm.$b_id_farm.$calendar.rotation.modify_fertilizer.$p_id"

export async function loader(props: UpstreamRoute.LoaderArgs) {
    return originalLoader(props)
}

export default ModifyFertilizer

export async function action(props: UpstreamRoute.ActionArgs) {
    return originalAction(props)
}
