Notable changes to the REST API, newest first. Operations that were added recently carry a **New** badge in this reference.

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
