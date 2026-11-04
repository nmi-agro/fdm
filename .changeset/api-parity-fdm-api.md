---
"@nmi-agro/fdm-api": minor
---

Add endpoints for the farm data features of the web app: custom fertilizers (`POST /farms/{b_id_farm}/fertilizers/custom`, `PATCH /fertilizers/{p_id}`), lists per farm of fertilizer applications, harvests, measures and current soil data, nutrient advice per farm and per field, harvest parameters of a cultivation, farm invitations of the key owner, soil condition score (BCS) parameters, photos and annotations, importing soil analyses from lab report PDFs in two steps (compare and apply) and keeping the report, a two-step field import from an RVO shapefile, fertilizer plans, and balances, indicators and measures of a farm group or an organization, for all farms together and per farm. Current soil data includes the calculated nitrogen supplying capacity when no analysis has it. Upload endpoints accept `multipart/form-data` with a size limit per endpoint, and a write request without a body needs no `Content-Type`. `createFdmApi` accepts a `storage` and `reportBranding`.

The standalone fdm-api service needs new configuration for these endpoints. Without it, the endpoints that need a setting below return 503:

- `GCS_BUCKET_NAME`: the bucket for uploaded and generated files. Use the same bucket as fdm-app, so files are shared between both.
- `GOOGLE_APPLICATION_CREDENTIALS`, `GCS_SERVICE_ACCOUNT_EMAIL` or `GCS_SERVICE_ACCOUNT_KEY` (optional): credentials for the bucket, as in fdm-app. Without them, Application Default Credentials are used.
- `NMI_API_KEY`: needed for the nutrient advice, reading lab reports, the fertilizer plans and the soil estimates of new fields after an import.
- `FDM_REPORT_LOGO`, `FDM_REPORT_LOGO_INVERTED` and `FDM_REPORT_COVER` (optional): paths to the logo, the logo for dark backgrounds and the cover image (PNG or JPEG) of the fertilizer plan. The files must be available in the fdm-api container. Without them, the plan shows only the application name.
