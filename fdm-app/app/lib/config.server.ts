import type { ServerConfig } from "~/types/config.d"

// ---------------------------------------------------------------------------
// Microsoft cert config — validated at startup so misconfigurations surface
// immediately rather than during the first sign-in attempt.
// ---------------------------------------------------------------------------
function buildMicrosoftConfig(): ServerConfig["auth"]["microsoft"] {
    if (!process.env.MS_CLIENT_ID) return undefined

    if (!process.env.MS_PRIVATE_KEY) {
        throw new Error(
            "MS_PRIVATE_KEY is required when MS_CLIENT_ID is set. " +
                "Set MS_PRIVATE_KEY to the PKCS#8 PEM private key or a path to the PEM file.",
        )
    }

    const base = {
        clientId: process.env.MS_CLIENT_ID,
        tenantId: process.env.MS_TENANT_ID || "common",
        privateKey: process.env.MS_PRIVATE_KEY,
    }

    if (process.env.MS_CERTIFICATE) {
        return {
            ...base,
            certificate: process.env.MS_CERTIFICATE,
            ...(process.env.MS_CERT_THUMBPRINT && {
                certThumbprint: process.env.MS_CERT_THUMBPRINT,
            }),
        }
    }

    if (process.env.MS_CERT_THUMBPRINT) {
        return { ...base, certThumbprint: process.env.MS_CERT_THUMBPRINT }
    }

    throw new Error(
        "Either MS_CERTIFICATE (public certificate PEM or path) or " +
            "MS_CERT_THUMBPRINT (base64url SHA-1 thumbprint) is required when MS_CLIENT_ID is set.",
    )
}

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
        microsoft: buildMicrosoftConfig(),
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
            redirectUri: String(process.env.RVO_REDIRECT_URI),
            clientName: String(process.env.RVO_CLIENT_NAME),
            pkioPrivateKey: String(process.env.RVO_PKIO_PRIVATE_KEY),
        },
        ...(process.env.GEMINI_API_KEY
            ? {
                  gemini: {
                      api_key: process.env.GEMINI_API_KEY,
                      model: process.env.GEMINI_MODEL,
                  },
              }
            : {}),
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
