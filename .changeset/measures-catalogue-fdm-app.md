---
"@nmi-agro/fdm-app": minor
---

New Maatregelencatalogus at `/measures-catalogue`: a searchable list of all soil measures with filters on effect type, costs (laag, gemiddeld, hoog) and theme, sortable by name or code. Each measure shows its cost level, the number of indicators it affects and its effect type, with a short explanation of the effect type. Measures that are no longer in the catalogue are hidden, unless the selected farm still applies them.

A farm and year can be selected in the catalogue; it starts with the farm and year last opened. Measures applied on at least one field of that farm in that year get a green dot with the number of fields, and the "Status" filter shows only those measures. The detail page then lists the fields where the measure is applied, with its period and a link to the measures of that field. The farm and year are carried along when the catalogue is opened from a farm.

The detail page of a measure shows the summary, the cost level, the effect type, the references (IDs in related schemes and a link to the source), the description, the indicators the measure affects with their theme and the range of effect sizes from the catalogue, the applicability conditions as a readable table, the conflicting measures that are in the catalogue and the other variants of the same measure.

The catalogue is reachable from "Alle maatregelen bekijken" under Maatregelen in the farm and organization sidebars, and from "Naslag" in the platform sidebar. Wherever a measure is shown — the Add Measure dialog, the active measures of a field, the farm and organization measure tables and the recommended measures — an icon opens its detail page in a new tab, so the current page and any open dialog stay as they are. The Add Measure dialog no longer offers measures that are no longer in the catalogue, and its search also looks in the summary.
