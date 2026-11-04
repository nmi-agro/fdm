---
"@nmi-agro/fdm-storage": minor
---

New package with file storage for FDM: a `FileStorage` interface with an implementation on Google Cloud Storage (`createGcsStorage`) and one in memory for tests (`createMemoryStorage`), and `readAndValidateFileUpload`, which checks the type of an uploaded file from its contents.
