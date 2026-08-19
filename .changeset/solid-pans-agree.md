---
"@nmi-agro/fdm-app": minor
---

Show per-cut nutrient advice (snedezwaarte) for grassland on the field advice page. A new "Advies per snede" card shows one row per snede: the advisor picks the applicable snedezwaarte per row (the NMI API returns one advice per snede x snedezwaarte scenario), and the advice and nitrogen filling follow that choice. For completed cuts the snedezwaarte is derived from the recorded dry matter yield, and the Oogst column shows the harvest date and kg DS/ha. Nitrogen filling per snede is shown for every year with recorded harvests; in the current year the next upcoming snede is highlighted.

Also on the field advice page: nutrient cards now show the difference with the advice in kilograms ("-25 kg" / "+35 kg") instead of a percentage, keep two decimals for sub-kg trace elements, show the surplus when the advice is zero, and offer a "Toevoegen" shortcut when a nutrient has no applications yet. The KPI cards reuse the same 90%/110% advice-status thresholds as the per-nutrient progress bars, drop the side-stripe accents, and state explicitly when no nutrient is under or over advice. A failed advice calculation now renders an inline, actionable message instead of a full-screen error page, and the unit labels in the overview table are more legible.
