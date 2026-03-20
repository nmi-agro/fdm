import type { ServerConfig } from "~/types/config.d"

// Export the full config for server-side use
export const serverConfig: ServerConfig = {
    name: String(process.env.PUBLIC_FDM_NAME),
    url: String(process.env.PUBLIC_FDM_URL),
    privacy_url: process.env.FDM_PRIVACY_URL,
    datasets_url: String(process.env.PUBLIC_FDM_DATASETS_URL),

    // Authentication
    auth: {
        fdm_session_secret: String(process.env.FDM_SESSION_SECRET),
        better_auth_secret: String(process.env.BETTER_AUTH_SECRET),
        google: {
            clientId: String(process.env.GOOGLE_CLIENT_ID),
            clientSecret: String(process.env.GOOGLE_CLIENT_SECRET),
        },
        microsoft: {
            clientId: String(process.env.MS_CLIENT_ID),
            clientSecret: String(process.env.MS_CLIENT_SECRET),
        },
    },

    // Database
    database: {
        password: String(process.env.POSTGRES_PASSWORD),
        user: String(process.env.POSTGRES_USER),
        database: String(process.env.POSTGRES_DB),
        host: String(process.env.POSTGRES_HOST),
        port: Number(process.env.POSTGRES_PORT),
    },

    // Integrations
    integrations: {
        map: {
            provider: (process.env.MAP_PROVIDER as "maptiler" | "osm") || "osm",
            maptilerKey: String(process.env.MAPTILER_API_KEY),
        },
        nmi: {
            api_key: String(process.env.NMI_API_KEY),
        },
        rvo: {
            clientId: String(process.env.RVO_CLIENT_ID),
            clientSecret: String(process.env.RVO_CLIENT_SECRET),
            redirectUri: String(process.env.RVO_REDIRECT_URI),
            clientName: String(process.env.RVO_CLIENT_NAME),
            pkioPrivateKey: String(process.env.RVO_PKIO_PRIVATE_KEY),
        },
    },

    // Analytics
    analytics: {
        // Sentry
        sentry: {
            auth_token: String(process.env.SENTRY_AUTH_TOKEN),
            dsn: process.env.PUBLIC_SENTRY_DSN,
        },
        posthog: {
            key: String(process.env.PUBLIC_POSTHOG_KEY),
            host: String(process.env.PUBLIC_POSTHOG_HOST),
        },
    },

    // Mail
    mail: {
        // Postmark
        postmark: {
            key: String(process.env.POSTMARK_API_KEY),
            sender_address: String(process.env.POSTMARK_SENDER_ADDRESS),
            sender_name: String(process.env.POSTMARK_SENDER_NAME),
        },
    },
}
