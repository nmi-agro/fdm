Notable changes to the REST API, newest first. Operations that were added recently carry a **New** badge in this reference.

## UNRELEASED

### Catalogues

New read-only endpoints for the cultivation, fertilizer and field measure catalogues.

- `GET /catalogues` lists the available catalogues per type, with their `source` code and title.
- `GET /farms/{b_id_farm}/catalogues/cultivation`, `.../fertilizer` and `.../measure` list the `source` codes of the catalogues enabled on a farm.
- `GET /farms/{b_id_farm}/catalogues/cultivation/{source}`, `.../fertilizer/{source}` and `.../measure/{source}` list the items in a catalogue. These responses are paginated with `limit` and `offset`. They return `404` when the catalogue is not enabled on the farm.

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
