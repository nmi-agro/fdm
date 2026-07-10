---
"@nmi-agro/fdm-core": patch
"@nmi-agro/fdm-app": patch
---

Simplify the magic-link sign-in code to a 6-digit numeric OTP

- The sign-in code is now 6 numeric digits instead of an 8-character alphanumeric code, so it can be typed on the numeric keyboard that mobile devices (notably iOS) show for code entry
- The code input, validation, verify-page copy, and the magic-link email formatting (now `XXX-XXX`) are updated to match
- Security is unchanged: the 15-minute expiry and 5-attempt rate limit on the verify endpoint still apply
