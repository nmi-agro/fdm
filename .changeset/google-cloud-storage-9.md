---
"@nmi-agro/fdm-storage": patch
---

Update `@google-cloud/storage` to version 9. The client no longer exports `ApiError`, so not-found and transient-network errors are now recognised by their HTTP status instead. `isGcsNotFoundError` is exported for callers that need the same check.
