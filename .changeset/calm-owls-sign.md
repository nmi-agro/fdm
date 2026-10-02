---
"@nmi-agro/fdm-app": patch
---

Microsoft sign-in now uses the Better Auth social flow. The redirect URI in the Entra app registration must be changed to `<BETTER_AUTH_URL>/api/auth/callback/microsoft`.
