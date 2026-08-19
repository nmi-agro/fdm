/**
 * The RVO client (`@nmi-agro/rvo-connector`) throws a plain `Error` for any non-2xx HTTP
 * response, with a message shaped like `"Request failed: <status> - <body>"` — there is no
 * distinct error class or status field to check instead.
 *
 * A 401/403 here specifically means the current eHerkenning session has no machtiging (mandate)
 * for the requested KvK number. That is a *completed* request that denies the relationship, not a
 * network/config/server fault — so unlike other RVO errors, it is meaningful enough to record as
 * a `not_verified` farm-verification result (see fdm-core's `addFarmVerification` docs on
 * faulting vs. completed requests).
 */
export function isRvoPermissionDeniedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const match = error.message.match(/Request failed: (\d{3})/)
  if (!match) return false
  const status = Number(match[1])
  return status === 401 || status === 403
}
