---
"@nmi-agro/fdm-app": minor
---

Add visual soil analysis (BCS) feature to the field soil page.

- New **Visueel** tab on the field soil page lists all visual assessments for a field, showing date, assessor, and I_BCS score
- Advisors can create a new assessment by scoring 9 BCS indicators (soil structure, compaction, earthworms, etc.); the Dutch BCS formula is calculated automatically and shown as a live preview
- Images of the soil pit can be captured with the device camera or uploaded from disk; they are stored directly in Google Cloud Storage via signed URLs (no image bytes pass through the server)
- Images can be annotated with pins, circles, arrows, and freehand drawings, each optionally linked to a BCS indicator
- Google Cloud Storage authentication supports Application Default Credentials (recommended for GCP deployments), Workload Identity Federation (recommended for non-GCP), or an inline service account key as a fallback. Configure via `GCS_BUCKET_NAME`, `GCS_SERVICE_ACCOUNT_EMAIL`, and optionally `GOOGLE_APPLICATION_CREDENTIALS`
- Visual soil images are stored under the `visual_soil_analysis/` folder in the bucket, keeping it separate from other file types stored in the same bucket
