/**
 * Describes the authenticated API principal stored on each request.
 */
export interface ApiPrincipalContext {
  /** Identifier of the user that owns the authenticated API key. */
  userId: string
  /** Identifier of the API key that was presented with the request. */
  apiKeyId: string
  /** Optional human-readable name assigned to the API key. */
  keyName: string | null
  /** Channel marker used to distinguish API-key authentication from other auth flows. */
  channel: "api"
  /** Effective principal identifier used for downstream authorization checks and data access. */
  effectivePrincipalId: string
}

/**
 * Defines the Hono environment bindings used by the FDM API application.
 */
export type ApiEnv = {
  /** Request-scoped Hono variables populated by API middleware. */
  Variables: {
    /** Authenticated principal context attached by the API key middleware. */
    principal: ApiPrincipalContext
    /** Tracks which rate-limit buckets have already been counted for this request, preventing double-counting from overlapping middleware patterns. */
    rateLimitBucketsSeen: Set<string>
  }
}
