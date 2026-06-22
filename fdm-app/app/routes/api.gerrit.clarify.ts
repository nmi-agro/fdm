import { type LoaderFunctionArgs } from "react-router"
import { getSession } from "~/lib/auth.server"
import { fdm } from "~/lib/fdm.server"
import { serverConfig } from "~/lib/config.server"
import PostHogClient from "~/posthog.server"
import {
    createClarifyAgent,
    runStreamAgent,
    ClarifyingQuestionsSchema,
    type FarmFieldSummary,
} from "@nmi-agro/fdm-agents"
import {
    getFields,
    getCultivations,
    getCurrentSoilData,
    getFertilizers,
} from "@nmi-agro/fdm-core"
import { getDefaultCultivation } from "~/lib/cultivation-helpers"

export async function loader({ request }: LoaderFunctionArgs) {
    const session = await getSession(request)
    const url = new URL(request.url)

    const b_id_farm = url.searchParams.get("b_id_farm")
    const calendar = url.searchParams.get("calendar")

    if (!b_id_farm || !calendar) {
        return new Response("Ontbrekende parameters", { status: 400 })
    }

    const posthog = PostHogClient()
    const isGerritEnabled =
        (await posthog?.isFeatureEnabled("gerrit", session.principal_id)) ?? true
    if (!isGerritEnabled) {
        return new Response("Functie niet ingeschakeld voor deze gebruiker", { status: 403 })
    }

    const modelName = url.searchParams.get("geminiModel") || "gemini-3-flash-preview"

    // Parse selectedFertilizerIds (allow only safe catalogue ID chars)
    const SAFE_ID = /^[A-Za-z0-9_-]+$/
    const selectedFertilizerIdsRaw = url.searchParams.get("selectedFertilizerIds")
    let allowedFertilizerCatalogueIds: string[] | undefined
    if (selectedFertilizerIdsRaw) {
        try {
            const parsed = JSON.parse(selectedFertilizerIdsRaw)
            if (Array.isArray(parsed)) {
                const filtered = parsed.filter(
                    (id): id is string => typeof id === "string" && SAFE_ID.test(id),
                ).slice(0, 200)
                if (filtered.length > 0) allowedFertilizerCatalogueIds = filtered
            }
        } catch {}
    }

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder()
            let isClosed = false

            request.signal.addEventListener("abort", () => {
                isClosed = true
                try { controller.close() } catch {}
            })

            const sendEvent = (event: string, data: any) => {
                if (isClosed) return
                try {
                    controller.enqueue(
                        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                    )
                } catch {
                    isClosed = true
                }
            }

            const closeStream = () => {
                if (isClosed) return
                isClosed = true
                try { controller.close() } catch {}
            }

            sendEvent("start", { message: "Gerrit bekijkt het bedrijf om gerichte vragen te stellen…" })

            try {
                const timeframe = {
                    start: new Date(`${calendar}-01-01`),
                    end: new Date(`${calendar}-12-31`),
                }

                const rawFields = await getFields(fdm, session.principal_id, b_id_farm, timeframe)
                if (isClosed) return

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
                            b_area: field.b_area,
                            b_bufferstrip: field.b_bufferstrip,
                            b_lu_catalogue: mainCultivation?.b_lu_catalogue || "Onbekend",
                            b_lu_name: mainCultivation?.b_lu_name || "Onbekend gewas",
                            b_lu_croprotation: mainCultivation?.b_lu_croprotation || null,
                            b_soiltype_agr: getSoilParam("b_soiltype_agr") as string | null,
                            b_gwl_class: getSoilParam("b_gwl_class") as string | null,
                            a_som_loi: getSoilParam("a_som_loi") as number | null,
                        }
                    })
                )
                if (isClosed) return

                const fieldsSummary: FarmFieldSummary[] = fieldsData.map((f) => ({
                    b_id: f.b_id,
                    b_name: f.b_name,
                    b_area: f.b_area ?? 0,
                    b_bufferstrip: f.b_bufferstrip ?? false,
                    b_lu_catalogue: f.b_lu_catalogue,
                    b_lu_name: f.b_lu_name,
                    b_lu_croprotation: f.b_lu_croprotation,
                    b_soiltype_agr: f.b_soiltype_agr,
                    b_gwl_class: f.b_gwl_class,
                    a_som_loi: f.a_som_loi,
                }))

                const fertilizers = await getFertilizers(fdm, session.principal_id, b_id_farm)
                if (isClosed) return

                const productiveFields = fieldsSummary.filter((f) => !f.b_bufferstrip && f.b_area)
                if (productiveFields.length === 0) {
                    sendEvent("questions", { questions: [] })
                    closeStream()
                    return
                }

                if (fertilizers.length === 0) {
                    sendEvent("questions", { questions: [] })
                    closeStream()
                    return
                }

                const agent = createClarifyAgent(fdm, serverConfig.integrations.gemini?.api_key, modelName)

                // Build a compact prompt describing the farm context for the clarify agent
                const fieldLines = productiveFields
                    .map((f) => `- ${f.b_lu_name} (${f.b_lu_catalogue}), ${f.b_area?.toFixed(1)} ha, grondsoort: ${f.b_soiltype_agr ?? "onbekend"}`)
                    .join("\n")
                const fertLines = fertilizers
                    .slice(0, 20)
                    .map((f: any) => `- ${f.p_name_nl ?? f.p_id_catalogue} (${f.p_type})`)
                    .join("\n")

                const prompt = `Analyseer bedrijf "${b_id_farm}" voor kalenderjaar ${calendar} en stel eventuele verduidelijkingsvragen.

PERCELEN:
${fieldLines}

BESCHIKBARE MESTSTOFFEN:
${fertLines}

Gebruik de beschikbare tools voor een volledige analyse en stel daarna 0–5 verduidelijkingsvragen.`

                const agentContext = {
                    principalId: session.principal_id,
                    b_id_farm,
                    calendar,
                    nmiApiKey: serverConfig.integrations.nmi?.api_key,
                    ...(allowedFertilizerCatalogueIds ? { allowedFertilizerCatalogueIds } : {}),
                }

                const agentStream = runStreamAgent(
                    agent as any,
                    prompt,
                    agentContext,
                    posthog
                        ? { client: posthog, distinctId: session.principal_id }
                        : undefined,
                )

                let structuredResponse: Record<string, unknown> | undefined

                for await (const event of agentStream) {
                    if (isClosed) return
                    if (event.event === "on_chain_end") {
                        structuredResponse = event.data?.structuredResponse
                    } else if (event.event === "error") {
                        // On clarify errors, emit empty questions (graceful degradation)
                        sendEvent("questions", { questions: [] })
                        closeStream()
                        return
                    } else {
                        sendEvent(event.event, event.data)
                    }
                }

                if (isClosed) return

                const parsed = structuredResponse
                    ? ClarifyingQuestionsSchema.safeParse(structuredResponse)
                    : null

                if (parsed?.success) {
                    sendEvent("questions", { questions: parsed.data.questions })
                } else {
                    // Graceful degradation — no questions, proceed to plan
                    sendEvent("questions", { questions: [] })
                }
                closeStream()
            } catch (err) {
                const message = err instanceof Error ? err.message : "Onbekende fout"
                console.error("[clarify]", message)
                // Always degrade gracefully — emit empty questions
                sendEvent("questions", { questions: [] })
                closeStream()
            }
        },
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    })
}
