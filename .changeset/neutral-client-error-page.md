---
"@nmi-agro/fdm-app": patch
---

Collapsed 400/403/404 client errors into a single neutral "Deze pagina is niet beschikbaar" page so the app no longer discloses whether a resource is missing or the user simply lacks access to it, removing the leaked route-specific `statusText` and resource IDs. Genuine 5xx server errors keep their detailed page.
