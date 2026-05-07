---
"@nmi-agro/fdm-core": minor
---

Add API key support and audit channel tracking

Users can now authenticate with personal API keys in addition to browser sessions. The database schema includes a new table for storing API keys securely (hashed), and every permission check now records whether it was triggered from the web app or the API.
