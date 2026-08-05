---
name: fdm-app-conventions
description: Use when writing or changing code in the fdm-app package — adding or editing routes, loaders and actions, server/client module boundaries, session handling and permission checks in the UI, error handling with handleLoaderError and handleActionError, forms and toasts, Zustand stores, component placement under app/components, or integrations with external services. Covers React Router v8 framework mode, flat file-based routing, the .server.ts/.client.ts split, and the conventions that keep this untested 100k-line package consistent. Not for visual or UX design decisions (see the impeccable skill and DESIGN.md), the fdm-core data model (see fdm-schema), or REST endpoint design (see fdm-api).
version: 1.0.0
user-invocable: true
argument-hint: "[explain|add-route|add-component|add-store|review] [target]"
license: MIT
---

`fdm-app` is the reference application and the only end-user surface: 616 files and roughly 104,000 lines, with **no test suite**. Nothing will catch a broken convention for you, so consistency with the surrounding code is the actual safety mechanism. Before writing anything new, read a neighbouring route or component and follow it.

**Scope.** This skill owns the mechanics: routing, data loading, module boundaries, error handling, state and file placement. It does not own how the interface should look or feel — that is the `impeccable` skill together with `fdm-app/PRODUCT.md` and `fdm-app/DESIGN.md`. It does not own the data model (`fdm-schema`) or the REST API (`fdm-api`). See `.github/skills/README.md`.

## Commands

| Command | Do this |
|---|---|
| `explain [topic]` | Answer from this skill; read the nearest existing route or component as the worked example. |
| `add-route` | Follow Routing, then Loaders and actions, then Errors. Copy the shape of a sibling route file. |
| `add-component` | Follow Components: decide `ui/` vs `blocks/` vs `custom/` before writing. |
| `add-store` | Follow State: Zustand in `app/store/`, only for genuine client state. |
| `review [diff]` | Check the Anti-patterns table, especially server/client leakage and missing permission checks. |
| — | Verify with `cd fdm-app && pnpm check-types` (runs `react-router typegen && tsc --noEmit`). |

## Stack

React Router **v8** in framework mode, Vite, Tailwind v4, shadcn/ui (new-york, slate, CSS variables), radix-ui, Zustand, next-themes, lucide-react, recharts, maplibre-gl. Server-side data comes from `@nmi-agro/fdm-core` and `@nmi-agro/fdm-calculator`.

The package imports the **built `dist`** of the workspace libraries. After changing `fdm-core` or `fdm-calculator`, run `pnpm turbo build` or the app will not see the change.

Two React Router v8 details that commonly trip up generated code: the package is `react-router`, never `react-router-dom`; and matches expose `loaderData`, not `data`, in `useMatches` and `MetaArgs`.

## Layout

```
app/
  root.tsx, entry.client.tsx, entry.server.tsx, routes.ts, tailwind.css
  routes/        156 flat route modules
  components/
    ui/          shadcn primitives — generated, not hand-authored
    blocks/      feature components, grouped per domain (farm/, field/, fertilizer/, …)
    custom/      shared cross-feature components that are not shadcn primitives
  lib/           server and shared helpers; *.server.ts is server-only
  integrations/  external services (nmi, rvo, gcs, bln3, ahn, mineralization)
  store/         Zustand stores
  hooks/         React hooks
  types/
```

## Routing

`app/routes.ts` is a single line — `flatRoutes()` from `@react-router/fs-routes` — so **the filename is the route**. Segments are dot-separated, `$` marks a parameter, `_index` is the index route, and a leading `_` makes a pathless layout:

```
farm.$b_id_farm._index.tsx           → /farm/:b_id_farm
farm.$b_id_farm.field.$b_id.tsx      → /farm/:b_id_farm/field/:b_id
api.gerrit.stream.ts                 → /api/gerrit/stream  (resource route, no component)
api.soil-analysis.download.$a_id[.]pdf.ts  → literal dot escaped with [.]
```

Route parameters use the schema column names (`$b_id_farm`, `$b_id`, `$a_id`), not invented names like `$farmId`. Resource routes that return data rather than UI are `.ts` and export only a loader or action.

## Loaders and actions

Every route that reads farm data follows the same order: validate params, get the session, check permission, fetch, return. Errors are funnelled through the shared helpers.

```ts
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }
    const session = await getSession(request)
    const farm = await getFarm(fdm, session.principal_id, b_id_farm)
    return { farm }
  } catch (error) {
    throw handleLoaderError(error)
  }
}
```

- **`getSession(request)`** from `~/lib/auth.server` is the only way to identify the user. It throws a 401 `Response` when there is no session, and `handleLoaderError` turns that into a redirect to `/signin`.
- **The principal from the session** is passed to every `fdm-core` call. Never trust a principal id from params, the body, or a hidden form field.
- **Permission checks are explicit.** Reads are enforced by the core functions, but anything that renders or gates a write uses `checkPermission(fdm, resource, action, id, session.principal_id, "<caller>")` and either hides the affordance or throws 403.
- **Missing or invalid params throw `data(message, { status })`**, which is the dominant convention in the route modules (288 uses against 20 raw `Response` throws). The error helpers understand both shapes, but `data()` keeps status and statusText where the rest of the codebase expects them.
- **Wrap the body in `try/catch`** and re-throw through `handleLoaderError(error)` in loaders and `handleActionError(error)` in actions. These map 400/401/403/404 to Dutch user-facing messages, redirect to sign-in on 401, and for anything unexpected generate a short error id, report it to Sentry, and surface that id to the user. Never render a raw error message.
- **Actions branch on an intent field** and end with `throw data("Ongeldige actie", { status: 400 })` for an unrecognised branch.
- **Successful actions return `dataWithSuccess(...)`** from `remix-toast` so the user gets feedback; `dataWithError` / `dataWithWarning` are the failure equivalents.
- **Bound external calls.** Loaders that fan out to an external API per field limit concurrency with an explicit constant rather than issuing unbounded `Promise.all`.

Every route also exports `meta` returning a title of the form `` `Pagina | ${clientConfig.name}` `` plus a description.

## Server and client boundaries

Server-only modules end in `.server.ts` (29 of them) and client-only modules in `.client.ts`. This is enforced by convention and by Vite's treatment of the suffix, not by the type system, and it is the easiest thing to get wrong:

- Database access, secrets, and `serverConfig` are reachable only from `.server.ts` files and from loaders/actions. `app/lib/fdm.server.tsx` holds the single Drizzle connection; never construct another.
- `~/lib/config.server` is server-only; the browser-safe subset is `~/lib/clientConfig` from `~/lib/config`.
- External integrations live in `app/integrations/*.server.ts` and are called from loaders and actions, never from a component.
- A component may not import a `.server` module, directly or transitively. If a component needs server data, the route loader fetches it and passes it down.

## Components

Decide placement before writing:

| Directory | Contents | Rule |
|---|---|---|
| `components/ui/` | shadcn primitives (46 files) | Generated by the shadcn CLI. Do not hand-write files here; do not restyle a primitive to suit one screen. |
| `components/blocks/<domain>/` | Feature components (306 files) | The default home for new UI. Group by domain: `farm/`, `field/`, `fertilizer-applications/`, `soil/`, `norms/`, … |
| `components/custom/` | Cross-feature shared components | Only when a component is genuinely used across domains and is not a shadcn primitive. |

Imports use the `~/` alias (`~/components/ui/button`, `~/lib/utils`), never deep relative paths. Class names compose through `cn()` from `~/lib/utils`.

UI copy is **Dutch**, including error and empty states. Keep strings out of deeply nested logic so they remain extractable for future i18n.

## State

Server state belongs in loaders; it is not copied into a store. Zustand stores in `app/store/` are for genuine client state that must outlive a component or cross the tree — selected field, calendar selection, filters, form drafts.

Stores that must survive a reload wrap `persist` with a storage helper from `~/store/storage`: `ssrSafeSessionJSONStorage` for per-session state or `ssrSafeJSONStorage` for state that should outlive the tab. Using `sessionStorage` or `localStorage` directly breaks server rendering.

## Verification

There is no test suite. The available checks are:

```bash
cd fdm-app && pnpm check-types   # react-router typegen && tsc --noEmit
pnpm lint                        # oxlint, from the repository root
pnpm --filter fdm-app dev        # http://localhost:5173
```

`dev` needs a PostgreSQL instance with PostGIS running and reachable through the `POSTGRES_*` variables in `fdm-app/.env`; developers normally run one locally on the machine.

Run `check-types` after any route change: `typegen` regenerates the route types, so a mismatched loader signature only surfaces there. Migrations run automatically on `dev` startup via `app/lib/fdm-migrate.server.js`.

Every change to `fdm-app` needs a changeset (`pnpm changeset`). Not being published to a registry does not exempt it: the package is versioned like any other (`ignore` is empty in `.changeset/config.json`), and its `CHANGELOG.md` is how users and fellow contributors see what shipped.

## Anti-patterns

| Anti-pattern | Instead |
|---|---|
| `import { … } from "react-router-dom"` | `react-router` — this repo is on v8 |
| `useMatches()` match `.data` | `.loaderData` |
| A component importing `~/lib/*.server` | Load in the route loader, pass as props |
| `new Drizzle(...)` or a second db connection | The shared `fdm` from `~/lib/fdm.server` |
| Reading a principal id from params or a form field | `(await getSession(request)).principal_id` |
| `throw new Response("...", { status })` in a route | `throw data("...", { status })` |
| Returning a caught error's `.message` to the UI | `handleLoaderError` / `handleActionError` |
| An action with no `dataWithSuccess` feedback | Return a toast helper from `remix-toast` |
| Unbounded `Promise.all` over every field to an external API | A concurrency constant, as in the existing loaders |
| New component dropped into `components/ui/` | `components/blocks/<domain>/` |
| Hand-editing a shadcn primitive for one screen | Compose around it, or add a variant |
| Copying loader data into a Zustand store | Read it from `useLoaderData` |
| `localStorage` directly in a persisted store | `ssrSafeJSONStorage` / `ssrSafeSessionJSONStorage` |
| English UI strings | Dutch |
| Editing `fdm-core` and testing here without rebuilding | `pnpm turbo build` first — this app consumes `dist` |
