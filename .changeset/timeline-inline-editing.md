---
"@nmi-agro/fdm-app": minor
---

Added inline editing to the timeline. Left click a cultivation, fertilizer application, harvest or soil analysis, or an empty spot on a field row, to open a context menu with sections for details (with a link to the item's page), adding and managing. On a cultivation you can add a fertilizer application, register a harvest or end the cultivation; on empty space you can add a cultivation, fertilizer application or soil analysis; editing opens a pre-filled form in a side sheet and deleting asks for confirmation (soil analyses can be deleted too, except BodemConditieScore analyses). Hovering a fertilizer/harvest marker and pressing Delete also removes it. On mobile, tapping an event card opens the same menu.

In the Gantt view, drag a cultivation bar's edges to adjust its start/end date, drag the whole bar to move it, or drag a fertilizer/harvest marker to change its date. The new date is shown while dragging, harvests of single-harvest crops can be dragged past the cultivation end, and each drop is saved immediately. While saving, the timeline is greyed out with an "Opslaan..." indicator, and afterwards an "Ongedaan maken" button next to the toolbar buttons reverts the move. Canceling an edit sheet reloads the chart from the latest data.
