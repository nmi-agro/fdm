---
"@nmi-agro/fdm-app": patch
---

Fix importing fields from RVO for your own farm:

- Before connecting to RVO, the user now chooses which eHerkenning they log in with: the eHerkenning of the farm itself, or the eHerkenning of their own organisation with a machtiging for the farm at RVO. The options mention the farm by name. The KvK number is only sent to RVO for a machtiging, so farmers who log in with the eHerkenning of their own farm no longer get "Toegang geweigerd".
- When RVO denies access, the import page now shows a message for the chosen option with an "Opnieuw verbinden" button that pre-selects the other option, instead of a generic "page not available" page.
- Updated the design of the "Percelen ophalen bij RVO" card. It now asks the choice first, explains what is read from RVO and that nothing changes before the user reviews the differences, shows the KvK number as plain text with a link to change it, and explains inline when no option is chosen yet.
- When RVO returns no fields, the message now depends on the chosen option.
- Farm verifications are only recorded for requests with a machtiging, as a request for the own farm does not prove the farm's KvK number.
- The farm verification status, badges and explanations are hidden for now. The KvK number of a farm that is already verified stays locked.
