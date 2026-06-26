import {
  buildFertilizerPlanPrompt,
  createFertilizerPlannerAgent,
  type FarmFieldSummary,
  FertilizerPlanSchema,
  runStreamAgent,
  sanitizeAdditionalContext,
} from "@nmi-agro/fdm-agents"
import {
  type Fertilizer,
  fromKgPerHa,
  getCultivations,
  getCurrentSoilData,
  getFertilizerParametersDescription,
  getFertilizers,
  getFields,
} from "@nmi-agro/fdm-core"
import type { LoaderFunctionArgs } from "react-router"
import type { ParsedPlan } from "~/components/blocks/gerrit/types"
import { getSession } from "~/lib/auth.server"
import { serverConfig } from "~/lib/config.server"
import { getDefaultCultivation } from "~/lib/cultivation-helpers"
import { fdm } from "~/lib/fdm.server"
import { computePlanMetrics, repairTruncatedJson } from "~/lib/gerrit.server"
import { countGerritRequestsToday, getGerritDailyLimit } from "~/lib/gerrit-limit.server"
import PostHogClient from "~/posthog.server"

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request)
  const url = new URL(request.url)

  const b_id_farm = url.searchParams.get("b_id_farm")
  const calendar = url.searchParams.get("calendar")

  if (!b_id_farm || !calendar) {
    return new Response("Missing parameters", { status: 400 })
  }

  const posthog = PostHogClient()
  const flags = posthog ? await posthog.evaluateFlags(session.principal_id) : null
  const isGerritEnabled = flags ? flags.isEnabled("gerrit") : true
  if (!isGerritEnabled) {
    return new Response("Feature is not enabled for this user", {
      status: 403,
    })
  }

  // Rate-limit check: enforce daily cap before opening the SSE stream.
  // Because EventSource cannot read non-2xx response bodies, over-limit is
  // signalled as an in-stream SSE error event rather than a 429 response.
  const [dailyLimit, usedToday] = await Promise.all([
    getGerritDailyLimit(session.principal_id),
    countGerritRequestsToday(session.principal_id),
  ])

  const strategies = {
    isOrganic: url.searchParams.get("isOrganic") === "true",
    fillManureSpace: url.searchParams.get("fillManureSpace") === "true",
    reduceAmmoniaEmissions: url.searchParams.get("reduceAmmoniaEmissions") === "true",
    keepNitrogenBalanceBelowTarget:
      url.searchParams.get("keepNitrogenBalanceBelowTarget") === "true",
    workOnRotationLevel: url.searchParams.get("workOnRotationLevel") === "true",
    isDerogation: url.searchParams.get("isDerogation") === "true",
  }
  const additionalContext = url.searchParams.get("additionalContext") || ""
  const modelName = url.searchParams.get("geminiModel") || "gemini-3.5-flash"

  // Parse selectedFertilizerIds (allow only safe catalogue ID chars: alphanumeric, _, -)
  const SAFE_ID = /^[A-Za-z0-9_-]+$/
  const selectedFertilizerIdsRaw = url.searchParams.get("selectedFertilizerIds")
  let selectedFertilizerIds: string[] | undefined
  if (selectedFertilizerIdsRaw) {
    try {
      const parsed = JSON.parse(selectedFertilizerIdsRaw)
      if (Array.isArray(parsed)) {
        selectedFertilizerIds = parsed
          .filter((id): id is string => typeof id === "string" && SAFE_ID.test(id))
          .slice(0, 200)
      }
    } catch {}
  }
  // Empty array = treat as "use all"
  const allowedFertilizerCatalogueIds =
    selectedFertilizerIds && selectedFertilizerIds.length > 0 ? selectedFertilizerIds : undefined
  let clarifications: Array<{
    question: string
    selectedOptionLabels: string[]
    other?: string
  }> = []
  const clarificationsRaw = url.searchParams.get("clarifications")
  if (clarificationsRaw) {
    try {
      const parsed = JSON.parse(clarificationsRaw)
      if (Array.isArray(parsed)) {
        clarifications = parsed.map((c: any) => ({
          question: sanitizeAdditionalContext(String(c.question ?? ""), 200),
          selectedOptionLabels: (c.selectedOptionLabels ?? []).map((l: string) =>
            sanitizeAdditionalContext(String(l), 120),
          ),
          other: c.other ? sanitizeAdditionalContext(String(c.other), 200) : undefined,
        }))
      }
    } catch {
      // Ignore malformed clarifications — treat as none
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let isClosed = false

      request.signal.addEventListener("abort", () => {
        isClosed = true
        try {
          controller.close()
        } catch {}
      })

      const sendEvent = (event: string, data: any) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          isClosed = true
        }
      }

      const closeStream = () => {
        if (isClosed) return
        isClosed = true
        try {
          controller.close()
        } catch {}
      }

      // Send start event immediately so the client can show feedback
      // before the (potentially slow) database setup completes.
      sendEvent("start", {
        message: "Verbinding gemaakt, gegevens ophalen...",
      })

      // Reject if the user has reached their daily limit.
      if (dailyLimit !== Number.POSITIVE_INFINITY && usedToday >= dailyLimit) {
        sendEvent("error", {
          message: `Je hebt het dagelijkse limiet van ${dailyLimit} plannen bereikt. Probeer het morgen opnieuw.`,
          code: "RATE_LIMIT_EXCEEDED",
        })
        closeStream()
        return
      }

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
          }),
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
          sendEvent("error", {
            message: "Er zijn geen percelen gevonden voor dit bedrijf. Voeg eerst percelen toe.",
          })
          closeStream()
          return
        }

        if (fertilizers.length === 0) {
          sendEvent("error", {
            message:
              "Er zijn geen meststoffen gevonden voor dit bedrijf. Voeg eerst meststoffen toe aan het bedrijf.",
          })
          closeStream()
          return
        }

        sendEvent("status", {
          message: "Gerrit start met het berekenen van het plan...",
          phase: "planning",
        })

        const agent = createFertilizerPlannerAgent(
          fdm,
          serverConfig.integrations.gemini?.api_key,
          modelName,
        )
        const prompt = buildFertilizerPlanPrompt(
          { b_id_farm },
          strategies,
          calendar,
          additionalContext,
          fieldsSummary,
          clarifications,
          allowedFertilizerCatalogueIds,
        )
        const agentContext = {
          principalId: session.principal_id,
          b_id_farm,
          calendar,
          nmiApiKey: serverConfig.integrations.nmi?.api_key,
          strategies,
          additionalContext: additionalContext ?? "",
          ...(allowedFertilizerCatalogueIds ? { allowedFertilizerCatalogueIds } : {}),
        }

        const agentStream = runStreamAgent(
          agent,
          prompt,
          agentContext,
          posthog ? { client: posthog, distinctId: session.principal_id } : undefined,
        )

        let rawResult = ""
        let structuredResponse: Record<string, unknown> | undefined

        for await (const event of agentStream) {
          if (isClosed) return
          if (event.event === "on_chain_end") {
            structuredResponse = event.data?.structuredResponse
            rawResult = event.data?.result || ""
          } else if (event.event === "error") {
            sendEvent("error", { message: event.data?.message })
            closeStream()
            return
          } else {
            sendEvent(event.event, event.data)
          }
        }

        if (isClosed) return

        let parsedPlan: ParsedPlan
        const useStructured = structuredResponse
          ? FertilizerPlanSchema.safeParse(structuredResponse)
          : null

        if (useStructured?.success) {
          parsedPlan = useStructured.data as unknown as ParsedPlan
        } else {
          const firstBrace = rawResult.indexOf("{")
          const lastBrace = rawResult.lastIndexOf("}")
          if (firstBrace === -1 || lastBrace <= firstBrace) {
            sendEvent("error", {
              message: "Gerrit gaf een onleesbaar antwoord. Probeer het opnieuw.",
            })
            closeStream()
            return
          }

          try {
            parsedPlan = JSON.parse(rawResult.slice(firstBrace, lastBrace + 1)) as ParsedPlan
          } catch {
            const repaired = repairTruncatedJson(rawResult.slice(firstBrace, lastBrace + 1))
            if (repaired) {
              try {
                parsedPlan = JSON.parse(repaired) as ParsedPlan
              } catch {
                sendEvent("error", {
                  message: "Gerrit gaf een ongeldig plan terug. Probeer het opnieuw.",
                })
                closeStream()
                return
              }
            } else {
              sendEvent("error", {
                message: "Gerrit gaf een ongeldig plan terug. Probeer het opnieuw.",
              })
              closeStream()
              return
            }
          }
        }

        const fertilizerParameterDescription = getFertilizerParametersDescription()
        const applicationMethods = fertilizerParameterDescription.find(
          (x: any) => x.parameter === "p_app_method_options",
        )

        const enrichedPlan = fieldsData.map((fd) => {
          const proposedField = parsedPlan.plan?.find((p) => p.b_id === fd.b_id)
          return {
            b_id: fd.b_id,
            b_name: fd.b_name,
            b_lu_catalogue: fd.b_lu_catalogue,
            b_lu_name: fd.b_lu_name,
            b_lu_croprotation: fd.b_lu_croprotation,
            b_area: fd.b_area,
            b_bufferstrip: fd.b_bufferstrip ?? false,
            applications: (proposedField?.applications || []).map((app) => {
              const sanitizedCatalogueId = app.p_id_catalogue.replace(/[^\x00-\x7F]/g, "")
              const fert = fertilizers.find(
                (f: Fertilizer) => f.p_id_catalogue === sanitizedCatalogueId,
              )
              const methodMeta = applicationMethods?.options?.find(
                (x: any) => x.value === app.p_app_method,
              )
              const p_app_amount_display = fert
                ? fromKgPerHa(app.p_app_amount, fert.p_app_amount_unit, fert.p_density)
                : null
              const unitConvertedAmount =
                fert && p_app_amount_display !== null
                  ? {
                      p_app_amount_display: p_app_amount_display,
                      p_app_amount_unit: fert.p_app_amount_unit,
                    }
                  : {
                      p_app_amount_display: app.p_app_amount,
                      p_app_amount_unit: "kg/ha",
                    }
              return {
                ...app,
                p_id_catalogue: sanitizedCatalogueId,
                ...unitConvertedAmount,
                p_name_nl: fert?.p_name_nl || sanitizedCatalogueId,
                p_type: fert?.p_type || "other",
                p_app_method_name: methodMeta?.label ?? app.p_app_method,
              }
            }),
            fieldMetrics: (proposedField as any)?.fieldMetrics ?? null,
            fieldSummary: proposedField?.fieldSummary ?? null,
          }
        })

        sendEvent("status", {
          message: "Plan berekenen en doorrekenen...",
          phase: "finalize",
        })

        const serverMetrics = await computePlanMetrics(
          session.principal_id,
          b_id_farm,
          calendar,
          enrichedPlan,
          fertilizers,
          serverConfig.integrations.nmi?.api_key,
        ).catch(() => null)

        if (isClosed) return

        for (const field of enrichedPlan) {
          field.fieldMetrics = serverMetrics?.fieldMetricsMap?.[field.b_id] ?? null
        }

        // Track successful plan generation for rate limiting.
        posthog?.capture({
          distinctId: session.principal_id,
          event: "gerrit_plan_generated",
          properties: { b_id_farm, calendar },
        })

        sendEvent("complete", {
          plan: {
            summary: parsedPlan.summary,
            plan: enrichedPlan,
            metrics: serverMetrics ? { farmTotals: serverMetrics.farmTotals } : null,
          },
          strategies,
        })
      } catch (error) {
        console.error("[api.gerrit.stream] Streaming error:", error)
        sendEvent("error", {
          message: "Er is een onverwachte fout opgetreden.",
        })
      } finally {
        closeStream()
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
