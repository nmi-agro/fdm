---
"@nmi-agro/fdm-core": patch
---

Fix fields and measures that end exactly at the start of a calendar year still being returned for that year:

- `addField` and `updateField` now store `b_end` as the end of the last day the field is managed (`23:59:59.999` Europe/Amsterdam). An end date on 1 January is stored as the end of 31 December of the previous year, so ending a field on 31 December or on 1 January gives the same result and the field is no longer part of the new calendar year.
- `addMeasure` and `updateMeasure` normalise `m_end` in the same way, so a measure ended on 31 December or 1 January is no longer returned for the next calendar year and no longer overlaps a measure that starts on 1 January.
- Add a migration that normalises existing `b_end` and `m_end` values in the same way.
- Add `normalizeEndDate`, `startOfDayInFdmTimeZone` and `FDM_TIME_ZONE`.
