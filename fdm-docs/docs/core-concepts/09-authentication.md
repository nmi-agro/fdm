---
title: Authentication
---

Authentication is the process of verifying the identity of a user. The Farm Data Model (FDM) utilizes the [Better Auth](https://better-auth.com/) library to provide a standard authentication system. This implementation supports multiple authentication strategies and handles session management through a database-backed approach.

## Supported Strategies

FDM is configured to support several authentication methods. The availability of these methods can depend on the specific configuration of the FDM instance.

### Magic Links

FDM supports passwordless authentication via Magic Links.

* Users provide their email address.
* The system sends a secure, time-limited link to that email.
* Clicking the link authenticates the user without requiring a password.

### OAuth Providers

FDM includes integration with **Google** and **Microsoft** OAuth providers.

* **Account Linking:** Users can log in using their existing Google or Microsoft accounts.
* **Profile Mapping:** Upon login, FDM maps profile information from the provider (First Name, Last Name, and Profile Picture) to the FDM user profile.
* **User Creation:** New users authenticating via OAuth are automatically provisioned with a unique username and default settings (e.g., language preference set to `nl-NL`).

#### Microsoft sign-in — certificate credential

Microsoft sign-in uses a **certificate credential** (`private_key_jwt`) rather than a client secret. Only the public certificate is uploaded to the Entra app registration; the private key stays on the server and is never transmitted. Each token request is authenticated by a short-lived signed JWT assertion.

**Required environment variables:**

| Variable | Description |
|---|---|
| `MS_CLIENT_ID` | Azure app registration client ID |
| `MS_TENANT_ID` | Tenant segment (`common`, `organizations`, a GUID). Defaults to `common`. |
| `MS_PRIVATE_KEY` | Inline PKCS#8 PEM private key (`-----BEGIN PRIVATE KEY-----`) |
| `MS_CERTIFICATE` | PEM certificate (public; used to compute the `x5t` thumbprint). Provide this **or** `MS_CERT_THUMBPRINT`. |
| `MS_CERT_THUMBPRINT` | Pre-computed SHA-1 thumbprint (base64url). Shown in Entra after uploading the certificate. |

**Generating the key pair:**

```bash
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout ms-signin-private.pem \
  -out ms-signin-public.crt \
  -days 730 \
  -subj "/CN=fdm-microsoft-signin"
```

Upload `ms-signin-public.crt` in Entra: **App registration → Certificates & secrets → Certificates → Upload certificate**.  
Store the contents of `ms-signin-private.pem` as `MS_PRIVATE_KEY` in a secure place.

**Certificate rotation:** upload the new certificate in Entra (keep both valid during rollover), then update `MS_PRIVATE_KEY` and the thumbprint/cert env vars.

## Session Management

FDM uses a database-backed session system managed by Better Auth.

* **Session Storage:** Sessions are stored in the database using the Drizzle ORM adapter. This allows for server-side session control and revocation.
* **Expiration:** By default, sessions are configured to expire after 30 days.
* **Renewal:** Active sessions are automatically updated every 24 hours to extend their validity.

## Implementation Details

The core authentication logic resides in `fdm-core/src/authentication.ts`.

* **Schema Extensions:** The user schema is extended to include FDM-specific fields such as `firstname`, `surname`, `lang`, and `farm_active`.
* **Organizations:** The system utilizes the Better Auth organization plugin, which supports the creation and management of organizations within the authentication flow.
