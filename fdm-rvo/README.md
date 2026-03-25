# @nmi-agro/fdm-rvo

## RVO Synchronization Logic for FDM

This package provides the core logic for synchronizing agricultural field data with the RVO (Rijksdienst voor Ondernemend Nederland) webservices. It wraps the `@nmi-agro/rvo-connector` to handle authentication and data fetching, and implements a robust field comparison mechanism to detect new, missing, and conflicting field data between local and RVO records.

### Features

- **RVO Authentication Flow**: Helpers for generating authorization URLs and exchanging authorization codes for access tokens using the `RvoClient`.
- **Field Data Fetching**: Retrieves agricultural field data from RVO, with GeoJSON parsing and validation.
- **RVO Import Review Engine**:
  - Compares local FDM fields (`@nmi-agro/fdm-core`'s `Field` type) against RVO fields.
  - Utilizes a two-tier matching strategy: ID-based matching followed by spatial (IoU) matching.
  - Detects and categorizes fields as `MATCH`, `NEW_REMOTE` (in RVO but not local), `NEW_LOCAL` (in local but not RVO), `CONFLICT` (different properties in both), or `EXPIRED_LOCAL` (local field started before the year but missing in RVO).
  - Identifies specific differing properties (`b_name`, `b_geometry`, `b_start`, `b_end`, `b_acquiring_method`, `b_lu_catalogue`, `b_bufferstrip`) for conflicts.
- **Type Safety**: Fully typed for a seamless development experience.

### Installation

```bash
pnpm add @nmi-agro/fdm-rvo
# Or if in a monorepo, ensure it's linked as a workspace dependency
```

### Usage

#### 1. Configuration

Ensure your `fdm-app` or consuming application has the following environment variables configured and exposed via its `serverConfig`:

```env
RVO_CLIENT_ID=<Your RVO Client ID>
RVO_CLIENT_NAME=<Your RVO Client Name>
RVO_REDIRECT_URI=<Your registered redirect URI with RVO>
RVO_PKIO_PRIVATE_KEY=<Your PKIO Private Key for RVO Client Assertion>
```

#### 2. Authentication Flow

To ensure security, sensitive credentials like `RVO_PKIO_PRIVATE_KEY` and the `exchangeToken` step must **never** be exposed to or executed on the client-side (browser). Instead, use server-side routes (e.g., in React Router v7 / Remix) to handle the authentication flow.

##### A. Initiate Authentication (Server-side Redirect)

Create a server route (e.g., `app/routes/auth.rvo.tsx`) that initiates the redirect to RVO.

```typescript
// app/routes/auth.rvo.tsx (Server-side)
import { redirect, type LoaderFunctionArgs } from "react-router";
import { createRvoClient, generateAuthUrl } from "@nmi-agro/fdm-rvo";
import { getEnv } from "~/lib/env.server"; // Your server-side env helper
import { getSession, commitSession } from "~/lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const env = getEnv();
  const { RVO_CLIENT_ID, RVO_CLIENT_NAME, RVO_REDIRECT_URI, RVO_PKIO_PRIVATE_KEY } = env;

  const rvoClient = createRvoClient(
    RVO_CLIENT_ID,
    RVO_CLIENT_NAME,
    RVO_REDIRECT_URI,
    RVO_PKIO_PRIVATE_KEY
  );

  // 1. Generate a secure random state to prevent CSRF
  const state = crypto.randomUUID();
  const authUrl = generateAuthUrl(rvoClient, state);

  // 2. Persist state in a secure, server-side session
  const session = await getSession(request.headers.get("Cookie"));
  session.set("rvoState", state);

  return redirect(authUrl, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}
```

##### B. Handle Callback (Server-side Token Exchange)

Create a callback route (matching your `RVO_REDIRECT_URI`) to exchange the code for an access token.

```typescript
// app/routes/auth.rvo.callback.tsx (Server-side)
import { redirect, type LoaderFunctionArgs } from "react-router";
import { createRvoClient, exchangeToken } from "@nmi-agro/fdm-rvo";
import { commitSession, getSession } from "~/lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const session = await getSession(request.headers.get("Cookie"));
  const storedState = session.get("rvoState");

  // 1. Verify state parameter against stored session state
  if (!state || state !== storedState) {
    throw new Error("Invalid or missing OAuth state parameter");
  }

  // 2. Clear state from session after successful verification
  session.unset("rvoState");

  if (!code) throw new Error("No authorization code received");

  const env = process.env; // Or your env helper
  const rvoClient = createRvoClient(
    env.RVO_CLIENT_ID!,
    env.RVO_CLIENT_NAME!,
    env.RVO_REDIRECT_URI!,
    env.RVO_PKIO_PRIVATE_KEY!
  );

  // 3. Exchange the code for an access token securely on the server
  const accessToken = await exchangeToken(rvoClient, code);

  // 4. Store the accessToken in a secure, HTTP-only session cookie
  session.set("rvoAccessToken", accessToken);

  return redirect("/dashboard", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}
```

#### 3. Fetching and Reconciling Fields

Once the `accessToken` is stored in your server session, you can use it in loaders or actions to fetch and compare data.

```typescript
// app/routes/farm.$id.sync.tsx (Server-side)
import { fetchRvoFields, compareFields } from "@nmi-agro/fdm-rvo";
import { getRvoClient } from "~/lib/rvo.server"; // Helper that uses createRvoClient

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const accessToken = session.get("rvoAccessToken");
  if (!accessToken) return redirect("/auth/rvo");

  const rvoClient = getRvoClient();
  const year = "2024";
  const kvkNumber = "12345678";

  // Fetch RVO fields (server-side)
  const rvoFields = await fetchRvoFields(rvoClient, year, kvkNumber, accessToken);
  
  // Fetch local fields (server-side)
  const localFields = await db.query.fields.findMany({ /* ... */ });

  const rvoImportReviewResults = compareFields(localFields, rvoFields, Number(year));
  return { rvoImportReviewResults };
}
```

### TypeDoc Generation

To generate API documentation using TypeDoc, ensure your `tsconfig.json` and `typedoc.json` (if applicable) are configured correctly. The package introduction will be included from the JSDoc comment in `src/index.ts`.

### Development

For development and testing, ensure all required `@turf/*` dependencies are installed.
