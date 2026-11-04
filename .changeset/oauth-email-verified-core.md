---
"@nmi-agro/fdm-core": patch
---

Update Better Auth to 1.7.16. Google and Microsoft sign-ins now only mark an email address as verified when the provider reports it as verified, so an unverified address is no longer linked automatically to an existing account. Adds `isMicrosoftEmailVerified`, which accepts `email_verified`, `xms_edov`, `verified_primary_email`/`verified_secondary_email` and personal Microsoft accounts.
