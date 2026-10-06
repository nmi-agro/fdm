---
"@nmi-agro/fdm-app": minor
---

Add farm groups for organizations. Organization farms in the farm overview are shown under collapsible group headers when groups exist. The organization farms table gets a "Groepen" column, a group filter and a bulk action to assign farms to groups. The organization balance pages (nitrogen, organic matter), indicators, measures and the atlas indicators map get a group picker that selects the farms that are part of a group today. Groups are managed on the new `/organization/:slug/groups` page. For every farm, users set the dates from which and until which it is part of a group; these are the dates of the period itself, not the moment of the change.
