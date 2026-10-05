---
title: Endpoints
sidebar_label: Endpoints
sidebar_position: 6
---

# Endpoints

All endpoints are served under `/api`. Responses use FDM-native field names that mirror `fdm-core` directly.

## Farms

| Method   | Path                     | Description                                    | `fdm-core` mapping |
| -------- | ------------------------ | ---------------------------------------------- | ------------------ |
| `GET`    | `/api/farms`             | List all farms accessible to the API key owner | `getFarms`         |
| `POST`   | `/api/farms`             | Create a new farm                              | `addFarm`          |
| `GET`    | `/api/farms/{b_id_farm}` | Get a single farm                              | `getFarm`          |
| `PATCH`  | `/api/farms/{b_id_farm}` | Update a farm                                  | `updateFarm`       |
| `DELETE` | `/api/farms/{b_id_farm}` | Delete a farm (hard delete)                    | `removeFarm`       |

### Get farms — example

```http title="Request"
GET /api/farms?limit=10&offset=0 HTTP/1.1
Host: app.fdm.nl
X-API-Key: fdm_live_xxxxxxxxxxxxxxxxxxxx
```

```json title="Response 200"
{
  "data": [
    {
      "b_id_farm": "farm_abc123",
      "b_name_farm": "Hoeve De Morgen",
      "b_businessid_farm": "12345678",
      "b_address_farm": "Dorpsstraat 1",
      "b_postalcode_farm": "1234 AB"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1
  }
}
```

### Create farm — example

```http title="Request"
POST /api/farms HTTP/1.1
Host: app.fdm.nl
Content-Type: application/json
X-API-Key: fdm_live_xxxxxxxxxxxxxxxxxxxx

{
  "b_name_farm": "Hoeve De Morgen",
  "b_businessid_farm": "12345678",
  "b_address_farm": "Dorpsstraat 1",
  "b_postalcode_farm": "1234 AB"
}
```

```json title="Response 201"
{
  "b_id_farm": "farm_abc123"
}
```

---

## Fields

| Method   | Path                            | Description                  | `fdm-core` mapping |
| -------- | ------------------------------- | ---------------------------- | ------------------ |
| `GET`    | `/api/farms/{b_id_farm}/fields` | List all fields for a farm   | `getFields`        |
| `POST`   | `/api/farms/{b_id_farm}/fields` | Add a field to a farm        | `addField`         |
| `GET`    | `/api/fields/{b_id}`            | Get a single field           | `getField`         |
| `DELETE` | `/api/fields/{b_id}`            | Delete a field (hard delete) | `removeField`      |

### Get fields — example

```http title="Request"
GET /api/farms/farm_abc123/fields?limit=10 HTTP/1.1
Host: app.fdm.nl
Authorization: Bearer fdm_live_xxxxxxxxxxxxxxxxxxxx
```

```json title="Response 200"
{
  "data": [
    {
      "b_id": "field_xyz789",
      "b_name": "Noordpolder",
      "b_area": 4.52,
      "b_start": "2024-01-01",
      "b_acquiring_method": "owner"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1
  }
}
```

---

## Cultivations

| Method   | Path                              | Description                        | `fdm-core` mapping  |
| -------- | --------------------------------- | ---------------------------------- | ------------------- |
| `GET`    | `/api/fields/{b_id}/cultivations` | List cultivations for a field      | `getCultivations`   |
| `POST`   | `/api/fields/{b_id}/cultivations` | Add a cultivation to a field       | `addCultivation`    |
| `GET`    | `/api/cultivations/{b_lu}`        | Get a single cultivation           | `getCultivation`    |
| `DELETE` | `/api/cultivations/{b_lu}`        | Delete a cultivation (hard delete) | `removeCultivation` |

---

## Soil analyses

| Method   | Path                               | Description                          | `fdm-core` mapping   |
| -------- | ---------------------------------- | ------------------------------------ | -------------------- |
| `GET`    | `/api/fields/{b_id}/soil-analyses` | List soil analyses for a field       | `getSoilAnalyses`    |
| `POST`   | `/api/fields/{b_id}/soil-analyses` | Add a soil analysis to a field       | `addSoilAnalysis`    |
| `GET`    | `/api/soil-analyses/{a_id}`        | Get a single soil analysis           | `getSoilAnalysis`    |
| `PATCH`  | `/api/soil-analyses/{a_id}`        | Update a soil analysis               | `updateSoilAnalysis` |
| `DELETE` | `/api/soil-analyses/{a_id}`        | Delete a soil analysis (hard delete) | `removeSoilAnalysis` |

---

## Calculations

Calculation endpoints operate on **stored FDM resource identifiers** — they do not accept standalone calculation payloads that are not linked to stored data.

Calculation endpoints use `POST` because calculations may be expensive and may require option bodies. They are subject to stricter rate limits (10 requests per minute per key).

| Method | Path                                                   | Description                                |
| ------ | ------------------------------------------------------ | ------------------------------------------ |
| `POST` | `/api/farms/{b_id_farm}/calculations/nitrogen-balance` | Nitrogen balance for a farm                |
| `POST` | `/api/fields/{b_id}/calculations/nitrogen-balance`     | Nitrogen balance for a field               |
| `POST` | `/api/fields/{b_id}/calculations/dose`                 | Fertilizer dose recommendation for a field |

:::info

Calculation endpoint schemas are documented once the response format is stable. See the interactive docs at `/api/docs` for the latest schemas.

:::

---

## Indicators and measure options

Read-only endpoints for indicator scores and the measure options of a field. All require a four-digit `year` query parameter (e.g. `?year=2026`); soil analyses and adopted measures are limited to 1 January through 31 December of that year, while the cultivation history needed for the indicators is kept. They use the NMI API and have their own rate limit of **10 requests per minute per key** (`nmi` bucket). These endpoints are new; they carry a **New** badge in the API reference, and recent API changes are listed on the **Changelog** page there.

| Method | Path                                    | Description                                                            |
| ------ | --------------------------------------- | ---------------------------------------------------------------------- |
| `GET`  | `/api/fields/{b_id}/indicators`         | Indicator and aggregation scores of a field                            |
| `GET`  | `/api/farms/{b_id_farm}/indicators`     | Scores of all eligible fields and area-weighted farm scores            |
| `GET`  | `/api/fields/{b_id}/measures/catalogue` | Field-level catalogue measures with applicability, impacts and ranking |

Scores are on the normalized indicator scale (0..1, higher is better).

- **Excluded fields:** buffer strips and nature fields return `200` with `is_excluded: true` and empty `indicators`/`aggregations` (or `data: []`). A farm leaves them out of `fields` and weighting; a farm without eligible fields returns empty `fields` and empty farm aggregates.
- **Farm weighting:** each indicator and aggregation is weighted by the positive area of the eligible fields that have a score for it. Metrics without contributing fields are omitted. If any eligible field cannot be scored, the whole request fails with `503`.
- **Measure options:** `/measures/catalogue` lists catalogue candidates, not adopted measures. Farm-only entries and sources not enabled for the farm are left out; inapplicable, active, conflicting and non-recommended field-level entries stay visible. `applicability.status` is `applicable`, `not yet applicable`, `inapplicable` or `unknown` (no result; never treated as applicable). `selectable` is a hint; creating the measure with `POST /fields/{b_id}/measures` is validated again.
- **Predicted impacts:** `predicted_impacts` holds the positive impacts over all indicators, also for options that are not recommended. `recommendation` is `null` unless the option is among the top five applicable, not-yet-adopted, non-conflicting options; `indicator_impacts` then holds the impacts on the weak (non-green) indicators used for ranking, and `aggregate_impact` their sum. Predicted impacts are advice for this field and year, not stored on the measure. The upstream advice service is experimental.
- **Errors:** `400` for a missing or invalid `year`, `401`, `403`, `404`, `429`, and `503` when scores, applicability or advice are unavailable or the server has no NMI configuration. Responses never contain upstream error details, credentials or coordinates.

---

## OpenAPI documentation

| Path                | Description                                         |
| ------------------- | --------------------------------------------------- |
| `/api/openapi.json` | OpenAPI 3.1 document generated from runtime schemas |
| `/api/docs`         | Interactive Scalar documentation                    |

The OpenAPI document is generated directly from the same Zod schemas used for runtime validation. If the schema and the docs disagree, the schema wins.
