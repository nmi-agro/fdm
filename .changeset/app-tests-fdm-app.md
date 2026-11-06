---
"@nmi-agro/fdm-app": patch
---

**Behaviour change in all forms:** an action that is refused for lack of permission, or called with a missing or invalid id, now answers with status 403 or 400 instead of 200 (`handleActionError` in `app/lib/error.ts`). The toast is unchanged and still appears, because the root loader reloads after every submission. Other loaders on the page no longer reload after such a refused action, which is fine because nothing was saved.

For developers, fdm-app now has automated tests, run in CI by the new `app` job:

- `react-router build` runs on every push, so server-only imports in client code and invalid route exports fail the build check.
- Unit tests (`pnpm test:unit`) for pure modules in `app/lib` and the field stores, next to the existing manual tests. They need no database.
- Loader and action tests (`pnpm test:integration`, in `test/`) call route modules directly against a PostGIS test database, with only the session replaced. They cover access to another user's farm, validation, redirects and the data a loader returns. `pnpm test` runs both.
- A Playwright smoke suite (`pnpm e2e`) runs the production build against an empty database with a synthetic farm. It visits every GET route of the build and fails on an error page, a 5xx response or an error in the browser, and it runs five critical flows: creating a farm, adding a crop and a fertilizer application, viewing the nitrogen balance and nutrient advice, and sharing a farm and accepting the invitation. External services are off. A route whose params the suite cannot fill in must be listed with a reason.
- The demo farm seed can create a farm for any synthetic user and returns the ids of the crops, harvests, applications and soil analyses it adds.
