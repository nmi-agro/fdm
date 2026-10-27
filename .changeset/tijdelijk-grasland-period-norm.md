---
"@nmi-agro/fdm-calculator": patch
---

Fix the selection of the period-based nitrogen usage norm for temporary grassland (`Tijdelijk grasland`) in 2025 and 2026, following RVO Tabel 2:

- Grass sown on or after 15 April now gets the latest "vanaf …" sowing window that has started, instead of always "vanaf 15 april". For example, grass sown on 15 October now gets 0 kg N/ha instead of the "vanaf 15 april tot minstens 15 oktober" norm.
- Temporary grassland that continues into the next year now gets the norm for the full norm year, instead of "tot minstens 15 april".
- Grass sown between 1 January and 15 April uses the "van 1 januari tot minstens …" rows.
- Temporary grassland sown in a previous year that is followed by another main crop (e.g. grass destroyed in spring before maize) is now counted with its "van 1 januari tot minstens …" norm when it lasts until at least 15 April. Previously it was left out because it was not the main crop (hoofdteelt). When it is renewed by grass that is sown before 15 October and remains until at least 15 October, the re-sown grass carries the norm instead and is marked as heringezaaid. This also applies when the old stand is the main crop.
- Grass that does not meet the minimum period of any row (destroyed before 15 April, or sown in a "vanaf" window and destroyed before 15 October) now receives 0 kg N/ha, with the note "geen ruimte: minimale periode niet gehaald".

Gras voor industriële verwerking now also takes the sowing date into account: grass sown before 15 May in its first year receives the "inzaai voor 15 mei en volgende jaren" norm instead of the "inzaai in september en eerste jaar" norm.

The norm description (`normSource`) of temporary grassland now includes the selected period, e.g. "Tijdelijk grasland (vanaf 15 oktober) (0 kg N/ha)".

The period selection is available as `selectSubTypeByPeriod` and is shared by the 2025 and 2026 calculators.

In 2026 the grassland renewal reduction (50 kg N/ha) and the grassland destruction reduction (65 kg N/ha) now apply only on sand and loess, following footnotes 14, 15 and 16 of Tabel 2. Previously they were also applied on clay and peat.
