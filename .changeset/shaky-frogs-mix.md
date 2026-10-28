---
"@nmi-agro/fdm-api": minor
---

Add read-only endpoints for the cultivation, fertilizer and field measure catalogues:

- `GET /catalogues` lists the available catalogues and their `source` codes.
- `GET /farms/{b_id_farm}/catalogues/{cultivation|fertilizer|measure}` lists the catalogues enabled on a farm.
- `GET /farms/{b_id_farm}/catalogues/{cultivation|fertilizer|measure}/{source}` lists the items in a catalogue, paginated with `limit` and `offset`. Returns `404` when the catalogue is not enabled on the farm.

`POST /farms` now enables the default catalogues (`baat` and the farm's own fertilizers, `brp` cultivations and `bln` field measures) and adds the catalogue fertilizers to the farm's fertilizer list, all in the same transaction as the farm itself. Farms created through the API can therefore be used for cultivations, fertilizer applications and measures right away.
