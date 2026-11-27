---
"@nmi-agro/fdm-app": patch
---

Show the tabs under "Voor ontwikkelaars en lokale modellen" on the "AI-assistenten" page above their instructions instead of beside them, so the tab names and the code examples are readable again. The environment variable for the API key in the examples on that page and in the manual is now named after the application (for example `MY_APP_API_KEY`) instead of `FDM_API_KEY`; a name that starts with a digit gets a leading underscore, so it stays a valid shell variable name.
