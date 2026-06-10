---
"@nmi-agro/fdm-core": minor
---

Add visual soil analysis (BCS) data model and CRUD functions.

- BCS indicator scores (`a_ss_bcs` … `a_rt_bcs`) added directly to `soil_analysis` table; soil sampling links analysis to field via `b_id_sampling`
- New tables: `soil_image` (stores GCS path, type, order, caption per sampling event) and `soil_image_annotating` (pins, circles, arrows, freehand drawings with optional BCS indicator link)
- Column naming follows FDM conventions: `a_image_path`, `a_image_type`, `a_image_order`, `a_image_caption`; annotation columns `a_image_annotation_type`, `a_image_annotation_coordinates` (jsonb), `a_image_annotation`, `a_image_annotation_bcs`, `a_image_annotation_order`
- New functions: `addSoilImage`, `getSoilImages`, `removeSoilImage`, `addSoilImageAnnotation`, `updateSoilImageAnnotation`, `removeSoilImageAnnotation`
- Authorization: `soil_image` added as a named resource in the chain (farm → field → soil_image via `b_id_sampling`)
- Database migration included (`0030_graceful_hawkeye.sql`)
