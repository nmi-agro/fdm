---
"@nmi-agro/fdm-app": minor
---

The user manual now shows screenshots of the app: every step of setting up a farm and the main screens of each chapter. Click a screenshot to see it at full size. The screenshots are captured automatically from the current version with a demo farm, so they stay in step with the app instead of going out of date.

For developers:

- fdm-app has a Playwright setup (`playwright.config.ts`, `e2e/`) that runs the production build against an empty PostGIS database. It has a seed for a demo farm (variants `minimal` and `demo`) and signs in through the normal magic-link flow, with the one-time code read from the database. The demo farm, user and data are made up; the field outlines are public BRP parcels near Wageningen.
- The `screenshots` project captures every screenshot the manual uses on a 1920 × 1080 screen (`pnpm --filter @nmi-agro/fdm-app screenshots`). It writes WebP images plus `manifest.json`. A new workflow, `manual-screenshots.yml`, runs it after each fdm-app release or on demand and opens a pull request with the changed images.
- The unit tests check that every screenshot in the manual has a capture definition.
- Atlas maps expose `data-map-idle` on their container, so automated tools can wait until the tiles have loaded.
