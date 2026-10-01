---
"@nmi-agro/fdm-app": minor
---

Added inline editing to the timeline Gantt view for cultivations, fertilizer applications, and harvests. Drag a cultivation bar's edges to adjust its start/end date, drag the whole bar to move it, or drag a fertilizer/harvest marker to change its date — each drop is saved immediately with a confirmation toast. Click a cultivation bar or a fertilizer/harvest marker to open a popover with "Bewerken" (opens a pre-filled edit form in a side sheet) and "Verwijderen" (delete, with confirmation) actions; double-click opens the edit form directly. Deleting is also available from the cultivation bar's right-click menu, from the edit sheet, and by hovering a fertilizer/harvest marker and pressing Delete. Canceling an edit sheet reloads the chart from the latest data. Soil sampling events remain unaffected (no dragging, editing, or deleting).
