---
"@nmi-agro/fdm-app": minor
---

Add BLN3 indicators overview for farms. Two new pages are available under `/farm/:b_id_farm/:calendar/indicators`:

- **Tabel** – heatmap table (TanStack Table) with all 28 BLN3 indicators grouped by category (Biologisch, Chemisch, Fysisch, Grondwater, Nutriënten, Oppervlaktewater). Columns use rotated headers with tooltips. A pinned "Knelpunten" row shows the number of fields scoring below 40 per indicator. Aggregation cards for OBI (Open Bodem Index) and BBWP (BedrijfsBodemWaterPlan) show farm-level averages.
- **Kaart** – full-height MapLibre map coloured by a selected indicator score. An individual indicator can be chosen via floating badge chips grouped by category. Hovering a field shows its name and score.
