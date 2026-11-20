import type { EventMessage } from "posthog-node"
import { describe, expect, it } from "vitest"
import { MAX_POSTHOG_EVENT_BYTES, sanitizePostHogEvent } from "./posthog.server"

function makeEvent(properties: Record<string, unknown>): EventMessage {
  return {
    event: "$ai_generation",
    distinctId: "test-user",
    properties,
    options: { process_person_profile: false },
  } as unknown as EventMessage
}

const byteLength = (event: EventMessage | null) => Buffer.byteLength(JSON.stringify(event), "utf8")

describe("sanitizePostHogEvent", () => {
  it("returns null for a missing event", () => {
    expect(sanitizePostHogEvent(null)).toBeNull()
  })

  it("returns an event within the limit unchanged", () => {
    const event = makeEvent({ $ai_model: "test-model", $ai_input: "short prompt" })
    expect(sanitizePostHogEvent(event)).toBe(event)
  })

  it("returns null for an event that cannot be serialized", () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(sanitizePostHogEvent(makeEvent(circular))).toBeNull()
  })

  it("truncates oversized strings and keeps token metrics and options", () => {
    const event = makeEvent({
      $ai_model: "test-model",
      $ai_input_tokens: 1234,
      $ai_input: "x".repeat(MAX_POSTHOG_EVENT_BYTES + 1000),
    })

    const result = sanitizePostHogEvent(event)

    expect(result).not.toBeNull()
    expect(byteLength(result)).toBeLessThanOrEqual(MAX_POSTHOG_EVENT_BYTES)
    expect(result?.properties).toMatchObject({ $ai_model: "test-model", $ai_input_tokens: 1234 })
    expect(String(result?.properties?.$ai_input)).toContain(
      "truncated for PostHog event payload limit",
    )
    expect(result).toMatchObject({ options: { process_person_profile: false } })
  })

  it("strips non-essential properties as a last resort but keeps metrics and SDK identity", () => {
    const properties: Record<string, unknown> = {
      $ai_model: "test-model",
      $ai_input_tokens: 10,
      $ai_output_tokens: 20,
      $lib: "posthog-node",
      $lib_version: "6.0.4",
      $is_server: true,
      $geoip_disable: true,
      $groups: { farm: "farm-1" },
    }
    // Many mid-sized strings stay over the limit after both truncation passes.
    for (let i = 0; i < 700; i++) {
      properties[`custom_${i}`] = "y".repeat(3000)
    }

    const result = sanitizePostHogEvent(makeEvent(properties))

    expect(result).not.toBeNull()
    expect(byteLength(result)).toBeLessThanOrEqual(MAX_POSTHOG_EVENT_BYTES)
    expect(result?.properties).toEqual({
      $ai_model: "test-model",
      $ai_input_tokens: 10,
      $ai_output_tokens: 20,
      $lib: "posthog-node",
      $lib_version: "6.0.4",
      $is_server: true,
      $geoip_disable: true,
      $groups: { farm: "farm-1" },
    })
    expect(result).toMatchObject({ options: { process_person_profile: false } })
  })
})
