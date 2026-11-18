---
"@nmi-agro/fdm-core": minor
---

Add CRUD functions, authorization rules, and unit tests for livestock and dairy domain assets and actions (animals, herds, housing, milking, feed, manure, and grazing).

A grazing record covers the whole field, a zone within the field (`l_grazing_geometry_zone`, a Polygon or MultiPolygon clipped to the field when read), or an area without a known location (`l_grazing_area`). The grazing functions return the derived grazed area `l_grazing_area_grazed`. `getGrazingZonesForField` lists earlier zones on a field for reuse, and `getGrazedAreaForFarm` combines all zones per field into one grazed area.

A herd can be on the same field only once a day: its grazings on the same field may not share a calendar day, counting both the start and the end day, so two grazings of one day on the same field and day are rejected, also on different zones.
