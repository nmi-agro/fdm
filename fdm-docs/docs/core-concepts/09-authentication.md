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
| `MS_TENANT_ID` | Tenant ID or authority segment (e.g. `common`, `organizations`, or a tenant GUID). Defaults to `common`, which allows any Microsoft account including personal accounts. |
| `MS_PRIVATE_KEY` | PKCS#8 PEM private key — inline content **or** a file path. Never commit this. |
| `MS_CERTIFICATE` | Full public certificate PEM — inline content **or** a file path. **Recommended** — thumbprint is computed automatically. This is the public half; it is not secret and may be stored in config. |
| `MS_CERT_THUMBPRINT` | Alternative to `MS_CERTIFICATE`: pre-computed base64url SHA-1 thumbprint (see below). |

Provide either `MS_CERTIFICATE` or `MS_CERT_THUMBPRINT`. Both `MS_PRIVATE_KEY` and `MS_CERTIFICATE` accept either the **inline PEM content** or a **file path** to the `.pem`/`.crt` file. This mirrors the behaviour of `RVO_PKIO_PRIVATE_KEY` used in the RVO integration: if the value starts with a path prefix (`/`, `./`, `../`, or a Windows drive letter), the file is read at startup; otherwise the value is treated as inline PEM content. Using `MS_CERTIFICATE` (rather than `MS_CERT_THUMBPRINT`) is simpler — the Entra portal truncates the thumbprint display, making it difficult to copy.

**Generating the key pair:**

```bash
# Linux/macOS or PowerShell (recommended on Windows — no path expansion issues):
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout ms-signin-private.pem \
  -out ms-signin-public.crt \
  -days 730 \
  -subj "/CN=fdm-microsoft-signin"

# Git Bash on Windows — set MSYS_NO_PATHCONV=1 to prevent path expansion:
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout ms-signin-private.pem \
  -out ms-signin-public.crt \
  -days 730 \
  -subj "/CN=fdm-microsoft-signin"
```

Upload `ms-signin-public.crt` in Entra: **App registration → Certificates & secrets → Certificates → Upload certificate**.

Set `MS_CERTIFICATE` to the full contents of `ms-signin-public.crt` (including the `-----BEGIN CERTIFICATE-----` header/footer). Set `MS_PRIVATE_KEY` to the full contents of `ms-signin-private.pem` and store it in Google Secret Manager.

If you prefer `MS_CERT_THUMBPRINT` over `MS_CERTIFICATE`, compute it locally (the portal display is truncated):

```bash
openssl x509 -in ms-signin-public.crt -outform DER | openssl dgst -sha1 -binary | base64 | tr '+/' '-_' | tr -d '='
```

**Certificate rotation:** upload the new certificate in Entra (keep both valid during rollover), then update `MS_PRIVATE_KEY` and the cert/thumbprint env vars.

## Session Management

FDM uses a database-backed session system managed by Better Auth.

* **Session Storage:** Sessions are stored in the database using the Drizzle ORM adapter. This allows for server-side session control and revocation.
* **Expiration:** By default, sessions are configured to expire after 30 days.
* **Renewal:** Active sessions are automatically updated every 24 hours to extend their validity.

## Implementation Details

The core authentication logic resides in `fdm-core/src/authentication.ts`.

* **Schema Extensions:** The user schema is extended to include FDM-specific fields such as `firstname`, `surname`, `lang`, and `farm_active`.
* **Organizations:** The system utilizes the Better Auth organization plugin, which supports the creation and management of organizations within the authentication flow.
