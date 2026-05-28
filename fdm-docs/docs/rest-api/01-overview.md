---
title: Overview
sidebar_label: Overview
sidebar_position: 1
---

# FDM REST API

The FDM REST API (`/api`) gives external applications, automation scripts, and trusted partners programmatic access to the same Farm Data Model data managed in the FDM web application.

## Target audience

| Audience | Examples |
|---|---|
| **First-party automation** | Internal scripts, CI pipelines, data-import tooling |
| **Trusted partners** | Registered agri-tech partners with server-side integrations |
| **Public third-party integrations** | Farm management systems, precision-agriculture apps |

## What the API provides

- Read, create, update, and delete access to farms, fields, cultivations, and soil analyses.
- Calculation endpoints that operate on stored FDM resource identifiers.
- User-owned API keys with auditable access logs.
- Machine-readable OpenAPI documentation at `/api/openapi.json`.
- Interactive Scalar documentation at `/api/docs`.

## Compatibility policy

The public API is served under `/api` — there is **no `/v1` path** and no independent version stability promise.

The API intentionally follows `fdm-core`. When `fdm-core` introduces breaking changes to its data model, field names, or function behavior, the corresponding API endpoint **may change without a deprecation period**. Consumers should treat the API as a convenience interface over the current FDM model, not a long-lived stable contract.

If future requirements demand third-party stability guarantees, versioned routes (e.g., `/api/v1`) will be introduced at that point with explicit deprecation and migration timelines.

:::note

Subscribe to the [FDM blog](https://nmi-agro.github.io/fdm/blog) to stay informed about changes that may affect your integration.

:::

## FDM-native field names

All request and response bodies use FDM-native JSON field names that mirror `fdm-core` directly — for example `b_id_farm`, `b_name_farm`, `b_lu`, `a_id`. Changes to these names in `fdm-core` are breaking API changes.

```json title="Example farm response"
{
  "b_id_farm": "farm_abc123",
  "b_name_farm": "Hoeve De Morgen",
  "b_businessid_farm": "12345678",
  "b_address_farm": "Dorpsstraat 1",
  "b_postalcode_farm": "1234 AB"
}
```

## Existing internal routes

The following routes under `/api` are **internal application routes** — they are session-authenticated, not part of the public API, and not accessible with API keys:

| Path | Purpose |
|---|---|
| `/api/auth/*` | Better Auth session handlers |
| `/api/lookup/principal` | Internal principal lookup |
| `/api/soil-analysis/extract` | Internal bulk upload helper |
