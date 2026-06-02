import type { ActionFunctionArgs } from "react-router"
import type { BcsScores } from "~/components/blocks/soil-visual/bcs-color-utils"
import { getSession } from "~/lib/auth.server"
import { deriveBcsScores } from "~/lib/bcs-derived.server"
import { computeBcs } from "~/lib/bcs.server"
import { fdm } from "~/lib/fdm.server"

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 })
    }

    const body = (await request.json()) as {
        scores: BcsScores
        b_id: string
        samplingDate: string
    }

    const session = await getSession(request)
    const { labContext } = await deriveBcsScores(
        fdm,
        session.principal_id,
        body.b_id,
        new Date(body.samplingDate),
    )
    const result = computeBcs(body.scores, labContext ?? undefined)
    return Response.json(result)
}
