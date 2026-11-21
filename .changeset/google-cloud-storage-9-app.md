---
"@nmi-agro/fdm-app": patch
---

Use the not-found check of fdm-storage for missing files in the profile picture and helpdesk download routes, because `@google-cloud/storage` 9 no longer exports `ApiError`.
