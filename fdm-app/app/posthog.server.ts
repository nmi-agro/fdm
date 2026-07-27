import { type EventMessage, PostHog } from "posthog-node"

let posthogClient: PostHog | null = null

/**
 * Recursively truncates string values inside an object or array if they exceed a maximum character length.
 */
function truncateLargeValues<T>(value: T, maxStringLength: number): T {
  if (typeof value === "string") {
    if (value.length > maxStringLength) {
      return (value.slice(0, maxStringLength) +
        `\n... [truncated for PostHog event payload limit (original length: ${value.length} chars)]`) as unknown as T
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => truncateLargeValues(item, maxStringLength)) as unknown as T
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = truncateLargeValues(val, maxStringLength)
    }
    return result as T
  }
  return value
}

/**
 * Sanitizes event messages before sending them to PostHog.
 * Prevents HTTP 413 / Kafka "maximum event size exceeded" errors caused by large
 * LLM prompts, reasoning traces, or farm context payloads, while preserving all
 * token usage, model identifiers, and cost calculation metrics.
 */
export function sanitizePostHogEvent(event: EventMessage | null): EventMessage | null {
  if (!event) return null

  const MAX_EVENT_BYTES = 150_000 // Target 150 KB max JSON payload size in UTF-8 bytes

  const getByteLength = (str: string) => Buffer.byteLength(str, "utf8")

  let serialized = ""
  try {
    serialized = JSON.stringify(event)
  } catch {
    return null
  }

  // If the event payload fits easily within limits, return untouched
  if (getByteLength(serialized) <= MAX_EVENT_BYTES) {
    return event
  }

  // Pass 1: Truncate oversized string properties to 20,000 chars
  if (event.properties) {
    event.properties = truncateLargeValues(event.properties, 20_000)
  }

  try {
    serialized = JSON.stringify(event)
  } catch {
    return null
  }

  if (getByteLength(serialized) <= MAX_EVENT_BYTES) {
    return event
  }

  // Pass 2: More aggressive truncation to 2,000 chars if still over limit
  if (event.properties) {
    event.properties = truncateLargeValues(event.properties, 2_000)
  }

  try {
    serialized = JSON.stringify(event)
  } catch {
    return null
  }

  if (getByteLength(serialized) <= MAX_EVENT_BYTES) {
    return event
  }

  // Pass 3: Hard fallback for AI trace text fields while preserving token usage & cost metrics
  if (event.properties) {
    const textFieldsToClear = [
      "$ai_input",
      "$ai_input_state",
      "$ai_output_choices",
      "$ai_output_state",
      "prompt",
      "input",
      "output",
      "messages",
    ]
    for (const field of textFieldsToClear) {
      if (field in event.properties) {
        event.properties[field] = "[Payload text truncated to preserve token & cost metrics in PostHog]"
      }
    }
  }

  try {
    serialized = JSON.stringify(event)
  } catch {
    return null
  }

  if (getByteLength(serialized) <= MAX_EVENT_BYTES) {
    return event
  }

  // Pass 4: Final fallback for extreme edge cases — strip all non-essential properties while keeping token & cost metrics
  if (event.properties) {
    const essentialKeys = new Set([
      "$ai_lib",
      "$ai_lib_version",
      "$ai_trace_id",
      "$ai_span_id",
      "$ai_span_name",
      "$ai_parent_id",
      "$ai_provider",
      "$ai_model",
      "$ai_input_tokens",
      "$ai_output_tokens",
      "$ai_reasoning_tokens",
      "$ai_cache_read_input_tokens",
      "$ai_cache_creation_input_tokens",
      "$ai_latency",
      "$ai_http_status",
      "$ai_framework",
      "$groups",
      "b_id_farm",
      "org_slug",
    ])
    const sanitizedProperties: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(event.properties)) {
      if (essentialKeys.has(key)) {
        sanitizedProperties[key] = val
      }
    }
    event.properties = sanitizedProperties
  }

  try {
    serialized = JSON.stringify(event)
    if (getByteLength(serialized) <= MAX_EVENT_BYTES) {
      return event
    }
  } catch {
    return null
  }

  return null
}

export default function PostHogClient(): PostHog | null {
  if (!posthogClient) {
    const posthogHost = process.env.PUBLIC_POSTHOG_HOST
    const posthogKey = process.env.PUBLIC_POSTHOG_KEY
    if (posthogHost && posthogKey?.startsWith("phc")) {
      posthogClient = new PostHog(posthogKey, {
        host: posthogHost,
        // Send events one at a time to avoid batch payload spikes
        maxBatchSize: 1,
        // Intercept events before sending to prevent 413s from large LLM payloads
        before_send: sanitizePostHogEvent,
      })
    }
  }
  return posthogClient
}

