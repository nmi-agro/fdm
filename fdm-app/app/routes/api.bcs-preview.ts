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

  let body: { scores: BcsScores; b_id: string; samplingDate: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body || typeof body.b_id !== "string" || !body.b_id) {
    return Response.json({ error: "b_id is required" }, { status: 400 })
  }

  const samplingDate = new Date(body.samplingDate)
  if (Number.isNaN(samplingDate.getTime())) {
    return Response.json({ error: "samplingDate is invalid" }, { status: 400 })
  }

  const session = await getSession(request)
  const { labContext } = await deriveBcsScores(fdm, session.principal_id, body.b_id, samplingDate)
  const result = computeBcs(body.scores, labContext ?? undefined)
  return Response.json(result)
}
