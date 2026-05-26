---
"@nmi-agro/fdm-app": minor
---

Add BLN3 indicators overview for farms.

- **Tabel** (`/farm/:b_id_farm/:calendar/indicators`) – heatmap table (TanStack Table) with all 28 BLN3 indicators grouped by category (Biologisch, Chemisch, Fysisch, Grondwater, Nutriënten, Oppervlaktewater). Columns use rotated headers with tooltips. A pinned "Knelpunten" row shows the number of fields scoring below 40 per indicator. Aggregation cards for OBI (Open Bodem Index) and BBWP (BedrijfsBodemWaterPlan) show farm-level averages.
- **Kaart** (`/farm/:b_id_farm/:calendar/atlas/indicators`) – full-height MapLibre map coloured by a selected indicator score, accessible from the Atlas section. An individual indicator can be chosen via a floating dropdown grouped by category. Hovering a field shows its name and score.

The "Indicatoren" sidebar entry is a direct link (not collapsible). The map layer is available as a sub-item under Atlas in the sidebar and in the Atlas layer dropdown.
