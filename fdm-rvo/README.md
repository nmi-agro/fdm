# @nmi-agro/fdm-rvo

## RVO Synchronization Logic for FDM

This package provides the core logic for synchronizing agricultural field data with the RVO (Rijksdienst voor Ondernemend Nederland) webservices. It wraps the `@nmi-agro/rvo-connector` to handle authentication and data fetching, and implements a robust field comparison mechanism to detect new, missing, and conflicting field data between local and RVO records.

### Features

- **RVO Authentication Flow**: Helpers for generating authorization URLs and exchanging authorization codes for access tokens using the `RvoClient`.
- **Field Data Fetching**: Retrieves agricultural field data from RVO, with GeoJSON parsing and validation.
- **RVO Import Review Engine**:
  - Compares local FDM fields (`@svenvw/fdm-core`'s `Field` type) against RVO fields.
  - Utilizes a two-tier matching strategy: ID-based matching followed by spatial (IoU) matching.
  - Detects and categorizes fields as `MATCH`, `NEW_REMOTE` (in RVO but not local), `NEW_LOCAL` (in local but not RVO), or `CONFLICT` (different properties in both).
  - Identifies specific differing properties (`b_name`, `b_geometry`, `b_start`, `b_end`) for conflicts.
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
RVO_CLIENT_SECRET=<Your RVO Client Secret>
RVO_REDIRECT_URI=<Your registered redirect URI with RVO>
RVO_PKIO_PRIVATE_KEY=<Your PKIO Private Key for RVO Client Assertion>
RVO_ENVIRONMENT=production # or acceptance
```

#### 2. Authentication Flow

```typescript
// In your React Router v7 component (client-side)
import { createRvoClient, generateAuthUrl, exchangeToken } from '@nmi-agro/fdm-rvo';
// Assuming you have a way to securely access server config on the client,
// or that these are provided as build-time env vars (e.g., VITE_RVO_CLIENT_ID)
import { serverConfig } from '~/lib/config.client'; // Example client-side config

// To initiate authentication (e.g., from a button click handler)
const handleAuthInitiation = () => {
  const { clientId, redirectUri, pkioPrivateKey, environment } = serverConfig.integrations.rvo;
  const clientName = serverConfig.name; // Use your app's name
  
  const rvoClient = createRvoClient(clientId, clientName, redirectUri, pkioPrivateKey, environment);
  
  // Encode current location to return to it after RVO login
  const state = Buffer.from(JSON.stringify({ returnPath: window.location.pathname })).toString('base64');
  const authUrl = generateAuthUrl(rvoClient, state);
  
  window.location.href = authUrl; // Redirect the user
};

// To handle the RVO callback in a component rendered at the redirectUri
const handleRvoCallback = async (code: string, state: string) => {
  const { clientId, clientSecret, redirectUri, pkioPrivateKey, environment } = serverConfig.integrations.rvo;
  const clientName = serverConfig.name;

  // Validate state to prevent CSRF
  const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
  // ... perform validation, e.g., against a session/cookie based state ...

  const rvoClient = createRvoClient(clientId, clientName, redirectUri, pkioPrivateKey, environment);
  const accessToken = await exchangeToken(rvoClient, code);
  
  // Now you have accessToken, you can fetch fields client-side or send it to a serverless function/backend API
  return { accessToken, decodedState };
};
```

#### 3. Fetching and Reconciling Fields

```typescript
// In your React Router v7 component (client-side), after getting accessToken
import { fetchRvoFields, compareFields } from '@nmi-agro/fdm-rvo';
// Assuming you have an API endpoint to fetch local fields
const fetchLocalFieldsApi = async (farmId: string, principalId: string) => {
  const response = await fetch(`/api/farm/${farmId}/fields?principalId=${principalId}`);
  return response.json();
};

const processRvoData = async (accessToken: string, farmId: string, principalId: string, year: string, kvkNumber: string) => {
  const { clientId, clientSecret, redirectUri, pkioPrivateKey, environment } = serverConfig.integrations.rvo;
  const clientName = serverConfig.name;

  const rvoClient = createRvoClient(clientId, clientName, redirectUri, pkioPrivateKey, environment);

  // Fetch RVO fields client-side
  const rvoFields = await fetchRvoFields(rvoClient, year, kvkNumber);
  
  // Fetch local fields from your backend API
  const localFields = await fetchLocalFieldsApi(farmId, principalId);

  const rvoImportReviewResults = compareFields(localFields, rvoFields);
  return rvoImportReviewResults;
};

// To apply changes, you would send the user's decisions to a backend API endpoint
const applyChangesApi = async (farmId: string, decisions: any) => {
  const response = await fetch(`/api/farm/${farmId}/apply-rvo-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(decisions),
  });
  return response.json();
};
```

### TypeDoc Generation

To generate API documentation using TypeDoc, ensure your `tsconfig.json` and `typedoc.json` (if applicable) are configured correctly. The package introduction will be included from the JSDoc comment in `src/index.ts`.

### Development

For development and testing, ensure all required `@turf/*` dependencies are installed.
