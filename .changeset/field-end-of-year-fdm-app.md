---
"@nmi-agro/fdm-app": patch
---

Calendar years are now interpreted in Europe/Amsterdam instead of UTC, so a field ended on 31 December or 1 January is no longer shown in, or included in calculations for, the next calendar year.

When a page of a field (field pages, nitrogen and organic matter balance, norms, nutrient advice, indicators, measures and mineralization) is opened for a calendar year in which the field is not managed, the page now shows a message instead of an empty result. The message names the field and its start or end date, links to the same page in the field's first or last year, and links to the field's settings page to correct the dates. Calculations for that page are skipped. The settings and delete pages of the field remain available.

The field picker in the header now shows the name of the selected field when it is not managed in the selected calendar year, instead of "Onbekend perceel".
