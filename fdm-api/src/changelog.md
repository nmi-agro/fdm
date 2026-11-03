Notable changes to the REST API, newest first. Operations that were added recently carry a **New** badge in this reference.

## 0.4.0

### New endpoints for more features of the web app

The API now covers more of the farm data features of the web app. Logic that was only in the web app moved to the shared libraries, so the API and the web app return the same results.

Not available through the API yet: sharing a farm with other users and organizations, the RVO import (it needs an interactive eHerkenning login), the map layers of the atlas, mineralization, the AI assistant and organization, account and API key management.

**Fertilizers**

- `POST /farms/{b_id_farm}/fertilizers/custom` creates a fertilizer with its own composition and acquires it for the farm.
- `PATCH /fertilizers/{p_id}` updates a custom fertilizer. Fertilizers from a standard catalogue return 422.

**Lists per farm**

- `GET /farms/{b_id_farm}/fertilizer-applications`, `/harvests`, `/measures` and `/current-soil-data` return the records of all fields of a farm in one request, with the usual `from`, `to`, `limit` and `offset` query parameters.

**Calculations**

- `GET /farms/{b_id_farm}/calculations/nutrient-advice` and `GET /fields/{b_id}/calculations/nutrient-advice` return the nutrient advice, the dose already applied and the remaining advice per nutrient, for the main cultivation of the year. A field that cannot be calculated has `error` set; the other fields are still returned.
- `GET /cultivations/{b_lu}/harvest-parameters` returns the parameters a harvest needs and their default values.

**Invitations**

- `GET /invitations` lists the pending farm invitations of the owner of the API key. `POST /invitations/{invitation_id}/accept` and `.../decline` respond to one.

**Soil condition score (BCS)**

- Soil analyses accept and return the nine BCS scores `a_ss_bcs` to `a_rt_bcs` (0, 1 or 2 each).
- `GET` and `POST /soil-analyses/{a_id}/images` list and upload the photos of an assessment; `GET` and `DELETE /soil-images/{a_id_image}` download and delete one. Annotations on a photo are managed with `POST /soil-images/{a_id_image}/annotations` and `PATCH` and `DELETE /soil-image-annotations/{a_id_annotation}`.

**Lab reports**

- `POST /soil-analyses/extract` reads soil analyses from up to ten lab report PDFs without saving them. Pass the returned `upload_token` to `POST /fields/{b_id}/soil-analyses` to store the report with the analysis, and download it with `GET /soil-analyses/{a_id}/document`. Soil analyses report `has_document`.

**Field import from a shapefile**

- `POST /farms/{b_id_farm}/fields/import/compare` compares an RVO Mijn Percelen shapefile export with the fields of the farm, without saving.
- `POST /farms/{b_id_farm}/fields/import/apply` applies a choice per field in one transaction. When the farm changed since the compare step, it returns 409 with the new review.

**Fertilizer plans**

- `GET` and `POST /farms/{b_id_farm}/fertilizer-plans` list and generate the yearly fertilizer plan (bemestingsplan). `GET /fertilizer-plans/{p_id_plan}`, `GET .../pdf` and `DELETE` return, download and delete a plan. Each plan reports whether it still matches the current data.

**Farm groups**

- `GET /farm-groups/{b_id_group}/calculations/nitrogen-balance`, `.../organic-matter-balance`, `/indicators` and `/measures` return the results of the farms in a group for a year, in total and per farm.

### Changed

- `GET /fields/{b_id}/current-soil-data` includes the nitrogen supplying capacity (`d_n_supply_base`) calculated from organic matter, clay and C/N when no analysis has it, with one source of type `calculated`. The web app shows the same value.
- File uploads use `multipart/form-data` on the upload endpoints above, with a size limit per endpoint. All other write requests still require `application/json`.
- A write request without a body, such as accepting an invitation, no longer needs a `Content-Type` header.

### Breaking: current soil data lists its sources

`GET /fields/{b_id}/current-soil-data` returns per parameter the contributing soil analyses in `sources`, instead of a single `a_id`, `b_sampling_date`, `a_source` and depth. Each source has its `a_id`, `a_source`, `b_sampling_date`, `a_depth_upper`, `a_depth_lower`, `value` and `area_fraction`, newest first. New fields per parameter:

- `is_aggregated`: `true` when the value combines several sampling zones.
- `coverage`: the share of the field that the sources represent (0–1).
- `has_coverage_warning`: `true` when the sampling zones cover less than 95% of the field.

For fields without sampling zones, `sources` holds exactly one analysis and the values are unchanged. When the most recent analysis for a parameter covers a sampling zone, the zones sampled within one month of it are combined: numeric parameters by the area-weighted mean, categorical parameters by the value with the largest area.

### Sampling geometries and zones

- Soil analyses return `b_sampling_geometry` (GeoJSON `MultiPoint`, the locations of the subsamples) and `b_sampling_geometry_zone` (GeoJSON `MultiPolygon`, the area the analysis represents; `null` for the whole field). `POST /fields/{b_id}/soil-analyses` and `PATCH /soil-analyses/{a_id}` accept both; a zone may also be a `Polygon`.
- `GET /fields/{b_id}/current-soil-data/zones` returns the current soil data per sampling zone, with the zone geometry clipped to the field and its area in hectares.

## 0.3.1

### Every field documented

Every field in request bodies and responses, and every path and query parameter, now has a description in this reference. Each description states what the field means and, where relevant, its unit (for example kg N/ha or mg/kg), its allowed values or typical range, and what `null` means. Requests and responses are unchanged.

- Removal, emission and degradation in the nitrogen and organic matter balances are documented as negative numbers, which is how they are returned.
- `b_lu_croprotation` and `b_lu_harvestable` of a cultivation were documented as booleans. They are now documented with the string values the API returns, for example `"grass"` and `"once"`.

## 0.3.0

### Breaking: fertilizer catalogue endpoint removed

`GET /farms/{b_id_farm}/fertilizer-catalogue` has been removed. Use `GET /farms/{b_id_farm}/catalogues/fertilizer/items` instead, which lists the fertilizers in the catalogues enabled on the farm and supports the `source`, `limit` and `offset` query parameters.

### Farm groups

New endpoints for farm groups: named groups of farms within an organization, for example the participants of a project or a study group. A farm can be part of several groups. Its membership is recorded as periods with a join date (`b_group_joined`) and an optional end date (`b_group_leaved`). These are the dates chosen by the caller and can lie in the past or the future; they are not the moment of the request.

- `GET /organizations/{organization_id}/farm-groups` lists the groups of an organization and `POST` on the same path creates one. The owner of the API key must be a member of the organization.
- `GET /farm-groups/{b_id_group}` returns a group with its current farms and all membership periods. `PATCH` renames the group and `DELETE` removes it with its membership history; the farms themselves are not affected.
- `POST /farm-groups/{b_id_group}/farms` adds a farm of the same organization to the group, with an optional `b_group_joined` (default: today) and `b_group_leaved`.
- `DELETE /farm-groups/{b_id_group}/farms/{b_id_farm}` ends the membership on the optional `b_group_leaved` query date (default: today) and keeps the history.
- `PATCH /farm-groups/{b_id_group}/farms/{b_id_farm}/{b_group_joined}` changes the join date and/or end date of the period that starts on `b_group_joined`. Pass `b_group_leaved: null` to remove the end date. Periods of the same farm in a group may not overlap.
- `DELETE /farm-groups/{b_id_group}/farms/{b_id_farm}/{b_group_joined}` deletes that period, as if the farm never was part of the group in it. Use this to correct a mistake; use the endpoint above to end a membership.
- `GET /farms` accepts the optional `b_id_group` query parameter to list only the farms that are currently part of that group.

### Catalogues

New read-only endpoints for the cultivation, fertilizer and field measure catalogues.

- `GET /catalogues` lists the available catalogues per type, with their `source` code and title.
- `GET /farms/{b_id_farm}/catalogues/cultivation`, `.../fertilizer` and `.../measure` list the `source` codes of the catalogues enabled on a farm.
- `GET /farms/{b_id_farm}/catalogues/cultivation/items`, `.../fertilizer/items` and `.../measure/items` list the items in the catalogues enabled on a farm. Pass the optional `source` query parameter to list a single catalogue. These responses are paginated with `limit` and `offset`. They return `404` when the catalogue is not enabled on the farm.

Use the identifiers from these lists to add cultivations, fertilizers and measures to a farm or field.

### Default catalogues for new farms

`POST /farms` now enables the default catalogues for the new farm: `baat` and the farm's own fertilizers, `brp` for cultivations and `bln` for field measures. The fertilizers in these catalogues are added to the farm's fertilizer list. This happens in the same transaction as creating the farm, so either all steps succeed or no farm is created. The request and response are unchanged.

### Nitrogen balance with effective nitrogen

`GET /farms/{b_id_farm}/calculations/nitrogen-balance` and `GET /fields/{b_id}/calculations/nitrogen-balance` accept an optional `effective_nitrogen` query parameter (`true` or `false`, default `false`).

- With `effective_nitrogen=true`, the supply by fertilizers is calculated with effective nitrogen (`p_n_rt * p_n_wc`) and the soil mineralization with the MINIP model. Nitrate leaching is still based on the surplus of the balance with total nitrogen.
- The target only applies to the balance with total nitrogen. With `effective_nitrogen=true`, `target` is omitted from the response, also for the fields in the farm balance.
- Without the parameter, the response is unchanged.

### Indicators and measure options

New read-only endpoints for indicator scores and the measure options of a field. All three require a four-digit `year` query parameter (for example `?year=2026`).

- `GET /fields/{b_id}/indicators` returns the indicator and aggregation scores of a field. Buffer strips and nature fields return `is_excluded: true` with empty lists.
- `GET /farms/{b_id_farm}/indicators` returns the scores of all eligible fields of a farm and the area-weighted farm scores. If one eligible field cannot be scored, the request fails with `503` instead of returning partial results.
- `GET /fields/{b_id}/measures/catalogue` returns the field-level measures from the catalogue with descriptions, applicability, active and conflicting status, predicted impacts per indicator and a recommendation (top five). The recommendation holds at most one variant of a measure (for example only one of `bln_BM56b` and `bln_BM56c`) and none when another variant of that measure is already adopted on the field. The predicted impacts are advice for this field and year and are not stored on a measure. This advice is calculated with the NMI API. Use the `m_id` of a selectable option with `POST /fields/{b_id}/measures` to adopt it.

Good to know:

- These endpoints have their own rate limit of **10 requests per minute per API key**. They do not count towards the general limit.
- They return `503` when scores, applicability or advice are temporarily unavailable.
- Existing measure endpoints are unchanged.

## 0.2.9

### Dates in Europe/Amsterdam

- Dates in responses are serialised as their calendar date in Europe/Amsterdam instead of UTC. A date stored at midnight in Europe/Amsterdam is no longer returned as the previous day.
- `b_end` of a field and `m_end` of a measure are the last day the field is managed or the measure is applied (inclusive). An end date on 1 January is returned as 31 December of the previous year, so the field or measure is not counted in the next calendar year.
- Updating a field without `b_end` now leaves its stored end date unchanged.
