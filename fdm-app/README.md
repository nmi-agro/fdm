# FDM App (`fdm-app`)

The `fdm-app` is a React application providing a user-friendly interface for visualizing and managing farm data based on the Farm Data Model (FDM) schema. It utilizes `fdm-core` for seamless database interaction and serves as a practical demonstration of FDM's capabilities. This intuitive interface empowers users to interact with their farm data, gaining valuable insights and streamlining farm management decisions.

> [!IMPORTANT]  
> `fdm-app` is currently in alpha state. It includes features such as interactive data visualization, streamlined data management, user authentication and authorization, and organization management.
> See our [roadmap](https://github.com/nmi-agro/fdm/milestones) for planned milestones.

## Key Features

- **Interactive Data Visualization:** Visualize farm data, including fields, cultivations, fertilizer applications, and soil analysis results, on an interactive map interface. Explore data spatially and gain a comprehensive overview of your farm operations.
- **Streamlined Data Management:** Manage farm data efficiently through intuitive forms and workflows. Create, update, and delete records for farms, fields, cultivations, fertilizers, and soil analyses with ease.
- **User Authentication and Authorization:** Securely manage user accounts and access control. Utilize authentication features to protect sensitive farm data. The authentication includes social log in methods.
- **Integration with FDM Core:** Seamlessly integrates with `fdm-core` for robust data management and access to the standardized FDM schema. Leverages the power and consistency of `fdm-core` for reliable data handling.
- **Open Source and Customizable:** As an open-source project, `fdm-app` is highly customizable. Adapt the interface, add new features, and tailor the application to meet specific farm management needs.

## Getting Started

1. **Prerequisites:** Ensure you have a PostgreSQL-compatible database set up and configured with the FDM schema (using `fdm-core`). Refer to the `fdm-core` documentation for database setup instructions.

2. **Installation:**

```bash
   pnpm add @nmi-agro/fdm-app
```

3. **Configuration:**
   Configure the application by setting environment variables. Create a `.env` file in the `fdm-app` directory by copying the provided `.env.example` file:

   ```bash
   cp .env.example .env
   ```

   Edit the `.env` file and provide values for the necessary variables. Key configuration areas include:
   - **General:** Application name (`PUBLIC_FDM_NAME`), environment (`NODE_ENV`).
   - **Session:** A strong secret key (`FDM_SESSION_SECRET`).
   - **Database:** Connection details for your PostgreSQL database.
   - **Authentication:** Secrets and URLs for `better-auth`. In local development (`NODE_ENV !== "production"`), magic link OTP codes and login links are automatically logged to the terminal console when `POSTMARK_API_KEY` is empty.
   - **Map:** Map provider configuration (`PUBLIC_MAP_PROVIDER=osm` by default, requires no API keys) and API key if using MapTiler (`PUBLIC_MAPTILER_API_KEY`).
   - **External Services (Optional):** Sentry, PostHog, NMI API, GCS, Gemini, and RVO are optional for local development and disabled by default.
   - **RVO logging (Optional):** `RVO_LOG_XML` logs the SOAP XML exchanged with RVO. Supported values are `none` (default), `request`, `response` and `both`. The logged XML can contain farm data and identifiers, so only enable it temporarily for debugging.

   Refer to the comments within the `.env.example` file for detailed explanations of each variable and whether it's required. **Never commit your `.env` file to version control.**

4. **Running the App:**

```bash
    # Development mode
    pnpm dev

    # Production build
    pnpm build
    pnpm start
```

## Tests

The app has three kinds of tests. CI runs all of them in the `app` check (`.github/workflows/fdm-app.yml`, on every pull request, including pull requests from forks), after a production build (`react-router build`), which itself catches server-only imports in client code and invalid route exports.

| Kind              | Where                                | Command                 | Needs                                                        |
| ----------------- | ------------------------------------ | ----------------------- | ------------------------------------------------------------ |
| Unit              | `app/**/*.test.ts`, next to the code | `pnpm test:unit`        | nothing                                                      |
| Loader and action | `test/**/*.integration.test.ts`      | `pnpm test:integration` | a PostGIS test database (`.env.test`)                        |
| End-to-end smoke  | `e2e/smoke` (Playwright)             | `pnpm e2e`              | a build, Chromium and an empty PostGIS database (`.env.e2e`) |

`pnpm test` runs the unit and loader/action tests together, and `pnpm turbo run test --filter=@nmi-agro/fdm-app` does the same after building the packages the app depends on. The repository-wide `pnpm test` (which runs `test-coverage` in every package) only runs the app's unit tests, so the app's database tests never run alongside fdm-core's, whose teardown empties the users and roles. Run the commands in `fdm-app/`, or from the root with `pnpm --filter @nmi-agro/fdm-app <command>`.

### Unit tests

Pure modules in `app/lib` and the Zustand stores in `app/store`, plus the user manual's content, label and SEO checks. Put a `*.test.ts` file next to the module. Do not put test files in `app/routes`: every file there becomes a route.

### Loader and action tests

These call the `loader` and `action` of a route module directly, with the real database code. Only the session is replaced: `signInAs(user)` from `test/session.ts` decides who `getSession` returns, and `signInAs(null)` makes the request anonymous. `test/helpers.ts` has `seedUserWithFarm()` (a new user with a synthetic two-field farm on every call), `loaderArgs`/`actionArgs` to build the arguments and `runRoute` to read a result, redirect or thrown response as `{ status, location, data }`.

Create `fdm-app/.env.test` with the `POSTGRES_*` settings of a **separate test database** with PostGIS (not the database of `.env`, and not fdm-core's test database: the tests add users and farms). Its settings take precedence over `POSTGRES_*` variables in your shell. The global setup runs the migrations and syncs the catalogues.

### End-to-end tests

Playwright (`playwright.config.ts`, code in `e2e/`) runs the app as a production build (`node server.js`) against an empty PostGIS database. `E2E_SUITE` picks the suite:

- `smoke` (`pnpm e2e`, runs on every pull request): `e2e/smoke/routes.spec.ts` visits every GET route of the build and fails on an error page, a 5xx response or an error in the browser; `e2e/smoke/flows.spec.ts` runs the critical flows. External services are off: the app gets no API keys and the browser cannot reach other origins.
- `screenshots` (`pnpm screenshots`): captures the user manual's screenshots; see `app/content/manual/README.md`.

Shared code:

- `e2e/seed` creates a synthetic user and farm through `fdm-core` (variant `minimal` or `demo`). It refuses to run when the database already contains farms. `e2e/seed/organization.ts` adds an organization with access to that farm and a farm group, so the smoke suite also covers the organization pages.
- `e2e/support/auth.ts` signs in through the normal magic-link flow and reads the one-time code from the database, so the app needs no test-only login mode.
- `e2e/support/app.ts` blocks external requests and collects errors on a page.

When you add a route with a param, the crawler fails until `e2e/smoke/route-params.ts` can fill in the param, or lists the route in `SKIP` with a reason.

To run the end-to-end tests locally:

1. Create an empty database with PostGIS, for example `fdm_e2e` (`CREATE EXTENSION postgis;`).
2. Create `fdm-app/.env.e2e` from `.env.e2e.example` and point `POSTGRES_*` at that database.
3. Build the app and its packages, and install Chromium once:

   ```bash
   pnpm turbo run build --filter=@nmi-agro/fdm-app...
   pnpm --filter @nmi-agro/fdm-app e2e:install
   ```

4. Run a suite, for example `pnpm --filter @nmi-agro/fdm-app e2e`. Drop and recreate the database before the next run. When a test fails, open the trace that Playwright prints with `pnpm exec playwright show-trace <file>`.

Starting the server can take a few minutes. To try changes quickly, keep the server running in a second terminal (`pnpm exec dotenvx run -f .env.e2e -- sh -c "node ./app/lib/fdm-migrate.server.js && node ./server.js"`, with the environment that `playwright.config.ts` gives the app (`appEnv`)). Playwright reuses it. After the first run, set `E2E_REUSE_SEED=1` to keep the seeded farm, and add `--grep <title>` to run a single test. Every run signs in once, and the app allows 5 sign-ins per 15 minutes; after that the setup fails with "Te veel pogingen" until the window has passed. With `E2E_REUSE_SEED=1` the smoke suite also reuses the session.

## Key Functionalities

- **Farm Management:** Create, view, update, and delete farm records, including adding and removing associated fields. Manage farm details and their associated data using the application.
- **Field Management:** Add, edit, and remove fields associated with a farm. Visualize fields on a map, view detailed information about each field, including soil status, and update field properties.
- **Cultivation Management:** Manage cultivations on fields, recording sowing dates and other relevant details. Track the progress of crops and plan future farming activities.
- **Fertilizer Management:** Record fertilizer applications, pick specific fertilizer products for use, and manage fertilizer applications on fields. Track fertilizer usage and optimize application strategies.
- **Soil Analysis Management:** Record and visualize soil analysis results. Track soil health and make informed decisions about fertilization and other management practices

## Contributing

We welcome contributions to enhance the functionality and user experience of `fdm-app`. See the main FDM project documentation for guidelines on contributing code, reporting bugs, and requesting features.

## Made Possible By

FDM is developed by the [Nutriënten Management Instituut](https://www.nmi-agro.nl/) as part of the Horizon Europe projects: [NutriBudget](https://www.nutribudget.eu/) and [PPS BAAT](https://www.handboekbodemenbemesting.nl/nl/handboekbodemenbemesting/pps-baat.htm).

## Contact

Maintainer: @SvenVw
Reviewer: @gerardhros
