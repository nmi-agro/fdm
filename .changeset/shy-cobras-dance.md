---
"@nmi-agro/fdm-core": patch
"@nmi-agro/fdm-app": patch
---

Switch the magic-link sign-in code to a 6-digit numeric code (previously an 8-character alphanumeric code). This ensures mobile devices consistently show a numeric keypad for entry and makes the code faster to type, while remaining safe from brute-forcing thanks to the existing 5-attempts-per-15-minutes rate limit on code verification.
