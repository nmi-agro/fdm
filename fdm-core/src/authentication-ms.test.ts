/**
 * Unit tests for authentication-ms.ts
 *
 * Key test strategy:
 * - Private key: generated with Node's crypto (no OpenSSL binary needed)
 * - Certificate PEM: a minimal fake PEM wrapping known bytes so the
 *   thumbprint is predictable without needing a real X.509 structure
 * - Network calls (token endpoint, Graph photo): mocked via global.fetch
 * - Jose's SignJWT is used to build id_tokens for getUserInfo tests
 */
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { writeFileSync, unlinkSync } from "node:fs"
import { SignJWT, importPKCS8 } from "jose"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
    createMicrosoftClientAssertion,
    createMicrosoftOAuthConfig,
    type MicrosoftCertConfig,
    type MicrosoftOAuthHelpers,
} from "./authentication-ms"

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

/** A real PKCS#8 PEM private key generated once for all signing tests. */
let privateKeyPem: string

/**
 * A minimal fake certificate PEM. The DER body is arbitrary bytes (the
 * string "fdm-test-certificate-der-bytes" base64-encoded). The thumbprint
 * is pre-computed from those same bytes so tests stay deterministic.
 */
const FAKE_CERT_DER_BYTES = Buffer.from("fdm-test-certificate-der-bytes")
const FAKE_CERT_PEM = [
    "-----BEGIN CERTIFICATE-----",
    FAKE_CERT_DER_BYTES.toString("base64"),
    "-----END CERTIFICATE-----",
].join("\n")
const FAKE_CERT_THUMBPRINT = createHash("sha1")
    .update(FAKE_CERT_DER_BYTES)
    .digest()
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")

beforeAll(() => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
    privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString()
})

/** Base config that uses certThumbprint (no cert PEM needed for signing). */
const baseConfig = (): MicrosoftCertConfig => ({
    clientId: "test-client-id",
    tenantId: "test-tenant",
    privateKey: privateKeyPem,
    certThumbprint: FAKE_CERT_THUMBPRINT,
})

const mockHelpers: MicrosoftOAuthHelpers = {
    splitFullName: (name) => {
        const parts = (name ?? "").trim().split(/\s+/)
        return {
            firstname: parts[0] ?? null,
            surname: parts[1] ?? null,
        }
    },
    createUsername: async (email) => email.split("@")[0],
    createDisplayUsername: (firstname, surname) =>
        [firstname, surname].filter(Boolean).join(" ") || null,
}

// ---------------------------------------------------------------------------
// createMicrosoftClientAssertion
// ---------------------------------------------------------------------------

describe("createMicrosoftClientAssertion", () => {
    it("produces a JWT with RS256 alg and x5t header from certThumbprint", async () => {
        const { decodeProtectedHeader } = await import("jose")
        const token = await createMicrosoftClientAssertion(baseConfig())
        const header = decodeProtectedHeader(token)
        expect(header.alg).toBe("RS256")
        expect(header.x5t).toBe(FAKE_CERT_THUMBPRINT)
    })

    it("derives x5t thumbprint from certificate PEM when no certThumbprint given", async () => {
        const { decodeProtectedHeader } = await import("jose")
        const config: MicrosoftCertConfig = {
            ...baseConfig(),
            certThumbprint: undefined,
            certificate: FAKE_CERT_PEM,
        }
        const token = await createMicrosoftClientAssertion(config)
        expect(decodeProtectedHeader(token).x5t).toBe(FAKE_CERT_THUMBPRINT)
    })

    it("caches thumbprint — second call with same cert PEM does not re-hash", async () => {
        // Use a unique cert body so this test has its own cache entry
        const uniqueDer = Buffer.from(`fdm-cache-test-${randomUUID()}`)
        const uniquePem = [
            "-----BEGIN CERTIFICATE-----",
            uniqueDer.toString("base64"),
            "-----END CERTIFICATE-----",
        ].join("\n")
        const config: MicrosoftCertConfig = {
            ...baseConfig(),
            certThumbprint: undefined,
            certificate: uniquePem,
        }
        const { decodeProtectedHeader } = await import("jose")

        const t1 = await createMicrosoftClientAssertion(config)
        const t2 = await createMicrosoftClientAssertion(config)

        // Both calls should produce the same x5t (cached)
        expect(decodeProtectedHeader(t1).x5t).toBe(decodeProtectedHeader(t2).x5t)
    })

    it("sets correct JWT claims (iss, sub, aud, exp)", async () => {
        const { decodeJwt } = await import("jose")
        const token = await createMicrosoftClientAssertion(baseConfig())
        const claims = decodeJwt(token)
        const expectedAud =
            "https://login.microsoftonline.com/test-tenant/oauth2/v2.0/token"
        expect(claims.iss).toBe("test-client-id")
        expect(claims.sub).toBe("test-client-id")
        expect(claims.aud).toBe(expectedAud)
        expect(typeof claims.jti).toBe("string")
        const lifetime = (claims.exp as number) - (claims.iat as number)
        expect(lifetime).toBeLessThanOrEqual(300)
        expect(lifetime).toBeGreaterThan(0)
    })

    it("defaults tenantId to 'common'", async () => {
        const { decodeJwt } = await import("jose")
        const config: MicrosoftCertConfig = {
            ...baseConfig(),
            tenantId: undefined,
        }
        const token = await createMicrosoftClientAssertion(config)
        expect((decodeJwt(token).aud as string)).toContain("/common/")
    })

    it("throws when neither certificate nor certThumbprint is provided", async () => {
        const config: MicrosoftCertConfig = {
            ...baseConfig(),
            certThumbprint: undefined,
            certificate: undefined,
        }
        await expect(createMicrosoftClientAssertion(config)).rejects.toThrow(
            "provide either 'certificate' (PEM) or 'certThumbprint'",
        )
    })

    it("reads privateKey from a file path", async () => {
        const { decodeProtectedHeader } = await import("jose")
        const tmpFile = join(tmpdir(), `fdm-test-key-${randomUUID()}.pem`)
        writeFileSync(tmpFile, privateKeyPem, "utf8")
        try {
            const token = await createMicrosoftClientAssertion({
                ...baseConfig(),
                privateKey: tmpFile,
            })
            expect(decodeProtectedHeader(token).alg).toBe("RS256")
        } finally {
            unlinkSync(tmpFile)
        }
    })

    it("reads certificate from a file path", async () => {
        const { decodeProtectedHeader } = await import("jose")
        const tmpFile = join(tmpdir(), `fdm-test-cert-${randomUUID()}.crt`)
        writeFileSync(tmpFile, FAKE_CERT_PEM, "utf8")
        try {
            const token = await createMicrosoftClientAssertion({
                ...baseConfig(),
                certThumbprint: undefined,
                certificate: tmpFile,
            })
            expect(decodeProtectedHeader(token).x5t).toBe(FAKE_CERT_THUMBPRINT)
        } finally {
            unlinkSync(tmpFile)
        }
    })

    it("throws when privateKey file path does not exist", async () => {
        await expect(
            createMicrosoftClientAssertion({
                ...baseConfig(),
                privateKey: "/nonexistent/path/key.pem",
            }),
        ).rejects.toThrow("MS_PRIVATE_KEY file not found")
    })

    it("throws when certificate file path does not exist", async () => {
        await expect(
            createMicrosoftClientAssertion({
                ...baseConfig(),
                certThumbprint: undefined,
                certificate: "/nonexistent/path/cert.crt",
            }),
        ).rejects.toThrow("MS_CERTIFICATE file not found")
    })
})

// ---------------------------------------------------------------------------
// createMicrosoftOAuthConfig
// ---------------------------------------------------------------------------

describe("createMicrosoftOAuthConfig", () => {
    it("returns a GenericOAuthConfig with providerId 'microsoft'", () => {
        const cfg = createMicrosoftOAuthConfig(baseConfig(), mockHelpers)
        expect(cfg.providerId).toBe("microsoft")
    })

    it("sets authorizationUrl and tokenUrl for the given tenantId", () => {
        const cfg = createMicrosoftOAuthConfig(baseConfig(), mockHelpers)
        expect(cfg.authorizationUrl).toContain("/test-tenant/")
        expect(cfg.tokenUrl).toContain("/test-tenant/")
    })

    it("defaults tenantId to 'common'", () => {
        const cfg = createMicrosoftOAuthConfig(
            { ...baseConfig(), tenantId: undefined },
            mockHelpers,
        )
        expect(cfg.authorizationUrl).toContain("/common/")
    })

    it("requests the expected scopes including User.Read", () => {
        const cfg = createMicrosoftOAuthConfig(baseConfig(), mockHelpers)
        expect(cfg.scopes).toContain("openid")
        expect(cfg.scopes).toContain("email")
        expect(cfg.scopes).toContain("User.Read")
        expect(cfg.scopes).toContain("offline_access")
    })

    it("enables PKCE", () => {
        expect(createMicrosoftOAuthConfig(baseConfig(), mockHelpers).pkce).toBe(true)
    })

    // -----------------------------------------------------------------------
    // getUserInfo
    // -----------------------------------------------------------------------

    describe("getUserInfo", () => {
        const buildIdToken = async (claims: Record<string, unknown>) => {
            const key = await importPKCS8(privateKeyPem, "RS256")
            return new SignJWT(claims)
                .setProtectedHeader({ alg: "RS256" })
                .setIssuedAt()
                .setExpirationTime("1h")
                .sign(key)
        }

        const fetchReturning = (ok: boolean, body?: ArrayBuffer) =>
            vi.fn().mockResolvedValue({
                ok,
                arrayBuffer: async () => body ?? new ArrayBuffer(0),
            } as unknown as Response)

        let originalFetch: typeof global.fetch

        beforeEach(() => {
            originalFetch = global.fetch
        })

        afterEach(() => {
            global.fetch = originalFetch
        })

        it("returns null when idToken is missing", async () => {
            const cfg = createMicrosoftOAuthConfig(baseConfig(), mockHelpers)
            const result = await cfg.getUserInfo!({ accessToken: "tok" } as any)
            expect(result).toBeNull()
        })

        it("extracts id, email, name, emailVerified from idToken", async () => {
            const idToken = await buildIdToken({
                sub: "user-123",
                email: "jane@example.com",
                name: "Jane Doe",
                email_verified: true,
            })
            global.fetch = fetchReturning(false)
            const cfg = createMicrosoftOAuthConfig(baseConfig(), mockHelpers)
            const result = await cfg.getUserInfo!({
                idToken,
                accessToken: "tok",
            } as any)
            expect(result?.id).toBe("user-123")
            expect(result?.email).toBe("jane@example.com")
            expect(result?.name).toBe("Jane Doe")
            expect(result?.emailVerified).toBe(true)
            expect(result?.image).toBeUndefined()
        })

        it("falls back to 'mail' claim when 'email' is absent", async () => {
            const idToken = await buildIdToken({
                sub: "s",
                mail: "mail@example.com",
                name: "Mail User",
            })
            global.fetch = fetchReturning(false)
            const cfg = createMicrosoftOAuthConfig(baseConfig(), mockHelpers)
            const result = await cfg.getUserInfo!({ idToken, accessToken: "tok" } as any)
            expect(result?.email).toBe("mail@example.com")
        })

        it("derives name from email when name claim is absent", async () => {
            const idToken = await buildIdToken({
                sub: "s",
                email: "noname@example.com",
            })
            global.fetch = fetchReturning(false)
            const cfg = createMicrosoftOAuthConfig(baseConfig(), mockHelpers)
            const result = await cfg.getUserInfo!({ idToken, accessToken: "tok" } as any)
            expect(result?.name).toBe("noname")
        })

        it("attaches base64 profile photo when Graph returns ok", async () => {
            const idToken = await buildIdToken({
                sub: "s",
                email: "photo@example.com",
                name: "Photo User",
            })
            const imgBytes = Buffer.from("img-bytes")
            global.fetch = fetchReturning(true, imgBytes.buffer)
            const cfg = createMicrosoftOAuthConfig(baseConfig(), mockHelpers)
            const result = await cfg.getUserInfo!({ idToken, accessToken: "tok" } as any)
            expect(result?.image).toMatch(/^data:image\/jpeg;base64,/)
        })

        it("throws microsoft_no_email when no email/mail in idToken", async () => {
            const idToken = await buildIdToken({ sub: "s", name: "No Email" })
            global.fetch = fetchReturning(false)
            const cfg = createMicrosoftOAuthConfig(baseConfig(), mockHelpers)
            await expect(
                cfg.getUserInfo!({ idToken, accessToken: "tok" } as any),
            ).rejects.toThrow("microsoft_no_email")
        })

        it("does not throw when Graph photo fetch fails", async () => {
            const idToken = await buildIdToken({
                sub: "s",
                email: "e@example.com",
                name: "Err User",
            })
            global.fetch = vi.fn().mockRejectedValue(new Error("network"))
            const cfg = createMicrosoftOAuthConfig(baseConfig(), mockHelpers)
            const result = await cfg.getUserInfo!({ idToken, accessToken: "tok" } as any)
            expect(result?.email).toBe("e@example.com")
            expect(result?.image).toBeUndefined()
        })
    })

    // -----------------------------------------------------------------------
    // mapProfileToUser
    // -----------------------------------------------------------------------

    describe("mapProfileToUser", () => {
        it("maps email and name to FDM user fields", async () => {
            const cfg = createMicrosoftOAuthConfig(baseConfig(), mockHelpers)
            const result = await cfg.mapProfileToUser!({
                email: "john@example.com",
                name: "John Doe",
            }) as Record<string, unknown>
            expect(result.email).toBe("john@example.com")
            expect(result.firstname).toBe("John")
            expect(result.surname).toBe("Doe")
            expect(result.username).toBe("john")
            expect(result.displayUsername).toBe("John Doe")
            expect(result.emailVerified).toBe(true)
        })
    })
})
