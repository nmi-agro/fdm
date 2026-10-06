---
"@nmi-agro/fdm-api": minor
---

Add farm group endpoints: `GET`/`POST /organizations/{organization_id}/farm-groups`, `GET`/`PATCH`/`DELETE /farm-groups/{b_id_group}`, and `POST /farm-groups/{b_id_group}/farms` and `DELETE /farm-groups/{b_id_group}/farms/{b_id_farm}` to add farms and end their membership, and `PATCH /farm-groups/{b_id_group}/farms/{b_id_farm}` to change the dates of a period. The optional dates `b_group_joined` and `b_group_leaved` set from and until when a farm is part of a group. `GET /farms` accepts a `b_id_group` query parameter.
