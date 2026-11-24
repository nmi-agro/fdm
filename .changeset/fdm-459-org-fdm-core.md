---
"@nmi-agro/fdm-core": minor
---

Add `getFieldsForFarms` to read the fields of several farms at once. It checks read access once per farm and reads the fields of all farms in a single query. It returns a `Map` from farm ID to the farm's fields, with the same fields, timeframe filter and order (largest area first) as `getFields` returns per farm.
