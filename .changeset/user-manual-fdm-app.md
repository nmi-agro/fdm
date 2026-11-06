---
"@nmi-agro/fdm-app": minor
---

Add a public user manual at `/manual`, readable without signing in. It has how-to chapters for every part of the app and background pages that explain the agronomy behind the results: the nitrogen and organic matter balances, application standards, nutrient advice, BLN3 soil quality, soil analyses and mineralisation. Buttons and menus appear in the manual as they look in the app. The chapters walk new users through setting up a farm step by step: fetching fields from RVO with eHerkenning, uploading an RVO shapefile or selecting fields on the map, uploading lab reports in bulk with automatic linking to fields, and seeing the effect of a fertilizer application on usage norms, nutrient advice and nitrogen balance while entering it. A separate chapter explains how to connect your own software through the API, with a link to the API documentation.

Pages in the app link to the matching chapter with a "?" button, the sidebar has a "Handleiding" item, and the sign-in page, the empty farm list and the farm creation wizard point new users to the manual. Help-link clicks, manual page views, sign-up clicks and missing manual pages are recorded in product analytics.

The app now serves `/sitemap.xml` and `/robots.txt`, and manual pages carry canonical URLs, social preview tags and structured data. Indexing is controlled by the new `FDM_SEO_INDEXING` environment variable, which is off by default so forks and staging environments are not indexed. **Production deployments must set `FDM_SEO_INDEXING=true` to stay in search results**: without it, `robots.txt` disallows all crawling, including the sign-in page.
