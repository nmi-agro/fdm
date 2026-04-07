# Bug: RVO OAuth callback redirects to root (`/`) instead of the originating page

**Labels:** `bug`, `rvo`, `oauth`

## Description

After completing the RVO eHerkenning OAuth login flow, users are redirected back to the
application root (`/`) instead of the page they initiated the flow from. The authorization
code and state parameters are returned to the root route, which does not handle them —
causing the OAuth callback to be silently ignored.

**Example redirect URL returned by RVO:**
```
https://minas2.nl/?code=9wKFvFCqZ__gOUt8yBtslkFpJTobKuS-v1wDooDSI2s&state=eyJmYXJtSWQiOiJ0VFRQODk2bUxwN3drdGI4IiwicmV0dXJuVXJsIjoiLyIsIm5vbmNlIjoicDkzc08xTHdJVVEzbm9xSUFtb3NUIn0%3D
```

Decoding the `state` payload reveals:

```json
{
  "farmId": "tTTP896mLp7wktb8",
  "returnUrl": "/",
  "nonce": "p93sO1LwIUQ3noqIAmoST"
}
```

Note that `returnUrl` is `"/"` — the fallback value — instead of the originating page
(e.g. `/farm/tTTP896mLp7wktb8/2024/rvo`).

## Steps to Reproduce

1. Navigate to `/farm/{b_id_farm}/{year}/rvo` or `/farm/create/{b_id_farm}/{year}/rvo`
2. Click the button to load fields from RVO
3. Complete the eHerkenning login at RVO
4. Observe: browser lands on `https://minas2.nl/?code=...&state=...` (root) instead of the `/rvo` page
5. Fields are never imported; the user must start over

## Root Cause

There are two compounding issues:

### 1. `redirect_uri` points to the app root

The `redirectUri` passed to `createRvoClient()` (via environment variable) is configured as
the app root (e.g. `https://minas2.nl/`). This is the URL RVO uses to return the user after
authentication. However, the OAuth callback-handling logic lives in the route-level loaders:

- `fdm-app/app/routes/farm.$b_id_farm.$calendar.rvo.tsx`
- `fdm-app/app/routes/farm.create.$b_id_farm.$calendar.rvo.tsx`

These loaders check for `code` and `state` query params, but they are never reached when
RVO redirects to `/`. The params are silently discarded and the user sees an empty home page.

### 2. `returnUrl` falls back to `"/"`

In `fdm-app/app/integrations/rvo.server.ts`, `createRvoState()` validates the return URL
with an origin check before storing it in the OAuth state:

```ts
const appOrigin = new URL(serverConfig.url).origin
const safeReturnUrl = isOfOrigin(returnUrl, appOrigin) ? returnUrl : "/"
```

The decoded state above confirms this check is failing — the fallback `"/"` is stored
instead of the current page URL. The likely cause is a mismatch between `serverConfig.url`
and the actual request origin (e.g. HTTP vs HTTPS, or a misconfigured `FDM_URL` env var).

## Expected Behaviour

After RVO authentication completes, the user should be redirected back to the RVO page
they initiated the flow from, the `code` and `state` should be processed, and the fields
imported successfully.

## Proposed Fix

### Step 1 — Create a dedicated `/rvo/callback` route

Introduce `fdm-app/app/routes/rvo.callback.tsx` as the single, stable OAuth callback
endpoint. This route:

- Reads `code` and `state` from query params
- Calls `verifyRvoState()` to validate CSRF state
- Decodes `returnUrl` from the state payload
- Performs the token exchange via `exchangeToken()`
- Redirects to `returnUrl` so the originating page can continue the import flow

Using a dedicated route avoids duplicating callback logic across two routes and gives a
single URL to register with RVO.

### Step 2 — Update the registered `redirect_uri`

Update the `REDIRECT_URI` environment variable and the RVO application registration to
point to `/rvo/callback` (e.g. `https://minas2.nl/rvo/callback`). The `redirectUri`
parameter in `fdm-rvo/src/auth.ts` `createRvoClient()` must match exactly.

### Step 3 — Fix the `isOfOrigin` check in `createRvoState`

Investigate why `serverConfig.url` does not match the incoming request origin. Options:

- Ensure `FDM_URL` is set to the full production URL including scheme (`https://`)
- Or store only the URL **path** in `returnUrl` (e.g. `/farm/abc/2024/rvo`) to avoid
  origin comparison entirely — a path-only value can never be an open redirect

## Affected Files

| File | Change |
|------|--------|
| `fdm-rvo/src/auth.ts` | `redirectUri` must match the new callback route |
| `fdm-app/app/integrations/rvo.server.ts` | Fix `isOfOrigin` check / store path only |
| `fdm-app/app/routes/farm.$b_id_farm.$calendar.rvo.tsx` | Remove inline callback handling |
| `fdm-app/app/routes/farm.create.$b_id_farm.$calendar.rvo.tsx` | Remove inline callback handling |
| `fdm-app/app/routes/rvo.callback.tsx` | *(new)* Dedicated OAuth callback route |
| Environment / deployment config | Update `REDIRECT_URI` env var |
