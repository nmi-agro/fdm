# @nmi-agro/fdm-storage

File storage for the Farm Data Model (FDM).

- `FileStorage`: a small interface to upload, download, move and delete files by object key.
- `createGcsStorage()`: an implementation on Google Cloud Storage.
- `createMemoryStorage()`: an in-memory implementation for tests and local development.
- `readAndValidateFileUpload()`: reads an uploaded file and checks its type from its contents (magic bytes), not from the file name or the declared content type.

FDM stores only the object key of a file (for example `soil_analysis/{a_id}.pdf`) in the database. The file itself lives in the storage backend.

## Google Cloud Storage configuration

| Variable                    | Description                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `GCS_BUCKET_NAME`           | Bucket that holds the files. Storage is disabled when it is not set.                  |
| `GCS_SERVICE_ACCOUNT_EMAIL` | Optional. Service account to sign URLs as (needed with Workload Identity Federation). |
| `GCS_SERVICE_ACCOUNT_KEY`   | Optional fallback. Base64-encoded JSON key. Prefer Application Default Credentials.   |
