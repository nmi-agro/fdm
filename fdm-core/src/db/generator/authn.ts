import { createFdmAuth } from "../../authentication"
import { createFdmServer } from "../../fdm-server"

const host = String(process.env.POSTGRES_HOST)
if (!process.env.POSTGRES_HOST) {
    throw new Error("POSTGRES_HOST environment variable is required")
}

const port = Number(process.env.POSTGRES_PORT)
if (Number.isNaN(port)) {
    throw new Error("POSTGRES_PORT must be a valid number")
}

const user = String(process.env.POSTGRES_USER)
if (!process.env.POSTGRES_USER) {
    throw new Error("POSTGRES_USER environment variable is required")
}

const password = String(process.env.POSTGRES_PASSWORD)
if (!process.env.POSTGRES_PASSWORD) {
    throw new Error("POSTGRES_PASSWORD environment variable is required")
}

const database = String(process.env.POSTGRES_DB)
if (!process.env.POSTGRES_DB) {
    throw new Error("POSTGRES_DB environment variable is required")
}

const googleAuth = {
    clientId: process.env.GOOGLE_CLIENT_ID || "mock_google_client_id",
    clientSecret:
        process.env.GOOGLE_CLIENT_SECRET || "mock_google_client_secret",
}
const microsoftAuth = {
    clientId: process.env.MS_CLIENT_ID || "mock_ms_client_id",
    tenantId: process.env.MS_TENANT_ID || "common",
    privateKey: process.env.MS_PRIVATE_KEY || "mock_ms_private_key",
    certThumbprint: process.env.MS_CERT_THUMBPRINT || "mock_ms_thumbprint",
}

const fdm = createFdmServer(host, port, user, password, database)
export const auth = createFdmAuth(fdm, googleAuth, microsoftAuth)
