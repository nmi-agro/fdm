## Summary

Uploaded soil analysis PDFs are currently processed but then discarded. They are uploaded via the soil analysis upload form (and bulk upload), extracted via the NMI API, added to the DB, then lost. The original PDF is never retained.

These should be stored in GCS so that:

- Users can view and download the original PDF on the specific soil analysis detail page.

This issue also introduces a **shared server-side GCS upload utility** to eliminate the code duplication that already exists between `api.image-upload.ts` and `api.bcs-image.ts`, and to provide a single consistent foundation for soil images, profile pictures (see companion issue), and soil analysis PDFs.

---

## Background and current state

### Soil analysis upload

**File:** `fdm-app/app/routes/farm.$b_id_farm.$calendar.field.$b_id.soil.analysis.new.upload.tsx`

The PDF is written to local FS via `createFsFileStorage("./uploads/soil_analyses")`, passed to the NMI API for extraction, and then the temporary file is implicitly abandoned (no explicit cleanup, no GCS upload). The `soil_analysis` schema in fdm-core has no column to store a file path.

### Existing GCS usage

`fdm-app/app/integrations/gcs.server.ts` already exposes:

- `uploadObject(objectKey, buffer, contentType)`
- `generateSignedReadUrl(objectKey)` — 1-hour signed GET URL
- `generateSignedPutUrl(objectKey, contentType, maxSizeBytes)`
- `objectExists(objectKey)`
- `deleteObject(objectKey)`

The MIME validation + upload handler boilerplate is **duplicated** in both `api.image-upload.ts` and `api.bcs-image.ts`. With profile pictures and PDF storage now added, consolidating into a shared utility is essential to prevent further drift.

---

## Signed URL strategy

Object keys (not signed URLs) are stored in the database. Every loader that needs to serve the file calls `getSignedFileUrl(objectKey)` to produce a fresh signed URL. This avoids storing expiring URLs in the DB and ensures files are always accessible without a background renewal job.

---

## GCS object key scheme

| File type         | Object key pattern                                                |
| ----------------- | ----------------------------------------------------------------- |
| Soil analysis PDF | `soil_analyses/{a_id}.pdf`                                        |
| Soil image        | `soil_image/{nanoid}.{ext}` _(existing, no change)_               |
| User avatar       | `profile_pictures/users/{user_id}.jpg` _(#664)_        |
| Organization logo | `profile_pictures/organizations/{org_id}.jpg` _(#664)_ |

---

## Detailed tasks

### 1. Shared GCS upload utility

**File:** `fdm-app/app/lib/gcs-upload.server.ts` _(new)_

Extract the duplicated boilerplate from `api.image-upload.ts` and `api.bcs-image.ts` into a single shared module. This utility is then used by both existing routes as well as the new soil analysis PDF upload logic.

```ts
/**
 * Reads a file upload field, validates its MIME type against magic bytes,
 * and returns the raw buffer and detected MIME.
 * Throws if the type is not in allowedMimes or exceeds maxSizeBytes.
 */
export async function readAndValidateImageBuffer(
  fileUpload: FileUpload,
  allowedMimes: Set<string>,
): Promise<{ buffer: Buffer; mime: string }>

/**
 * Reads a file upload field, validates that magic bytes confirm application/pdf.
 * Throws if the file is not a valid PDF.
 */
export async function readAndValidatePdfBuffer(fileUpload: FileUpload): Promise<{ buffer: Buffer }>

/**
 * Generates a fresh V4 signed read URL for a GCS object key,
 * or returns null if objectKey is null/undefined.
 */
export async function getSignedFileUrl(objectKey: string | null | undefined): Promise<string | null>

/**
 * Returns a consistently formatted GCS object key.
 * Example: buildObjectKey("soil_analyses", a_id, "pdf") → "soil_analyses/{a_id}.pdf"
 */
export function buildObjectKey(prefix: string, id: string, ext: string): string
```

**Refactor existing routes** to use this utility:

- `api.image-upload.ts` — replace inline MIME validation and upload handler with `readAndValidateImageBuffer`
- `api.bcs-image.ts` — same refactor

### 2. fdm-core schema: add `a_filepath` to `soil_analysis`

**File:** `fdm-core/src/db/schema.ts`

Add a nullable `a_filepath` column to the `soilAnalysis` table:

```ts
a_filepath: text(), // GCS object key of the source PDF, if uploaded
```

Write a Drizzle migration for the new column. The existing `updateSoilAnalysis` function already accepts `Partial<soilAnalysisTypeInsert>`, so no function signature changes are needed — the column becomes available immediately via the existing update path.

### 3. Extend the soil analysis upload action to store the PDF

**File:** `fdm-app/app/routes/farm.$b_id_farm.$calendar.field.$b_id.soil.analysis.new.upload.tsx`  
_(Same route — extend the existing action, no new route)_

After the NMI extraction succeeds and `addSoilAnalysis` returns the new `a_id`:

1. Build the object key: `buildObjectKey("soil_analyses", a_id, "pdf")`
2. Call `uploadObject(objectKey, buffer, "application/pdf")` — reuse the buffer already in memory from the existing upload handler.
3. Call `updateSoilAnalysis(fdm, principal_id, a_id, { a_filepath: objectKey })` to persist the key.

If the GCS upload fails, log the error but do not roll back the soil analysis record — the extracted data is the primary value; the PDF is supplementary.

### 4. Soil analysis detail page — PDF download button

**File:** `fdm-app/app/routes/farm.$b_id_farm.$calendar.atlas_.soil-analysis.$b_id.soil.analysis.$a_id.tsx`

Extend the loader:

```ts
const pdfUrl = await getSignedFileUrl(soilAnalysis.a_filepath ?? null)
return { ..., pdfUrl }
```

Extend the component:

- When `pdfUrl` is set, render a **"Download PDF"** button (or anchor with `target="_blank" rel="noopener"`) below the soil analysis form.
- When `pdfUrl` is null (analysis was entered manually or uploaded before this feature), render nothing — do not show a disabled button.

The button should use an existing UI component (`<Button asChild>` + `<a href={pdfUrl} ...>`).

Also extend the same loader/component for the field-level soil analysis detail page:  
`fdm-app/app/routes/farm.$b_id_farm.$calendar.field.$b_id.soil.analysis.$a_id.tsx`

### 5. Extend the bulk soil analysis upload action to store the PDFs

**File:** `fdm-app/app/routes/farm.$b_id_farm.soil-analysis.bulk.tsx` and `fdm-app/app/routes/api.soil-analysis.extract.ts`

When soil analyses are uploaded in bulk:
1. Read the uploaded PDF files during bulk extraction.
2. For each extracted soil analysis that is successfully created, store the original PDF in GCS with key `soil_analyses/{a_id}.pdf`.
3. Call `updateSoilAnalysis` to update the `a_filepath` field for each.

### 6. Delete PDF when soil analysis is deleted

**File:** `fdm-core/src/soil-analysis.ts` (or corresponding database helper)

When a soil analysis is deleted:
1. Retrieve the existing `a_filepath` for the record.
2. If `a_filepath` is present, call `deleteObject(a_filepath)` from GCS to clean up storage.

---

## Acceptance criteria

- [ ] Uploading a soil analysis PDF via single upload stores the original file in GCS at `soil_analyses/{a_id}.pdf`.
- [ ] Uploading soil analysis PDFs via bulk upload stores each original file in GCS at `soil_analyses/{a_id}.pdf` and updates `a_filepath`.
- [ ] Deleting a soil analysis also deletes its corresponding PDF object from GCS.
- [ ] The soil analysis detail page shows a "Download PDF" button when a PDF is available, linking to a fresh signed URL.
- [ ] No "Download PDF" button appears for analyses without a stored PDF (manual entry or legacy data).
- [ ] `api.image-upload.ts` and `api.bcs-image.ts` are refactored to use `readAndValidateImageBuffer` from the shared utility — no functional change.
- [ ] A GCS upload failure during soil analysis import does not prevent the primary DB operation from completing.
- [ ] TypeScript: `pnpm typecheck` passes in `fdm-app`; `pnpm check-types` passes in `fdm-core`.

---

## Notes

- Signed URLs for PDF downloads are generated fresh on each loader call (same strategy as profile pictures and soil images). No URL is stored in the DB.
