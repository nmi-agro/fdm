---
"@nmi-agro/fdm-rvo": patch
---

Support requesting RVO fields for the authenticated company itself:

- `fetchRvoFields`: the `kvkNumber` parameter is now optional. Omit it when a farmer requests the fields of their own farm; RVO then derives the farm from the eHerkenning identity. Pass it only when requesting data on behalf of another farm with a machtiging, as it is sent to RVO as `ThirdPartyFarmID`.
- `isRvoPermissionDeniedError`: recognises the `EDI009` (Toegang geweigerd) SOAP fault, which RVO returns with HTTP status 500 and which `@nmi-agro/rvo-connector` 2.4.0 throws as `RvoSoapFaultError`.
- Add `getRvoErrorDetails`, which returns the HTTP status, EDI-Crop error code and a short description of an RVO client error, without the raw response body.
- Upgrade `@nmi-agro/rvo-connector` to 2.4.0.
