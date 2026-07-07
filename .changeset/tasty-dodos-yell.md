---
"@nmi-agro/fdm-app": minor
"@nmi-agro/fdm-core": minor
---

Uploaded soil analysis PDFs are now stored in the GCS bucket, and the a_fileavailable flag in a soil analysis is set. With this, the user is able to later download the PDF. If the user deletes the soil analysis later, its saved PDF is deleted from the GCS bucket alongside it.
