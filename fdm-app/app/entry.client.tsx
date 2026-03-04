/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

import * as Sentry from "@sentry/react-router"
import posthog from "posthog-js"
import { PostHogProvider } from "posthog-js/react"
import { StrictMode, startTransition } from "react"
import { hydrateRoot } from "react-dom/client"
import { HydratedRouter } from "react-router/dom"
import { clientConfig } from "~/lib/config"

if (clientConfig.analytics.sentry) {
    const sentryConfig = clientConfig.analytics.sentry
    Sentry.init({
        dsn: sentryConfig.dsn,
        release: import.meta.env.PUBLIC_APP_VERSION,
        environment: import.meta.env.NODE_ENV,
        ignoreErrors: [/BodyStreamBuffer was aborted/],
        integrations: [
            Sentry.reactRouterTracingIntegration(),
            Sentry.replayIntegration(),
            Sentry.feedbackIntegration({
                autoInject: false,
                colorScheme: "system",
                isNameRequired: true,
                isEmailRequired: true,
                enableScreenshot: true,
                showBranding: false,
                triggerLabel: "Geef feedback",
                formTitle: "Geef feedback",
                submitButtonLabel: "Verstuur",
                cancelButtonLabel: "Annuleer",
                confirmButtonLabel: "Bevestig",
                addScreenshotButtonLabel: "Voeg een screenshot toe",
                removeScreenshotButtonLabel: "Verwijder screenshot",
                nameLabel: "Naam",
                namePlaceholder: "Uw naam",
                emailLabel: "E-mailadres",
                emailPlaceholder: "Uw e-mailadres",
                isRequiredLabel: "(vereist)",
                messageLabel: "Beschrijving",
                messagePlaceholder:
                    "Wat is uw feedback? Gaat er iets mis of zou u iets toegevoegd willen zien?",
                successMessageText: "Bedankt voor uw feedback!",
                useSentryUser: {
                    name: "fullName",
                    email: "email",
                },
            }),
        ],
        // beforeSend(event, hint) {
        //     if (event.exception && event.event_id) {
        //         Sentry.showReportDialog({ eventId: event.event_id, lang: "nl" })
        //     }
        //     return event
        // },

        tracesSampleRate: sentryConfig.trace_sample_rate,

        tracePropagationTargets: [window.location.hostname],

        replaysSessionSampleRate: sentryConfig.replay_sample_rate,
        replaysOnErrorSampleRate: sentryConfig.replay_sample_rate_on_error,
    })
}

startTransition(() => {
    hydrateRoot(
        document,
        <StrictMode>
            <PostHogProvider client={posthog}>
                <HydratedRouter />
            </PostHogProvider>
        </StrictMode>,
    )
})
