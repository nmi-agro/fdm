import {
    buildFertilizerPlanPrompt,
    createFertilizerPlannerAgent,
    FertilizerPlanStrategiesSchema,
    generateIntentQuestions,
    gerritModels,
    runStreamingAgent,
    type AgentStreamEvent,
} from "@nmi-agro/fdm-agents"
import {
    getCultivations,
    getCurrentSoilData,
    getFarms,
    getFertilizers,
    getFields,
} from "@nmi-agro/fdm-core"
import { type ActionFunctionArgs, data } from "react-router"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { serverConfig } from "~/lib/config.server"
import { fdm } from "~/lib/fdm.server"
import { enrichAndComputePlan } from "~/lib/gerrit-plan.server"
import PostHogClient from "~/posthog.server"
import type { ParsedPlan } from "~/components/blocks/gerrit/types"
import { getDefaultCultivation } from "../lib/cultivation-helpers"

/** POST /api/gerrit/$b_id_farm/$calendar/stream */
export async function action({ request, params }: ActionFunctionArgs) {
    const b_id_farm = params.b_id_farm
    const calendar = getCalendar(params)
    const timeframe = getTimeframe(params)

    if (!b_id_farm) {
        return data({ error: "Missing farm ID" }, { status: 400 })
    }

    const session = await getSession(request)

    // Feature flag guard
    const posthog = PostHogClient()
    const isGerritEnabled =
        (await posthog?.isFeatureEnabled("gerrit", session.principal_id)) ??
        true
    if (!isGerritEnabled) {
        return data(null, {
            status: 403,
            statusText: "Feature is not enabled for this user",
        })
    }

    if (!serverConfig.integrations.gemini?.api_key) {
        return data({ error: "Gemini API key not configured" }, { status: 500 })
    }

    // Verify farm access
    const farms = await getFarms(fdm, session.principal_id)
    const farm = farms.find((f) => f.b_id_farm === b_id_farm)
    if (!farm) {
        return data({ error: "Farm not found" }, { status: 404 })
    }

    let body: {
        phase: "intent" | "generate" | "follow_up"
        strategies?: Record<string, boolean>
        additionalContext?: string
        sessionId?: string
        message?: string
    }
    try {
        body = await request.json()
    } catch {
        return data({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { phase } = body

    // ------------------------------------------------------------------
    // Load field summary — needed for both intent and generate phases
    // ------------------------------------------------------------------
    const rawFields = await getFields(fdm, session.principal_id, b_id_farm, timeframe)
    const fieldsData = await Promise.all(
        rawFields.map(async (field) => {
            const [cultivations, soilData] = await Promise.all([
                getCultivations(fdm, session.principal_id, field.b_id, timeframe),
                getCurrentSoilData(fdm, session.principal_id, field.b_id),
            ])
            const mainCultivation = getDefaultCultivation(cultivations, calendar)
            const getSoilParam = (param: string) =>
                soilData.find((d) => d.parameter === param)?.value ?? null
            return {
                b_id: field.b_id,
                b_name: field.b_name || field.b_id,
                b_area: field.b_area ?? 0,
                b_bufferstrip: field.b_bufferstrip ?? false,
                b_lu_catalogue: mainCultivation?.b_lu_catalogue || "Onbekend",
                b_lu_name: mainCultivation?.b_lu_name || "Onbekend gewas",
                b_lu_croprotation: mainCultivation?.b_lu_croprotation ?? null,
                b_soiltype_agr: getSoilParam("b_soiltype_agr") as string | null,
                b_gwl_class: getSoilParam("b_gwl_class") as string | null,
                a_som_loi: getSoilParam("a_som_loi") as number | null,
            }
        }),
    )

    // ------------------------------------------------------------------
    // INTENT PHASE — return questions as plain JSON (no streaming needed)
    // ------------------------------------------------------------------
    if (phase === "intent") {
        let strategies: ReturnType<typeof FertilizerPlanStrategiesSchema.parse>
        try {
            strategies = FertilizerPlanStrategiesSchema.parse(body.strategies ?? {})
        } catch {
            return data({ error: "Invalid strategies" }, { status: 400 })
        }

        const rawFertilizers = await getFertilizers(fdm, session.principal_id, b_id_farm)
        const fertilizers = rawFertilizers.map((f) => ({
            p_name_nl: f.p_name_nl ?? f.p_id_catalogue,
            p_type: f.p_type ?? "other",
        }))

        const { questions, usage: intentUsage } = await generateIntentQuestions(
            fieldsData,
            fertilizers,
            strategies,
            serverConfig.integrations.gemini.api_key,
            body.additionalContext,
        )

        // Track intent phase in PostHog under the same trace as generate phase
        try {
            posthog?.capture({
                distinctId: session.principal_id,
                event: "$ai_generation",
                properties: {
                    $ai_model: gerritModels.intent,
                    $ai_latency: intentUsage.latencyMs / 1000,
                    $ai_input_tokens: intentUsage.inputTokens,
                    $ai_output_tokens: intentUsage.outputTokens,
                    $ai_total_tokens: intentUsage.totalTokens,
                    $ai_trace_id: `gerrit-${b_id_farm}-${calendar}`,
                    phase: "intent",
                    question_count: questions.length,
                    b_id_farm,
                    calendar,
                },
            })
            await posthog?.flush()
        } catch (e) {
            console.error("[gerrit intent] PostHog tracking failed:", e)
        }

        return data({ questions })
    }

    // ------------------------------------------------------------------
    // GENERATE / FOLLOW_UP PHASE — SSE stream
    // ------------------------------------------------------------------
    if (phase !== "generate" && phase !== "follow_up") {
        return data({ error: "Invalid phase" }, { status: 400 })
    }

    const additionalContext = body.additionalContext ?? ""
    const modelName = phase === "follow_up" ? gerritModels.followUp : gerritModels.planning

    const agent = createFertilizerPlannerAgent(
        fdm,
        serverConfig.integrations.gemini.api_key,
        modelName,
    )

    let prompt: string
    if (phase === "generate") {
        let strategies: ReturnType<typeof FertilizerPlanStrategiesSchema.parse>
        try {
            strategies = FertilizerPlanStrategiesSchema.parse(body.strategies ?? {})
        } catch {
            return data({ error: "Invalid strategies" }, { status: 400 })
        }
        prompt = buildFertilizerPlanPrompt(
            { b_id_farm },
            strategies,
            calendar,
            additionalContext,
            fieldsData,
        )
    } else {
        // follow_up — instruct the agent to answer in plain prose, not JSON
        const userMessage = body.message ?? "Kun je de keuzes in het plan toelichten?"
        prompt = `Je bent Gerrit, een bemestingsadviseur. De gebruiker heeft al een bemestingsplan ontvangen en stelt nu een vervolgvraag over het plan of over bemesting in het algemeen.

Beantwoord de vraag in heldere, beknopte Nederlandse tekst. Geef GEEN JSON-output en GEEN codeblokken — gewoon een begrijpelijk, direct antwoord in gewone alinea's.

Vraag van de gebruiker: ${userMessage}`
    }

    const agentContext: Record<string, unknown> = {
        principalId: session.principal_id,
        b_id_farm,
        calendar,
        nmiApiKey: serverConfig.integrations.nmi?.api_key,
        additionalContext,
    }

    const startTime = Date.now()

    const stream = new ReadableStream({
        async start(controller) {
            const enc = new TextEncoder()

            function send(event: AgentStreamEvent | { type: "plan_enriched"; plan: unknown } | { type: "enrichment_start" }) {
                controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`))
            }

            try {
                let finalResponseText: string | null = null
                for await (const event of runStreamingAgent(
                    agent,
                    prompt,
                    agentContext,
                    body.sessionId,
                )) {
                    send(event)

                    if (event.type === "final_response") {
                        finalResponseText = event.text
                        // PostHog tracking
                        const latencySeconds = (Date.now() - startTime) / 1000
                        try {
                            posthog?.capture({
                                distinctId: session.principal_id,
                                event: "$ai_generation",
                                properties: {
                                    $ai_model: modelName,
                                    $ai_latency: latencySeconds,
                                    $ai_input_tokens: event.usage?.inputTokens ?? null,
                                    $ai_output_tokens: event.usage?.outputTokens ?? null,
                                    $ai_total_tokens: event.usage?.totalTokens ?? null,
                                    $ai_tools_called: event.toolCalls,
                                    $ai_tool_call_count: event.toolCalls.length,
                                    $ai_trace_id: `gerrit-${b_id_farm}-${calendar}`,
                                    b_id_farm,
                                    calendar,
                                    phase,
                                    field_count: fieldsData.length,
                                },
                            })
                            await posthog?.flush()
                        } catch (e) {
                            console.error("[gerrit stream] PostHog tracking failed:", e)
                        }
                    }
                }

                // For generate phase: parse plan JSON and enrich it server-side
                if (phase === "generate" && finalResponseText) {
                    try {
                        send({ type: "enrichment_start" })
                        const firstBrace = finalResponseText.indexOf("{")
                        const lastBrace = finalResponseText.lastIndexOf("}")
                        if (firstBrace !== -1 && lastBrace > firstBrace) {
                            const parsedPlan = JSON.parse(
                                finalResponseText.slice(firstBrace, lastBrace + 1),
                            ) as ParsedPlan

                            const enrichedPlan = await enrichAndComputePlan(
                                session.principal_id,
                                b_id_farm,
                                calendar,
                                parsedPlan,
                                fieldsData,
                                serverConfig.integrations.nmi?.api_key,
                            )
                            send({ type: "plan_enriched", plan: enrichedPlan })
                        } else {
                            send({
                                type: "error",
                                message: "Gerrit gaf een onleesbaar antwoord.",
                            })
                        }
                    } catch (err) {
                        console.error("[gerrit stream] Enrichment failed:", err)
                        send({
                            type: "error",
                            message: "Verrijking van het plan is mislukt.",
                        })
                    }
                }
            } catch (err) {
                send({
                    type: "error",
                    message: err instanceof Error ? err.message : "Onbekende fout",
                })
            } finally {
                controller.enqueue(enc.encode("data: [DONE]\n\n"))
                controller.close()
            }
        },
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    })
}
