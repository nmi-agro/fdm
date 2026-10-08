---
"@nmi-agro/fdm-app": patch
---

Fix importing fields from RVO for your own farm:

- Before connecting to RVO, the user now chooses whether they request data for their own farm ("Mijn eigen bedrijf") or on behalf of another farm with a machtiging ("Een ander bedrijf (machtiging)"). The KvK number is only sent to RVO for a machtiging, so farmers who log in with the eHerkenning of their own farm no longer get "Toegang geweigerd".
- When RVO denies access, the user sees a clear message for the chosen option instead of a general RVO error.
- Farm verifications are only recorded for requests with a machtiging, as a request for the own farm does not prove the farm's KvK number.
- The farm verification status, badges and explanations are hidden for now. The KvK number of a farm that is already verified stays locked.
