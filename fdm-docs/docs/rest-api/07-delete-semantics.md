---
title: Delete Semantics
sidebar_label: Delete Semantics
sidebar_position: 7
---

# Delete Semantics

All delete endpoints in the FDM REST API use the **existing hard-delete behavior** of the corresponding `fdm-core` function. There is no soft-delete, trash, or undo — deletions are permanent and cascade to child resources.

:::danger

All delete operations are permanent. There is no way to recover deleted data. Confirm resource identifiers carefully before calling a delete endpoint.

:::

## Required authorization

All delete operations require at least the `advisor` role on the resource being deleted (or the parent resource for child-owned resources). `fdm-core` uses the `write` action for delete permission checks.

## Idempotency

Delete endpoints are **idempotent in effect** — deleting a resource that is already gone leaves the system in the same state. However, repeated calls may return different HTTP status codes: the first delete returns `204`, subsequent calls return `404 not-found`. Design automation scripts to treat `404` as a success when the goal is to ensure the resource is gone.

## Cascade behavior

### `DELETE /api/farms/{b_id_farm}` — `removeFarm`

Deletes the farm and all resources owned by it, in order:

1. All **fields** associated with the farm (each field is deleted via the field cascade below).
2. All **fertilizer acquiring** records for the farm.
3. All **fertilizer picking** records for farm-custom fertilizers.
4. All **derogation** records for the farm.
5. All **authorization roles** for the farm (principal access entries).
6. The **farm** record itself.

**Authorization check:** `write` on `farm`.

---

### `DELETE /api/fields/{b_id}` — `removeField`

Deletes the field and all resources owned by it, in order:

1. All **cultivations** for the field (each cultivation is deleted via the cultivation cascade below).
2. All **soil sampling** records for the field.
3. All **soil analysis** records for the field.
4. The **field acquiring** and **field discarding** records.
5. All **authorization roles** for the field.
6. The **field** record itself.

**Authorization check:** `write` on `field`.

---

### `DELETE /api/cultivations/{b_lu}` — `removeCultivation`

Deletes the cultivation and directly associated records. Returns `404` if the cultivation does not exist.

1. All **harvest analyses** linked to the cultivation's harvestable records.
2. All **harvestable sampling** records.
3. All **cultivation harvesting** records.
4. The **cultivation ending** record.
5. The **cultivation starting** record (field link).
6. The **cultivation** record itself.

**Authorization check:** `write` on `cultivation`.

**Note:** Fertilizer applications linked to a cultivation are removed as part of the field delete cascade, not the cultivation delete. Deleting a cultivation alone does not remove its fertilizer application records.

---

### `DELETE /api/soil-analyses/{a_id}` — `removeSoilAnalysis`

Deletes the soil analysis and its sampling records:

1. The **soil sampling** record linked to this analysis.
2. The **soil analysis** record itself.

**Authorization check:** `write` on `soil_analysis`.

Returns `404` if the analysis does not exist.

---

## Summary table

| Endpoint | Hard delete | Cascades to | Idempotent | Auth required |
|---|---|---|---|---|
| `DELETE /api/farms/{b_id_farm}` | ✅ | Fields → cultivations → harvests → soil analyses → fertilizers → derogations | ✅ | `advisor` or `owner` on farm |
| `DELETE /api/fields/{b_id}` | ✅ | Cultivations → harvests, soil analyses | ✅ | `advisor` or `owner` on field |
| `DELETE /api/cultivations/{b_lu}` | ✅ | Harvests and harvest analyses | ✅ | `advisor` or `owner` on cultivation |
| `DELETE /api/soil-analyses/{a_id}` | ✅ | Soil sampling record | ✅ | `advisor` or `owner` on soil_analysis |
