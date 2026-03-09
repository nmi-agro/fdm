---
"@nmi-agro/fdm-app": patch
---

Improve DatePickers and Forms to use contextual default dates based on the selected calendar year. Forms now default to domain-specific dates (e.g., March 1st for fertilizer and cultivation-specific harvest defaults in non-current years), and DatePickers now resolve partial text entries (like "15 april") to the active calendar year instead of the current real-world year.