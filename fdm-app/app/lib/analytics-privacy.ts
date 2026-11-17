import type { BeforeSendFn } from "posthog-js"
import * as Sentry from "@sentry/react-router"
import { maskSecretsDeep } from "~/lib/url-utils"

/**
 * PostHog `before_send` hook that masks secrets in URLs, such as invitation
 * tokens, in every property PostHog collects automatically: `$current_url`,
 * `$pathname`, `$referrer`, the `$initial_*` and `$session_entry_*` variants,
 * link targets in autocapture and session recording data.
 *
 * @param event - The event PostHog is about to send.
 * @returns The event with secrets in URLs replaced.
 */
export const maskPostHogSecrets: BeforeSendFn = (event) => maskSecretsDeep(event)

/**
 * Masks secrets in URLs, such as invitation tokens, in everything the Sentry
 * SDK sends: error and replay events (including their request URL and
 * breadcrumbs) and streamed spans. Call once, right after `Sentry.init`.
 *
 * Session replay recording events are not covered here; pass
 * {@link maskSecretsDeep} as `beforeAddRecordingEvent` to the replay
 * integration for those.
 */
export function maskSentrySecrets(): void {
  Sentry.addEventProcessor((event) => maskSecretsDeep(event))
  Sentry.getClient()?.on("processSpan", (span) => {
    Object.assign(span, maskSecretsDeep(span))
  })
}
