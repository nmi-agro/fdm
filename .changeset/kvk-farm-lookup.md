---
"@nmi-agro/fdm-app": minor
---

Look up a farm's name and address in the KvK Handelsregister by KvK number. When creating a farm, users now start with their KvK number and can skip this step if they have none; the farm address and postal code can also be entered right away. The farm settings page has an "Ophalen uit KvK" action as well. The lookup is enabled with `KVK_API_KEY` (and optionally `KVK_API_BASE_URL`) and is hidden when not configured.
