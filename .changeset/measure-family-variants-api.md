---
"@nmi-agro/fdm-api": patch
---

`GET /fields/{b_id}/measures/catalogue` recommends at most one variant per measure (IDs that differ only in a trailing lowercase letter, such as `bln_BM56b` and `bln_BM56c`) and no variant when another variant of that measure is already adopted on the field. A variant that is not selectable (for example because it conflicts with an adopted measure) no longer hides a selectable variant of the same measure. The API reference and changelog describe this.
