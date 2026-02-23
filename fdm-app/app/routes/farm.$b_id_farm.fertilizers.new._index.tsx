import { type Fertilizer, getFertilizers } from "@nmi-agro/fdm-core"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router"
import {
    BasedOffFertilizerButton,
    CustomFertilizerButton,
} from "~/components/blocks/fertilizer/new-fertilizer"
import { getSession } from "~/lib/auth.server"
import { fdm } from "~/lib/fdm.server"

export async function loader({ request, params }: LoaderFunctionArgs) {
    const { b_id_farm } = params
    if (!b_id_farm) {
        throw new Error("Farm ID is required")
    }

    const session = await getSession(request)

    const fertilizers = await getFertilizers(
        fdm,
        session.principal_id,
        b_id_farm,
    )

    return { b_id_farm: b_id_farm, fertilizers: fertilizers }
}

/**
 * Renders the new fertilizer wizard start page
 *
 * This component includes a button that can be used to fill everything from scratch.
 * Below that it includes a button for each existing fertilizer which the user can click to fill in the new fertilizer form values on the next page based on the corresponding fertilizer.
 */
export default function NewFertilizerIndexPage() {
    const { fertilizers } = useLoaderData()

    return (
        <div className="space-y-4">
            <CustomFertilizerButton />
            <h2 className="text-xl font-bold">Of baseer op een meststof</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {fertilizers.map((fertilizer: Fertilizer) => (
                    <BasedOffFertilizerButton
                        key={fertilizer.p_id}
                        fertilizer={fertilizer}
                    />
                ))}
            </div>
        </div>
    )
}
