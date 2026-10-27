---
"@nmi-agro/fdm-app": minor
---

The Tijdlijn now respects the period in which a field is in use (start and end date). Fields that are not in use at any moment of the year in view are moved to a collapsed group "Niet in gebruik in {jaar}", in the Gantt view (the group follows the year at the centre of the view once scrolling stops, and the Calendar year selector follows along) and in the mobile "Perceel" view. Fields that start or end during the year show a hatched area outside their period, boundary markers and a badge. Cultivations without an end date are drawn up to the end of the field, and a cultivation that ends after its field is cut off with a warning; stored cultivations are not changed. Events can no longer be dragged, clicked or entered outside the period of the field, the date pickers in the add and edit sheet disable those days, and the Tijdlijn actions reject such dates.
