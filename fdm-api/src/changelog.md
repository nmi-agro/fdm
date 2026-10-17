Notable changes to the REST API, newest first. Operations that were added recently carry a **New** badge in this reference.

## UNRELEASED

### Indicators and measure options

New read-only endpoints for indicator scores and the measure options of a field. All three require a four-digit `year` query parameter (for example `?year=2026`).

- `GET /fields/{b_id}/indicators` returns the indicator and aggregation scores of a field. Buffer strips and nature fields return `is_excluded: true` with empty lists.
- `GET /farms/{b_id_farm}/indicators` returns the scores of all eligible fields of a farm and the area-weighted farm scores. If one eligible field cannot be scored, the request fails with `503` instead of returning partial results.
- `GET /fields/{b_id}/measures/catalogue` returns the field-level measures from the catalogue with descriptions, applicability, active and conflicting status, predicted impacts per indicator and a recommendation (top five). The predicted impacts are advice for this field and year and are not stored on a measure. This advice is calculated with the NMI API. Use the `m_id` of a selectable option with `POST /fields/{b_id}/measures` to adopt it.

Good to know:

- These endpoints have their own rate limit of **10 requests per minute per API key**. They do not count towards the general limit.
- They return `503` when scores, applicability or advice are temporarily unavailable.
- Existing measure endpoints are unchanged.
