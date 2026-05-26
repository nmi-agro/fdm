---
"@nmi-agro/fdm-app": minor
---

Add BLN3 indicators overview for farms.

- **Tabel** (`/farm/:b_id_farm/:calendar/indicators`) – heatmap table with all 27 BLN3 indicators grouped by ecosysteemdienst (Gewasproductie, Koolstofvastlegging, Waterkwaliteit, Nutriëntenkringloop). Aggregation cards per ecosysteemdienst show farm-level averages (computed as the mean of contributing indicator scores).
- **Kaart** (`/farm/:b_id_farm/:calendar/atlas/indicators`) – full-height MapLibre map coloured by a selected indicator score, accessible from the Atlas section. An individual indicator or ecosysteemdienst can be chosen via a floating dropdown grouped by ecosysteemdienst. Hovering a field shows its name and score.

The "Indicatoren" sidebar entry is a direct link (not collapsible). The map layer is available as a sub-item under Atlas in the sidebar and in the Atlas layer dropdown.
