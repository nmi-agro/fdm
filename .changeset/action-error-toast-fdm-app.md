---
"@nmi-agro/fdm-app": patch
---

Fixed several forms showing the full-page error screen instead of a warning toast when an action fails, for example accepting all BRP main-cultivation suggestions on the farm dashboard, deleting a fertilizer application on the timeline, removing a fertilization plan and saving profile settings. Warning and error toasts from a failed action now also appear right away, instead of only after the next page navigation. Validation errors from these forms are no longer reported twice with a second error code.
