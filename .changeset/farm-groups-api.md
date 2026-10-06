---
"@nmi-agro/fdm-api": minor
---

Add farm group endpoints: `GET`/`POST /organizations/{organization_id}/farm-groups`, `GET`/`PATCH`/`DELETE /farm-groups/{b_id_group}`, and `POST /farm-groups/{b_id_group}/farms` and `DELETE /farm-groups/{b_id_group}/farms/{b_id_farm}` to add and remove farms. `GET /farms` accepts a `b_id_group` query parameter.
