---
title: Setting up Local Environment
sidebar_label: Setting up Local Environment
---

This guide will walk you through the process of setting up a local development environment for the Farm Data Model (FDM) project with **zero required external cloud services**.

## Prerequisites

Before you begin, you will need to have the following software installed on your machine:

- **[Node.js](https://nodejs.org/en/download)**: Node.js `>=24.0.0` is required.
- **[`pnpm`](https://pnpm.io/installation)**: FDM uses `pnpm@11.25.0` for package management (`corepack enable pnpm`).
- **[Git](https://git-scm.com/downloads)**: To clone the repository.
- **[PostgreSQL](https://www.postgresql.org/download/) with [PostGIS](https://postgis.net/install/)**: FDM stores relational and spatial data in PostgreSQL with PostGIS.

Alternatively, you can run the entire stack using **Docker Desktop** (`docker compose up`).

## Option A: Running with Docker Compose (Fastest)

The repository root includes a `docker-compose.yml` that starts PostgreSQL with PostGIS, runs database migrations, launches `fdm-app` on `http://localhost:5173`, and launches `fdm-api` on `http://localhost:8080`.

```bash
# 1. Clone repository
git clone https://github.com/nmi-agro/fdm.git
cd fdm

# 2. Start all services
docker compose up
```

Once started:

- Browse to `http://localhost:5173`.
- Sign in with any email address (e.g. `dev@example.com`).
- Check the terminal logs to see your local login OTP code and magic link verification URL.

## Option B: Running Standalone with Node.js and pnpm

### 1. Clone the Repository & Install Dependencies

```bash
git clone https://github.com/nmi-agro/fdm.git
cd fdm
pnpm install
```

### 2. Prepare the Database

Ensure PostgreSQL is running and has the PostGIS extension enabled:

```sql
CREATE DATABASE "fdm-app";
\c "fdm-app"
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 3. Configure `.env` for `fdm-app`

Copy `.env.example` in `fdm-app`:

```bash
cp fdm-app/.env.example fdm-app/.env
```

Fill in your database credentials and generate development secrets. A minimal local configuration requires **no external API keys**:

```env
NODE_ENV=development
PUBLIC_FDM_NAME=FDM
PUBLIC_FDM_URL=http://localhost:5173
PUBLIC_MAP_PROVIDER=osm
FDM_SESSION_SECRET=dev-session-secret-change-in-production-min-32-chars
BETTER_AUTH_SECRET=dev-better-auth-secret-change-in-production-min-32-chars
BETTER_AUTH_URL=http://localhost:5173

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=fdm-app
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

### 4. Configure `.env` for `fdm-api` (Optional)

If you are developing or testing the REST API:

```bash
cp fdm-api/.env.example fdm-api/.env
```

Ensure `BETTER_AUTH_SECRET` matches `fdm-app`:

```env
PORT=6173
PUBLIC_FDM_NAME=FDM
PUBLIC_FDM_URL=http://localhost:6173
BETTER_AUTH_SECRET=dev-better-auth-secret-change-in-production-min-32-chars
BETTER_AUTH_URL=http://localhost:6173

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=fdm-app
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

### 5. Start the Applications

Run database migrations and start the frontend development server:

```bash
# Start fdm-app (runs migrations on startup)
pnpm --filter fdm-app dev
```

In a separate terminal, you can optionally run `fdm-api`:

```bash
# Start fdm-api
pnpm --filter fdm-api dev
```

## Local Sign-In (Console OTP Logger)

In local development (`NODE_ENV !== "production"`), you do not need Postmark or third-party OAuth providers configured:

1. Open `http://localhost:5173/signin`.
2. Enter any email address (e.g. `tester@fdm.local`) and click **Aanmelden met e-mail**.
3. Look at your server terminal output. The login OTP code and magic link will be printed directly in the console:

```text
==================== [LOCAL DEV MAGIC LINK] ====================
Recipient:       tester@fdm.local
Login OTP Code:  839102
Verification URL: http://localhost:5173/signin/verify?code=839102...
================================================================
```

4. Enter the 6-digit OTP code in your browser or click the verification link to log in immediately.

## Creating API Keys for `fdm-api`

Once logged into `fdm-app`:

1. Navigate to **Instellingen → API-sleutels** (`/user/settings/api-keys`).
2. Click **API-sleutel aanmaken** and copy the generated key (`fdm_...`).
3. Make requests to your local `fdm-api` instance:

```bash
curl http://localhost:6173/farms \
  -H "X-API-Key: fdm_your_generated_key"
```

## Optional External Services

All third-party services are optional for local development. If omitted, the application degrades gracefully:

- **MapTiler (`PUBLIC_MAPTILER_API_KEY`)**: Defaults to OpenStreetMap (`PUBLIC_MAP_PROVIDER=osm`) and Esri satellite tiles.
- **NMI API (`NMI_API_KEY`)**: Used for live Dutch nutrient advice, soil estimates (atlas), and BLN3 scoring. Core nitrogen and organic matter balances and fertilization norms run purely locally.
- **Google Cloud Storage (`GCS_BUCKET_NAME`)**: Used for user profile photos, visual soil assessment images, and soil analysis PDFs.
- **Google Gemini (`GEMINI_API_KEY`)**: Used for the Gerrit fertilizer planning agent and automated helpdesk ticket triage.
- **PostHog & Sentry**: Product analytics and error monitoring fail-open / disabled when unconfigured.
