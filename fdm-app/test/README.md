# Loader and action tests

The `integration` project of `vitest.config.ts`: tests that call a route's `loader` or `action` directly, against a PostGIS test database. See "Tests" in `../README.md` for the setup.

- `global-setup.ts`: runs the migrations and syncs the catalogues once per run.
- `setup.ts`: replaces `getSession` of `~/lib/auth.server`, so routes see the user from `signInAs`.
- `session.ts`: `signInAs(user | null)`.
- `helpers.ts`: `seedUserWithFarm`, `loaderArgs`, `actionArgs` and `runRoute`.
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
