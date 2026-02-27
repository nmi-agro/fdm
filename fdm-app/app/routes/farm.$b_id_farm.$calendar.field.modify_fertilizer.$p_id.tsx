import { useLoaderData, useNavigate } from "react-router"
import { FertilizerApplicationListDialog } from "~/components/blocks/fertilizer-applications/dialog"
import type { Route as UpstreamRoute } from "./+types/farm.$b_id_farm.$calendar.rotation.modify_fertilizer.$p_id"
import {
    action as originalAction,
    loader as originalLoader,
} from "./farm.$b_id_farm.$calendar.rotation.modify_fertilizer.$p_id"

export async function loader(props: UpstreamRoute.LoaderArgs) {
    return originalLoader(props)
}

export default function FertilizerApplicationListDialogRoute() {
    const {
        isForRotation,
        numFields,
        fertilizer,
        fertilizerApplications,
        returnUrl,
    } = useLoaderData<typeof originalLoader>()

    const navigate = useNavigate()

    return (
        <FertilizerApplicationListDialog
            isForRotation={isForRotation}
            numFields={numFields}
            fertilizer={fertilizer}
            fertilizerApplications={fertilizerApplications}
            returnUrl={returnUrl}
            onClose={() => navigate("..")}
        />
    )
}

export async function action(props: UpstreamRoute.ActionArgs) {
    return originalAction(props)
}
