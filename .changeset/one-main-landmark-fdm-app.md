---
"@nmi-agro/fdm-app": patch
---

Give every page one `main` landmark. The app shell of the farm, organization, account and support pages renders the `main`; the pages inside it now use a plain container instead of a nested `SidebarInset` or `main`, so screen readers no longer find two or three nested main regions. The layout does not change.
