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

| Method   | Path                                         | Description                                  | `fdm-core` mapping          |
| -------- | -------------------------------------------- | -------------------------------------------- | --------------------------- |
| `GET`    | `/api/fields/{b_id}/soil-analyses`           | List soil analyses for a field               | `getSoilAnalyses`           |
| `POST`   | `/api/fields/{b_id}/soil-analyses`           | Add a soil analysis to a field               | `addSoilAnalysis`           |
| `GET`    | `/api/soil-analyses/{a_id}`                  | Get a single soil analysis                   | `getSoilAnalysis`           |
| `PATCH`  | `/api/soil-analyses/{a_id}`                  | Update a soil analysis                       | `updateSoilAnalysis`        |
| `DELETE` | `/api/soil-analyses/{a_id}`                  | Delete a soil analysis (hard delete)         | `removeSoilAnalysis`        |
| `GET`    | `/api/fields/{b_id}/current-soil-data`       | Get the current value of each soil parameter | `getCurrentSoilData`        |
| `GET`    | `/api/fields/{b_id}/current-soil-data/zones` | Get the current soil data per sampling zone  | `getCurrentSoilDataPerZone` |

To add soil analyses from lab report PDFs and keep the report, use the [lab report import](#soil-condition-score-and-lab-reports). Soil analyses accept and return the optional sampling geometries `b_sampling_geometry` (GeoJSON `MultiPoint`) and `b_sampling_geometry_zone` (GeoJSON `Polygon` or `MultiPolygon` on input, `MultiPolygon` on output), both in WGS84. The current soil data lists the contributing analyses per parameter in `sources`, and combines sampling zones by area; see [Soil analyses](../core-concepts/07-soil-analyses.md#current-soil-data-and-sampling-zones).

---

## Farm groups

Farm groups are named, organization-scoped groupings of farms. The API key owner must be a member of the organization. Group membership is recorded as events: adding a farm records the date from which it is part of the group (`b_group_joined`, default today) and optionally the date until which (`b_group_leaved`). Removing a farm records the date until which it is part of the group (query parameter `b_group_leaved`, default today). When both dates are given on adding a farm they are stored together, so a period is never half recorded. These are the dates of the period itself, not the moment of the request, so they can lie in the past or the future. Dates use the format `YYYY-MM-DD`. Ending a membership records an end date and preserves the membership history; a later planned end date is moved forward to the given date; only a membership that starts today and is removed without a date is cancelled instead. `PATCH` (`updateFarmGroupMembership`) replaces the dates of a period rather than adding to its history, and `DELETE` on a period (`removeFarmGroupMembership`) deletes the period itself, for example to correct a mistake.

| Method   | Path                                                               | Description                                                                            | `fdm-core` mapping          |
| -------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------- |
| `GET`    | `/api/organizations/{organization_id}/farm-groups`                 | List the farm groups of an organization                                                | `listFarmGroups`            |
| `POST`   | `/api/organizations/{organization_id}/farm-groups`                 | Create a farm group                                                                    | `createFarmGroup`           |
| `GET`    | `/api/farm-groups/{b_id_group}`                                    | Get a group including its current member farm ids                                      | `getFarmGroup`              |
| `PATCH`  | `/api/farm-groups/{b_id_group}`                                    | Rename a group                                                                         | `renameFarmGroup`           |
| `DELETE` | `/api/farm-groups/{b_id_group}`                                    | Delete a group and its membership history                                              | `removeFarmGroup`           |
| `POST`   | `/api/farm-groups/{b_id_group}/farms`                              | Add a farm to a group (body: `b_id_farm`, optional `b_group_joined`, `b_group_leaved`) | `addFarmToGroup`            |
| `DELETE` | `/api/farm-groups/{b_id_group}/farms/{b_id_farm}`                  | End the membership of a farm (optional `b_group_leaved`)                               | `removeFarmFromGroup`       |
| `PATCH`  | `/api/farm-groups/{b_id_group}/farms/{b_id_farm}/{b_group_joined}` | Change the dates of a membership period                                                | `updateFarmGroupMembership` |
| `DELETE` | `/api/farm-groups/{b_id_group}/farms/{b_id_farm}/{b_group_joined}` | Delete a membership period, as if the farm never was part of the group then            | `removeFarmGroupMembership` |

`PATCH` changes the dates of an existing period. The `b_group_joined` in the path is the current join date of the period and identifies it. A `b_group_joined` in the body updates the join date to that new date, and a `b_group_leaved` in the body updates the end date (`null` removes it). A period may not overlap another period of the same farm.

`GET /api/farms` also accepts a `b_id_group` query parameter to list only the farms of a group.

---

## Calculations

Calculation endpoints operate on **stored FDM resource identifiers** — they do not accept standalone calculation payloads. They are `GET` requests and share a stricter rate limit of **10 requests per minute per key** (`calc` bucket); the nutrient advice uses the NMI API and counts in the `nmi` bucket instead.

| Method | Path                                                         | Description                                                                |
| ------ | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `GET`  | `/api/farms/{b_id_farm}/calculations/nitrogen-balance`       | Nitrogen balance of a farm (`start`, `end`, optional `effective_nitrogen`) |
| `GET`  | `/api/fields/{b_id}/calculations/nitrogen-balance`           | Nitrogen balance of a field                                                |
| `GET`  | `/api/farms/{b_id_farm}/calculations/organic-matter-balance` | Organic matter balance of a farm (`start`, `end`)                          |
| `GET`  | `/api/fields/{b_id}/calculations/organic-matter-balance`     | Organic matter balance of a field                                          |
| `GET`  | `/api/fields/{b_id}/calculations/dose`                       | Nutrient dose applied with fertilizers on a field                          |
| `GET`  | `/api/farms/{b_id_farm}/calculations/norms`                  | Usage norms per field of a farm (`year`: 2025 or 2026)                     |
| `GET`  | `/api/fields/{b_id}/calculations/norms`                      | Usage norms of a field                                                     |
| `GET`  | `/api/farms/{b_id_farm}/calculations/nutrient-advice`        | Nutrient advice, dose and remaining advice per field (`year`)              |
| `GET`  | `/api/fields/{b_id}/calculations/nutrient-advice`            | Nutrient advice, dose and remaining advice of a field (`year`)             |

The nutrient advice is for the main cultivation of the year: the cultivation present longest between 15 May and 15 July. A field that cannot be calculated is returned with an `error` code (`no_cultivation`, `no_main_cultivation`, `farm_data_unavailable` or `advice_failed`); the other fields are still calculated. Without an NMI configuration on the server the endpoints return `503`.

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

## Lists per farm

These endpoints return the records of all fields or cultivations of a farm in one request. They accept the `from` and `to` query parameters (YYYY-MM-DD) to limit the period, and `limit` and `offset` for pagination.

| Method | Path                                             | Description                                              | `fdm-core` mapping                 |
| ------ | ------------------------------------------------ | -------------------------------------------------------- | ---------------------------------- |
| `GET`  | `/api/farms/{b_id_farm}/fertilizer-applications` | Fertilizer applications of all fields, with their `b_id` | `getFertilizerApplicationsForFarm` |
| `GET`  | `/api/farms/{b_id_farm}/harvests`                | Harvests of all cultivations, with their `b_lu`          | `getHarvestsForFarm`               |
| `GET`  | `/api/farms/{b_id_farm}/measures`                | Measures of all fields, with their `b_id`                | `getMeasuresForFarm`               |
| `GET`  | `/api/farms/{b_id_farm}/current-soil-data`       | Current soil data per field, paginated by field          | `getCurrentSoilDataForFarm`        |

Current soil data, per field and per farm, includes the nitrogen supplying capacity (`d_n_supply_base`) calculated from organic matter, clay and C/N when no analysis has it. Its single source has `a_source: "calculated"`.

---

## Fertilizers and harvests

| Method  | Path                                          | Description                                                         |
| ------- | --------------------------------------------- | ------------------------------------------------------------------- |
| `POST`  | `/api/farms/{b_id_farm}/fertilizers/custom`   | Create a fertilizer with its own composition and acquire it         |
| `PATCH` | `/api/fertilizers/{p_id}`                     | Update a custom fertilizer (`422` for a standard catalogue product) |
| `GET`   | `/api/cultivations/{b_lu}/harvest-parameters` | Parameters a harvest needs and their default values                 |

---

## Invitations

| Method | Path                                       | Description                                          |
| ------ | ------------------------------------------ | ---------------------------------------------------- |
| `GET`  | `/api/invitations`                         | Pending farm invitations of the owner of the API key |
| `POST` | `/api/invitations/{invitation_id}/accept`  | Accept an invitation                                 |
| `POST` | `/api/invitations/{invitation_id}/decline` | Decline an invitation                                |

Sharing a farm (inviting others, changing roles, revoking access) is not available through the API yet.

---

## Soil condition score and lab reports

Soil analyses accept and return the soil condition score (BCS) parameters `a_ss_bcs` to `a_rt_bcs`. The photos of an assessment and their annotations have their own endpoints. Lab reports are imported in two steps, like the field import: **compare** reads the PDFs (field `files`) and suggests the field of each analysis without saving; **apply** takes the same files and the analyses to save, and saves them in one transaction with a copy of the report. Send the analyses as one `analyses` field with a JSON array, or as one `analyses` field per analysis with a JSON object. Each analysis has its `file_index`, the `b_id` of its field, an `a_date` and the checked values; an item of the compare step can be sent back with `b_id` and `a_date` added. The reports are not read again in the apply step.

| Method   | Path                                                  | Description                                                 |
| -------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| `GET`    | `/api/soil-analyses/{a_id}/images`                    | Photos of a soil analysis with their annotations            |
| `POST`   | `/api/soil-analyses/{a_id}/images`                    | Upload a photo (`multipart/form-data`, field `file`)        |
| `GET`    | `/api/soil-images/{a_id_image}`                       | Download a photo                                            |
| `DELETE` | `/api/soil-images/{a_id_image}`                       | Delete a photo and its annotations                          |
| `POST`   | `/api/soil-images/{a_id_image}/annotations`           | Add an annotation (pin, circle, arrow or freehand line)     |
| `PATCH`  | `/api/soil-image-annotations/{a_id_annotation}`       | Update an annotation                                        |
| `DELETE` | `/api/soil-image-annotations/{a_id_annotation}`       | Delete an annotation                                        |
| `POST`   | `/api/farms/{b_id_farm}/soil-analyses/import/compare` | Read lab report PDFs and suggest the field of each analysis |
| `POST`   | `/api/farms/{b_id_farm}/soil-analyses/import/apply`   | Save the checked analyses, each with a copy of its report   |
| `GET`    | `/api/soil-analyses/{a_id}/document`                  | Download the lab report of a soil analysis                  |

Reading lab reports uses the NMI API and counts in the `nmi` bucket. File endpoints return `503` when the server has no file storage configured.

```ts
const form = new FormData()
form.append("files", new Blob([pdf], { type: "application/pdf" }), "report.pdf")
form.append("analyses", JSON.stringify({ ...item, b_id: "<field id>", a_date: "2026-03-20" }))

// Do not set Content-Type yourself: the client adds it with the boundary of the parts.
await fetch(`${baseUrl}/api/farms/${b_id_farm}/soil-analyses/import/apply`, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}` },
  body: form,
})
```

---

## Field import

Fields are imported from an RVO Mijn Percelen shapefile export in two steps. Both steps take the `.shp`, `.shx`, `.dbf` and `.prj` files and the `year` as `multipart/form-data`.

| Method | Path                                           | Description                                       |
| ------ | ---------------------------------------------- | ------------------------------------------------- |
| `POST` | `/api/farms/{b_id_farm}/fields/import/compare` | Compare the shapefile with the fields of the farm |
| `POST` | `/api/farms/{b_id_farm}/fields/import/apply`   | Apply a choice per field in one transaction       |

1. **Compare** returns one item per field with a `status` (`MATCH`, `NEW_REMOTE`, `NEW_LOCAL`, `CONFLICT` or `EXPIRED_LOCAL`), the differences, the actions that can be chosen and a `review_hash`. Nothing is saved.
2. **Apply** takes the same files, a `choices` JSON object with an `action` per `item_id` (optionally with `values` that override the name, dates, acquiring method, buffer strip, cultivation or the choice of geometry), an optional `default_action` and the `review_hash`. The server compares again: when the farm changed in between, nothing is saved and the response is `409` with the new review. An action that does not fit an item returns `422` with the `item_ids` involved.

New fields get estimated soil parameters after the import, so applying an import counts in the `nmi` rate limit bucket. A cultivation chosen in `values` must be in the catalogues of the farm.

---

## Fertilizer plans

| Method   | Path                                      | Description                                           |
| -------- | ----------------------------------------- | ----------------------------------------------------- |
| `GET`    | `/api/farms/{b_id_farm}/fertilizer-plans` | Saved plans with their status (`fresh`, `expired`)    |
| `POST`   | `/api/farms/{b_id_farm}/fertilizer-plans` | Generate the plan of a year (body `{ "year": 2026 }`) |
| `GET`    | `/api/fertilizer-plans/{p_id_plan}`       | A plan with its status                                |
| `GET`    | `/api/fertilizer-plans/{p_id_plan}/pdf`   | Download the PDF                                      |
| `DELETE` | `/api/fertilizer-plans/{p_id_plan}`       | Delete a plan and its PDF                             |

A plan is `expired` when the data of the farm or the calculation method changed since it was generated. The list and the generation count in the `nmi` bucket.

---

## Farm group and organization results

Balances, indicators and measures of several farms: for all selected farms together (`total`) and per farm (`farms`). They take a `year` and an optional, repeatable `b_id_farm` to narrow the farms.

| Method | Path                                                                       | Description                               |
| ------ | -------------------------------------------------------------------------- | ----------------------------------------- |
| `GET`  | `/api/farm-groups/{b_id_group}/calculations/nitrogen-balance`              | Nitrogen balance of the farms of a group  |
| `GET`  | `/api/farm-groups/{b_id_group}/calculations/organic-matter-balance`        | Organic matter balance                    |
| `GET`  | `/api/farm-groups/{b_id_group}/indicators`                                 | Area-weighted and lowest indicator scores |
| `GET`  | `/api/farm-groups/{b_id_group}/measures`                                   | Measures and main cultivations            |
| `GET`  | `/api/organizations/{organization_id}/calculations/nitrogen-balance`       | Same, for the farms of an organization    |
| `GET`  | `/api/organizations/{organization_id}/calculations/organic-matter-balance` |                                           |
| `GET`  | `/api/organizations/{organization_id}/indicators`                          |                                           |
| `GET`  | `/api/organizations/{organization_id}/measures`                            |                                           |

- **Farm group:** a farm counts when it is part of the group at some point in the year.
- **Organization:** all farms the organization has access to. The owner of the API key must be a member of the organization; the results are calculated with the access of the organization, as in the organization overview of the web app.
- **Totals:** the balances are calculated over all fields of the selected farms together. The indicator total is area-weighted over all eligible fields, with the lowest score per indicator. The measure total lists each measure once, with the farms that have it and the number of fields.

A farm that cannot be calculated is reported with an `error` and left out of the total; the other farms are still returned.

---

## OpenAPI documentation

| Path                | Description                                         |
| ------------------- | --------------------------------------------------- |
| `/api/openapi.json` | OpenAPI 3.1 document generated from runtime schemas |
| `/api/docs`         | Interactive Scalar documentation                    |

The OpenAPI document is generated directly from the same Zod schemas used for runtime validation. If the schema and the docs disagree, the schema wins.
