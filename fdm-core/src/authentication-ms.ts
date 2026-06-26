import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs"
import type { GenericOAuthConfig } from "better-auth/plugins"
import { decodeJwt, importPKCS8, SignJWT } from "jose"

const AUTHORITY = "https://login.microsoftonline.com"
const PROFILE_PHOTO_SIZE = 48
const SCOPES = ["openid", "profile", "email", "User.Read", "offline_access"]

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function loadPrivateKey(pemKey: string) {
  return importPKCS8(pemKey, "RS256")
}

/**
 * Computes the `x5t` (X.509 certificate SHA-1 thumbprint) from a PEM
 * certificate. The value is base64url-encoded per RFC 7517 §4.8.
 */
async function computeX5t(certificatePem: string): Promise<string> {
  const der = pemToDer(certificatePem)
  const sha1 = createHash("sha1").update(der).digest()
  return Buffer.from(sha1)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

/**
 * Strips the PEM header/footer and base64-decodes the body to get raw DER.
 */
function pemToDer(pem: string): Buffer {
  const body = pem
    .replace(/-----BEGIN[^-]+-----/, "")
    .replace(/-----END[^-]+-----/, "")
    .replace(/\s/g, "")
  return Buffer.from(body, "base64")
}

// Cache the x5t per certificate PEM so we don't re-hash on every request
const thumbprintCache = new Map<string, string>()

/**
 * Resolves a value that is either an inline PEM string or a file path.
 * If the value looks like a file path (absolute or relative) and the file
 * exists, the file content is returned; otherwise the value is returned as-is.
 * Mirrors the pattern used by fdm-rvo for `RVO_PKIO_PRIVATE_KEY`.
 */
function resolveFileOrInline(value: string, label: string): string {
  // If the value contains PEM headers, it's inline
  if (value.includes("-----BEGIN")) {
    let key = value.replace(/\\n/g, "\n").trim()
    key = key.replace(/^["']|["']$/g, "").trim()
    key = key.replace(/\\r/g, "")
    return key
  }

  // Otherwise, treat it as a file path
  if (fs.existsSync(value)) {
    return fs
      .readFileSync(value, "utf8")
      .replace(/^\uFEFF/, "")
      .trim()
  }

  // If it doesn't exist but has no PEM headers, it's likely a missing file
  throw new Error(`Microsoft cert auth: ${label} file not found: ${value}`)
}

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/**
 * Configuration for Microsoft Entra ID sign-in using a certificate credential.
 *
 * Only the public certificate is uploaded to the Entra app registration.
 * The private key stays on the server and is never transmitted.
 *
 * @see https://learn.microsoft.com/en-us/entra/identity-platform/certificate-credentials
 */
export interface MicrosoftCertConfig {
  /** Azure app registration client ID */
  clientId: string
  /**
   * Tenant segment for the token/authorization endpoints.
   * Use `"common"` to allow any Microsoft account (default), `"organizations"` for work/school
   * accounts only, or a specific tenant GUID to restrict to one organisation.
   * @default "common"
   */
  tenantId?: string
  /**
   * Inline PKCS#8 PEM private key (`-----BEGIN PRIVATE KEY-----`).
   * This is the private half of the certificate pair; it must never be
   * exposed to the browser or committed to source control.
   */
  privateKey: string
  /**
   * PEM certificate (public; `-----BEGIN CERTIFICATE-----`).
   * Used to compute the `x5t` thumbprint for the JWT header.
   * Provide either this or `certThumbprint`.
   */
  certificate?: string
  /**
   * Pre-computed SHA-1 thumbprint of the certificate, base64url-encoded.
   * Shown in the Entra portal after uploading the certificate.
   * Alternative to providing the full `certificate` PEM.
   */
  certThumbprint?: string
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Builds an RS256 client-assertion JWT for authenticating to Microsoft Entra ID
 * with a certificate credential (private_key_jwt).
 *
 * The assertion is short-lived (5 minutes) and must be regenerated per request.
 *
 * @see https://learn.microsoft.com/en-us/entra/identity-platform/certificate-credentials
 */
export async function createMicrosoftClientAssertion(
  config: MicrosoftCertConfig,
  authority = AUTHORITY,
): Promise<string> {
  const { clientId, tenantId = "common", certificate, certThumbprint } = config

  const privateKey = resolveFileOrInline(config.privateKey, "MS_PRIVATE_KEY")

  // Resolve the x5t thumbprint
  let x5t: string
  if (certThumbprint) {
    x5t = certThumbprint
  } else if (certificate) {
    const certPem = resolveFileOrInline(certificate, "MS_CERTIFICATE")
    if (!thumbprintCache.has(certPem)) {
      thumbprintCache.set(certPem, await computeX5t(certPem))
    }
    x5t = thumbprintCache.get(certPem)!
  } else {
    throw new Error(
      "Microsoft certificate auth: provide either 'certificate' (PEM) or 'certThumbprint'",
    )
  }

  const tokenEndpoint = `${authority}/${tenantId}/oauth2/v2.0/token`
  const now = Math.floor(Date.now() / 1000)
  const key = await loadPrivateKey(privateKey)

  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT", x5t })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(tokenEndpoint)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 300) // 5 minutes
    .sign(key)
}

/**
 * Helpers that `createMicrosoftOAuthConfig` needs from `fdm-core/authentication`.
 * Passed as parameters to avoid a circular import between the two modules.
 */
export interface MicrosoftOAuthHelpers {
  splitFullName: (fullName?: string) => {
    firstname: string | null
    surname: string | null
  }
  createUsername: (email: string) => Promise<string>
  createDisplayUsername: (firstname?: string | null, surname?: string | null) => string | null
}

/**
 * Builds a `GenericOAuthConfig` for Microsoft Entra ID that authenticates
 * with a certificate credential (private_key_jwt) instead of a client secret.
 *
 * All Microsoft-specific logic lives here: token exchange, profile photo fetch,
 * id_token decoding, and FDM user-field mapping.
 *
 * @param config Certificate configuration (client ID, tenant, private key, cert/thumbprint).
 * @param helpers FDM user-mapping helpers — passed to avoid a circular dependency.
 */
export function createMicrosoftOAuthConfig(
  config: MicrosoftCertConfig,
  helpers: MicrosoftOAuthHelpers,
): GenericOAuthConfig {
  const { clientId, tenantId = "common" } = config
  const authority = AUTHORITY
  const tokenEndpoint = `${authority}/${tenantId}/oauth2/v2.0/token`

  return {
    providerId: "microsoft",
    authorizationUrl: `${authority}/${tenantId}/oauth2/v2.0/authorize`,
    tokenUrl: tokenEndpoint,
    clientId,
    scopes: SCOPES,
    pkce: true,
    prompt: "select_account",

    // ---------------------------------------------------------------
    // Token exchange: code → tokens using a certificate client assertion
    // ---------------------------------------------------------------
    getToken: async ({ code, redirectURI, codeVerifier }) => {
      const assertion = await createMicrosoftClientAssertion(config, authority)
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectURI,
        client_id: clientId,
        scope: SCOPES.join(" "),
        client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: assertion,
      })
      if (codeVerifier) body.set("code_verifier", codeVerifier)

      const resp = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body,
      })
      if (!resp.ok) {
        const errorText = await resp.text()
        throw new Error(`Microsoft token request failed (${resp.status}): ${errorText}`)
      }
      const data = (await resp.json()) as {
        access_token: string
        token_type: string
        expires_in: number
        refresh_token?: string
        id_token?: string
        scope?: string
      }
      return {
        accessToken: data.access_token,
        tokenType: data.token_type,
        accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        scopes: data.scope?.split(" "),
        raw: data as unknown as Record<string, unknown>,
      }
    },

    // ---------------------------------------------------------------
    // User info: decode id_token + fetch profile photo from Graph
    // ---------------------------------------------------------------
    getUserInfo: async (tokens) => {
      if (!tokens.idToken) return null
      const claims = decodeJwt(tokens.idToken)

      // Profile photo from Graph (best-effort)
      let picture: string | undefined
      try {
        const photoResp = await fetch(
          `https://graph.microsoft.com/v1.0/me/photos/${PROFILE_PHOTO_SIZE}x${PROFILE_PHOTO_SIZE}/$value`,
          {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          },
        )
        if (photoResp.ok) {
          const buf = await photoResp.arrayBuffer()
          picture = `data:image/jpeg;base64, ${Buffer.from(buf).toString("base64")}`
        }
      } catch {
        // photo is best-effort
      }

      const email = (claims.email as string | undefined) || (claims.mail as string | undefined)
      if (!email) throw new Error("microsoft_no_email")

      const name =
        (claims.name as string | undefined) ||
        (claims.displayName as string | undefined) ||
        email.split("@")[0]

      const emailVerified =
        claims.email_verified !== undefined
          ? Boolean(claims.email_verified)
          : !!(email && (claims.verified_primary_email as string[] | undefined)?.includes(email))

      return {
        id: claims.sub as string,
        name,
        email,
        image: picture,
        emailVerified,
      }
    },

    // ---------------------------------------------------------------
    // Map provider profile to FDM-specific user fields
    // ---------------------------------------------------------------
    mapProfileToUser: async (profile) => {
      const email = profile.email as string
      const name = profile.name as string
      const { firstname, surname } = helpers.splitFullName(name)
      return {
        name,
        email,
        emailVerified: true,
        firstname,
        surname,
        username: await helpers.createUsername(email),
        displayUsername: helpers.createDisplayUsername(firstname, surname),
      }
    },
  }
}
