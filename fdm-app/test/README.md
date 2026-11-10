# Loader and action tests

The `integration` project of `vitest.config.ts`: tests that call a route's `loader` or `action` directly, against a PostGIS test database. See "Tests" in `../README.md` for the setup.

- `global-setup.ts`: runs the migrations and syncs the catalogues once per run.
- `setup.ts`: replaces `getSession` of `~/lib/auth.server`, so routes see the user from `signInAs`.
- `session.ts`: `signInAs(user | null)`.
- `helpers.ts`: `seedUserWithFarm`, `loaderArgs`, `actionArgs` and `runRoute`; `renderPage` and `sessionCookie` for rendering pages.
- `routes/*.integration.test.ts`: the tests, one file per page or flow.

A test typically seeds two users, signs in as one of them, calls the route and checks the status, the redirect target or the data, and then reads the database to check what was saved:

```ts
const owner = await seedUserWithFarm("owner")
signInAs(owner.user)
const { status, data } = await runRoute(() =>
  loader(loaderArgs(`/farm/${owner.ids.farm}/settings/properties`, { b_id_farm: owner.ids.farm })),
)
expect(status).toBe(200)
```

Only use synthetic data: the seed's made-up names and `example.com` addresses.

To check that a page renders with real data, render it the way the server does. `renderPage` runs the loader, waits for deferred data and returns the HTML; event handlers and effects do not run. Pages that ask better-auth about the request (organizations, the farm overview) also need a real session cookie:

```ts
const cookie = await sessionCookie(owner.user)
const html = await renderPage(
  await import("~/routes/farm.$b_id_farm.settings.properties"),
  "/farm/:b_id_farm/settings/properties",
  `/farm/${owner.ids.farm}/settings/properties`,
  { cookie },
)
expect(html).toContain("Bedrijfsnaam")
```

`routes/pages.integration.test.ts` renders most pages this way.
