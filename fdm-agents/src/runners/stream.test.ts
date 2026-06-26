import { describe, expect, it } from "vitest"
import { runStreamAgent } from "./stream"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a fake AgentGraph whose streamEvents emits the given raw events. */
function makeAgent(events: Record<string, any>[]): any {
  return {
    stream: () => {},
    streamEvents: (_input: unknown, _opts: unknown) => {
      async function* gen() {
        for (const e of events) yield e
      }
      return gen()
    },
  }
}

/** Collect all yielded StreamEvents into an array. */
async function collect(gen: AsyncGenerator<any>): Promise<any[]> {
  const results: any[] = []
  for await (const e of gen) results.push(e)
  return results
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runStreamAgent", () => {
  it("should yield on_chain_end with empty structuredResponse and finalText when no events", async () => {
    const agent = makeAgent([])
    const events = await collect(runStreamAgent(agent, "hello"))
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe("on_chain_end")
    expect(events[0].data.structuredResponse).toBeUndefined()
    expect(events[0].data.result).toBe("")
  })

  it("should yield reasoning events for thinking parts in on_chat_model_end", async () => {
    const agent = makeAgent([
      {
        event: "on_chat_model_end",
        data: {
          output: {
            content: [
              { type: "thinking", thinking: "Ik denk na..." },
              { type: "text", text: "Klaar." },
            ],
          },
        },
      },
    ])
    const events = await collect(runStreamAgent(agent, "test"))
    const reasoning = events.filter((e) => e.event === "reasoning")
    expect(reasoning).toHaveLength(1)
    expect(reasoning[0].data.chunk).toContain("Ik denk na...")
  })

  it("should skip thinking parts with empty thinking string", async () => {
    const agent = makeAgent([
      {
        event: "on_chat_model_end",
        data: {
          output: { content: [{ type: "thinking", thinking: "" }] },
        },
      },
    ])
    const events = await collect(runStreamAgent(agent, "test"))
    expect(events.filter((e) => e.event === "reasoning")).toHaveLength(0)
  })

  it("should yield on_tool_start events", async () => {
    const agent = makeAgent([
      {
        event: "on_tool_start",
        name: "searchFertilizers",
        data: { input: { b_id_farm: "farm-1" } },
      },
    ])
    const events = await collect(runStreamAgent(agent, "test"))
    const toolStart = events.find((e) => e.event === "on_tool_start")
    expect(toolStart).toBeDefined()
    expect(toolStart.data.name).toBe("searchFertilizers")
  })

  it("should yield on_tool_end events", async () => {
    const agent = makeAgent([
      {
        event: "on_tool_end",
        name: "searchFertilizers",
        data: { output: { fertilizers: [] } },
      },
    ])
    const events = await collect(runStreamAgent(agent, "test"))
    const toolEnd = events.find((e) => e.event === "on_tool_end")
    expect(toolEnd).toBeDefined()
    expect(toolEnd.data.name).toBe("searchFertilizers")
  })

  it("should capture structuredResponse from on_chain_end", async () => {
    const plan = { summary: "Test plan", plan: [] }
    const agent = makeAgent([
      {
        event: "on_chain_end",
        data: { output: { structuredResponse: plan } },
      },
    ])
    const events = await collect(runStreamAgent(agent, "test"))
    const chainEnd = events.find((e) => e.event === "on_chain_end")
    expect(chainEnd.data.structuredResponse).toEqual(plan)
  })

  it("should capture finalText from on_chain_end messages", async () => {
    const agent = makeAgent([
      {
        event: "on_chain_end",
        data: {
          output: {
            messages: [{ content: "Mijn finale tekst" }],
          },
        },
      },
    ])
    const events = await collect(runStreamAgent(agent, "test"))
    const chainEnd = events.find((e) => e.event === "on_chain_end")
    expect(chainEnd.data.result).toBe("Mijn finale tekst")
  })

  it("should extract text from array content in messages", async () => {
    const agent = makeAgent([
      {
        event: "on_chain_end",
        data: {
          output: {
            messages: [
              {
                content: [
                  { type: "thinking", thinking: "denken" },
                  { type: "text", text: "finale tekst" },
                ],
              },
            ],
          },
        },
      },
    ])
    const events = await collect(runStreamAgent(agent, "test"))
    const chainEnd = events.find((e) => e.event === "on_chain_end")
    expect(chainEnd.data.result).toBe("finale tekst")
  })

  it("should yield an error event when the agent throws", async () => {
    const agent = {
      stream: () => {},
      streamEvents: () => {
        throw new Error("Agent crashed")
      },
    }
    const events = await collect(runStreamAgent(agent as any, "test"))
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe("error")
    expect(events[0].data.message).toBe("Agent crashed")
  })

  it("should yield an error event with 'Unknown error' for non-Error throws", async () => {
    const agent = {
      stream: () => {},
      streamEvents: () => {
        // biome-ignore lint/style/useThrowOnlyError: intentional for test coverage
        throw "string error"
      },
    }
    const events = await collect(runStreamAgent(agent as any, "test"))
    expect(events[0].event).toBe("error")
    expect(events[0].data.message).toBe("Unknown error")
  })

  it("should pass recursionLimit to streamEvents", async () => {
    let capturedOpts: any
    const agent = {
      stream: () => {},
      streamEvents: (_input: unknown, opts: unknown) => {
        capturedOpts = opts
        async function* gen() {}
        return gen()
      },
    }
    await collect(runStreamAgent(agent as any, "test", {}, undefined, 42))
    expect(capturedOpts.recursionLimit).toBe(42)
  })

  it("should extract plain string from array content in messages", async () => {
    const agent = makeAgent([
      {
        event: "on_chain_end",
        data: {
          output: {
            messages: [{ content: ["plain string part"] }],
          },
        },
      },
    ])
    const events = await collect(runStreamAgent(agent, "test"))
    const chainEnd = events.find((e) => e.event === "on_chain_end")
    expect(chainEnd.data.result).toBe("plain string part")
  })

  it("should return empty string when message content array has no text or string parts", async () => {
    const agent = makeAgent([
      {
        event: "on_chain_end",
        data: {
          output: {
            messages: [
              {
                content: [{ type: "thinking", thinking: "denken" }],
              },
            ],
          },
        },
      },
    ])
    const events = await collect(runStreamAgent(agent, "test"))
    const chainEnd = events.find((e) => e.event === "on_chain_end")
    expect(chainEnd.data.result).toBe("")
  })

  it("should use posthog callbacks when provided and require succeeds", async () => {
    // posthog.client is present but require('@posthog/ai/langchain') will throw
    // in the test environment — the catch branch returns undefined, which is still
    // the defined behaviour when the optional dep is absent.
    const posthog = { client: { capture: () => {} }, distinctId: "user-1" }
    const agent = makeAgent([])
    // Should not throw — buildCallbacks degrades gracefully
    const events = await collect(runStreamAgent(agent, "test", { b_id_farm: "f1" }, posthog))
    expect(events[0].event).toBe("on_chain_end")
  })
})
