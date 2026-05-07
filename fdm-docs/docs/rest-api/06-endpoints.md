---
title: Endpoints
sidebar_label: Endpoints
sidebar_position: 6
---

# Endpoints

All endpoints are served under `/api`. Responses use FDM-native field names that mirror `fdm-core` directly.

## Farms

| Method | Path | Description | `fdm-core` mapping |
|---|---|---|---|
| `GET` | `/api/farms` | List all farms accessible to the API key owner | `getFarms` |
| `POST` | `/api/farms` | Create a new farm | `addFarm` |
| `GET` | `/api/farms/{farmId}` | Get a single farm | `getFarm` |
| `PATCH` | `/api/farms/{farmId}` | Update a farm | `updateFarm` |
| `DELETE` | `/api/farms/{farmId}` | Delete a farm (hard delete) | `removeFarm` |

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

| Method | Path | Description | `fdm-core` mapping |
|---|---|---|---|
| `GET` | `/api/farms/{farmId}/fields` | List all fields for a farm | `getFields` |
| `POST` | `/api/farms/{farmId}/fields` | Add a field to a farm | `addField` |
| `GET` | `/api/fields/{fieldId}` | Get a single field | `getField` |
| `DELETE` | `/api/fields/{fieldId}` | Delete a field (hard delete) | `removeField` |

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

| Method | Path | Description | `fdm-core` mapping |
|---|---|---|---|
| `GET` | `/api/fields/{fieldId}/cultivations` | List cultivations for a field | `getCultivations` |
| `POST` | `/api/fields/{fieldId}/cultivations` | Add a cultivation to a field | `addCultivation` |
| `GET` | `/api/cultivations/{cultivationId}` | Get a single cultivation | `getCultivation` |
| `DELETE` | `/api/cultivations/{cultivationId}` | Delete a cultivation (hard delete) | `removeCultivation` |

---

## Soil analyses

| Method | Path | Description | `fdm-core` mapping |
|---|---|---|---|
| `GET` | `/api/fields/{fieldId}/soil-analyses` | List soil analyses for a field | `getSoilAnalyses` |
| `POST` | `/api/fields/{fieldId}/soil-analyses` | Add a soil analysis to a field | `addSoilAnalysis` |
| `GET` | `/api/soil-analyses/{analysisId}` | Get a single soil analysis | `getSoilAnalysis` |
| `PATCH` | `/api/soil-analyses/{analysisId}` | Update a soil analysis | `updateSoilAnalysis` |
| `DELETE` | `/api/soil-analyses/{analysisId}` | Delete a soil analysis (hard delete) | `removeSoilAnalysis` |

---

## Calculations

Calculation endpoints operate on **stored FDM resource identifiers** — they do not accept standalone calculation payloads that are not linked to stored data.

Calculation endpoints use `POST` because calculations may be expensive and may require option bodies. They are subject to stricter rate limits (10 requests per minute per key).

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/farms/{farmId}/calculations/nitrogen-balance` | Nitrogen balance for a farm |
| `POST` | `/api/fields/{fieldId}/calculations/nitrogen-balance` | Nitrogen balance for a field |
| `POST` | `/api/fields/{fieldId}/calculations/dose` | Fertilizer dose recommendation for a field |

:::info

Calculation endpoint schemas are documented once the response format is stable. See the interactive docs at `/api/docs` for the latest schemas.

:::

---

## OpenAPI documentation

| Path | Description |
|---|---|
| `/api/openapi.json` | OpenAPI 3.1 document generated from runtime schemas |
| `/api/docs` | Interactive Scalar documentation |

The OpenAPI document is generated directly from the same Zod schemas used for runtime validation. If the schema and the docs disagree, the schema wins.
