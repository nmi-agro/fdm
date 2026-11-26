Notable changes to the REST API, newest first. Operations that were added recently carry a **New** badge in this reference.

## 0.4.0

### New endpoints for more features of the web app

The API now covers more of the farm data features of the web app. Logic that was only in the web app moved to the shared libraries, so the API and the web app return the same results.

Not available through the API yet: livestock and grazing records, the phosphate balance, sharing a farm with other users and organizations, the RVO import (it needs an interactive eHerkenning login), the map layers of the atlas, mineralization, the AI assistant and organization, account and API key management.

**Fertilizers**

- `POST /farms/{b_id_farm}/fertilizers/custom` creates a fertilizer with its own composition and acquires it for the farm.
- `PATCH /fertilizers/{p_id}` updates a custom fertilizer. Fertilizers from a standard catalogue return 422.

**Lists per farm**

- `GET /farms/{b_id_farm}/fertilizer-applications`, `/harvests`, `/measures` and `/current-soil-data` return the records of all fields of a farm in one request, with the usual `from`, `to`, `limit` and `offset` query parameters.

**Calculations**

- `GET /farms/{b_id_farm}/calculations/nutrient-advice` and `GET /fields/{b_id}/calculations/nutrient-advice` return the nutrient advice, the dose already applied and the remaining advice per nutrient, for the main cultivation of the year. A field that cannot be calculated has `error` set; the other fields are still returned. Both count towards the rate limit of 10 requests per minute for endpoints that call the NMI API.
- `GET /cultivations/{b_lu}/harvest-parameters` returns the parameters a harvest needs and their default values.

**Invitations**

- `GET /invitations` lists the pending farm invitations of the owner of the API key. `POST /invitations/{invitation_id}/accept` and `.../decline` respond to one.

**Soil condition score (BCS)**

- Soil analyses accept and return the nine BCS scores `a_ss_bcs` to `a_rt_bcs` (0, 1 or 2 each).
- `GET` and `POST /soil-analyses/{a_id}/images` list and upload the photos of an assessment (a soil analysis with at least one visual score; uploading to other soil analyses returns 422). A photo is JPEG, PNG, WebP or HEIC and at most 10 MB. `GET` and `DELETE /soil-images/{a_id_image}` download and delete one. Annotations on a photo are managed with `POST /soil-images/{a_id_image}/annotations` and `PATCH` and `DELETE /soil-image-annotations/{a_id_annotation}`.

**Lab reports**

- `POST /farms/{b_id_farm}/soil-analyses/import/compare` reads soil analyses from up to ten lab report PDFs of at most 5 MB each and suggests the field of each analysis, without saving. `POST /farms/{b_id_farm}/soil-analyses/import/apply` takes the same files and the checked analyses (one `analyses` field with a JSON array, or one field per analysis) and saves them in one transaction, each with a copy of its report. Download the report with `GET /soil-analyses/{a_id}/document`; soil analyses report `has_document`.

**Field import from a shapefile**

- `POST /farms/{b_id_farm}/fields/import/compare` compares an RVO Mijn Percelen shapefile export with the fields of the farm, without saving.
- `POST /farms/{b_id_farm}/fields/import/apply` applies a choice per field in one transaction. When the farm changed since the compare step, it returns 409 with the new review.

**Fertilizer plans**

- `GET` and `POST /farms/{b_id_farm}/fertilizer-plans` list and generate the yearly fertilizer plan (bemestingsplan). `GET /fertilizer-plans/{p_id_plan}`, `GET .../pdf` and `DELETE` return, download and delete a plan. Each plan reports whether it still matches the current data.

**Farm groups and organizations**

- `GET /farm-groups/{b_id_group}/calculations/nitrogen-balance`, `.../organic-matter-balance`, `/indicators` and `/measures` return the results of the farms in a group for a year, for all farms together and per farm.
- `GET /organizations/{organization_id}/...` with the same four paths returns the same for all farms of an organization. The owner of the API key must be a member.

**Health check**

- `GET /health` is a liveness check for container healthchecks. It needs no API key, does not touch the database and returns `{"status":"ok"}`.

### Nitrogen balance: nitrous oxide emission

- The nitrogen balance of a field, a farm and a group of farms returns `emission.nitrous_oxide`: the direct nitrous oxide (N₂O) emission from fertilizers, crop residues and organic soils, and their total, in kg N/ha (negative), with `co2eq` in kg CO₂-eq/ha (positive). The indirect N₂O emission is not calculated.
- The N₂O emission is part of `emission.total` and is subtracted in the balance. For the same input, `balance` and the nitrate leaching (`emission.nitrate`) are therefore lower than in 0.3.x. The nitrate leaching itself is not part of the balance.

### Sampling geometries and zones

- Soil analyses return `b_sampling_geometry` (GeoJSON `MultiPoint`, the locations of the subsamples) and `b_sampling_geometry_zone` (GeoJSON `MultiPolygon`, the area the analysis represents; `null` for the whole field). `POST /fields/{b_id}/soil-analyses` and `PATCH /soil-analyses/{a_id}` accept both; a zone may also be a `Polygon`.
- A sampling geometry that is empty, has a position outside WGS84, or has a zone with an empty polygon, an unclosed ring or a ring of fewer than four positions returns 422.
- `GET /fields/{b_id}/current-soil-data/zones` returns the current soil data per sampling zone, with the zone geometry clipped to the field and its area in hectares.

### Rate limits and usage limits

- The write rate limit is raised from 30 to 120 requests per minute per API key.
- A farm can have at most 500 fields. Adding more fields returns 422, and farm-level lists, calculations and field imports of a larger farm return 422.
- A user can create at most 10 farms per 24 hours, across all their API keys. The next `POST /farms` returns 429 with a `Retry-After` header.

### Changed

- The nitrogen and organic matter balances use the most recent soil data per parameter up to the end of the requested period, also from analyses sampled before it. Balance values can change for fields whose latest analysis is older than the period.
- `GET /fields/{b_id}/current-soil-data` includes the nitrogen supplying capacity (`d_n_supply_base`) calculated from organic matter, clay and C/N when no analysis has it, with one source of type `calculated`. The web app shows the same value.
- `POST /farms` also enables the RVO animal category catalogue (`rvo`) on the new farm, next to the fertilizer, cultivation and measure catalogues.
- Coded fields list every code with the Dutch name the web app shows: the application method (`p_app_method`), the acquiring method of a field (`b_acquiring_method`), the source of a soil analysis (`a_source`), the soil type (`b_soiltype_agr`) and the groundwater class (`b_gwl_class`). A request with an unknown code returns 400 with the allowed values instead of 500. A client cannot choose the system-only source `nl-other-nmi`.
- `PATCH /fields/{b_id}` returns the centroid, area and perimeter of the field.
- `GET /farms/{b_id_farm}/derogations` returns `b_id_farm` with each derogation, and no longer the undocumented `created` and `updated`.
- The measure catalogue documents `m_summary`, `m_source_url` and `m_conflicts` as nullable, and `m_stage_applicability` as `field` or `farm`.
- A second harvest of a crop that is harvested once returns 409 instead of 500. A field balance with incomplete soil data returns 422 and names the missing parameters, instead of 500.
- File uploads use `multipart/form-data` on the upload endpoints above, with a size limit per endpoint. The `Content-Type` header must include the boundary; a `multipart/form-data` body without it returns 400. All other write requests still require `application/json`.
- A write request without a body, such as accepting an invitation, no longer needs a `Content-Type` header.
- Every operation in the OpenAPI document has an `operationId`.

### Every field documented

Every field in request bodies and responses, and every path and query parameter, now has a description in this reference. Each description states what the field means and, where relevant, its unit (for example kg N/ha or mg/kg), its allowed values or typical range, and what `null` means.

- Removal, emission and degradation in the nitrogen and organic matter balances are documented as negative numbers, which is how they are returned.
- `b_lu_croprotation` and `b_lu_harvestable` of a cultivation were documented as booleans. They are now documented with the string values the API returns, for example `"grass"` and `"once"`.

### Breaking: current soil data lists its sources

`GET /fields/{b_id}/current-soil-data` returns per parameter the contributing soil analyses in `sources`, instead of a single `a_id`, `b_sampling_date`, `a_source` and depth. Each source has its `a_id`, `a_source`, `b_sampling_date`, `a_depth_upper`, `a_depth_lower`, `value` and `area_fraction`, newest first. Read these values from the entries of `sources` instead. New fields per parameter:

- `is_aggregated`: `true` when the value combines several sampling zones.
- `coverage`: the share of the field that the sources represent (0–1).
- `has_coverage_warning`: `true` when the sampling zones cover less than 95% of the field.

For fields without sampling zones, `sources` holds exactly one analysis and the values are unchanged. When the most recent analysis for a parameter covers a sampling zone, the zones sampled within one month of it are combined: numeric parameters by the area-weighted mean, categorical parameters by the value with the largest area.

## 0.3.3

### Indicators: fields without a main cultivation

- A field without a main cultivation in the requested year now gets no indicator scores and no measure options. `GET /fields/{b_id}/indicators` and `GET /fields/{b_id}/measures/catalogue` return it with `is_excluded: true` and empty lists, and `GET /farms/{b_id_farm}/indicators` leaves it out of `fields` and the farm scores.
- Both field endpoints return the new `exclusion_reason`: `bufferstrip`, `nature`, `no_main_cultivation`, or `null` when the field is not excluded.

## 0.3.2

### Fertilizer applications: limits on the amount

- `POST /fields/{b_id}/fertilizer-applications` and `PATCH /fertilizer-applications/{p_app_id}` require `p_app_amount_display` to be greater than 0, and return 400 otherwise.
- An amount that, converted to kg/ha, is greater than 100,000 kg/ha returns 422. The `detail` names the maximum in the unit of the fertilizer.
- `PATCH /fertilizer-applications/{p_app_id}` without a new amount and without a new fertilizer keeps the stored amount.

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
