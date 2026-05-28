---
"@nmi-agro/fdm-core": minor
---

Add visual soil analysis (BCS) data model and CRUD functions.

- New tables: `soil_sampling_visual`, `soil_analysis_visual`, `soil_analysis_visual_image`, `soil_analysis_visual_annotation` with full cascade-delete behaviour
- New functions: `addVisualSoilAnalysis`, `getVisualSoilAnalysis`, `getVisualSoilAnalyses`, `updateVisualSoilAnalysis`, `removeVisualSoilAnalysis`, `addVisualSoilImage`, `removeVisualSoilImage`, `addImageAnnotation`, `updateImageAnnotation`, `removeImageAnnotation`
- Authorization: the creator of a visual assessment automatically becomes its owner (write access). All other farm members — including advisors — receive read-only access to that assessment
- `soil_analysis_visual` added as a named resource in the authorization chain (farm → field → soil_analysis_visual)
- Database migration included (`0030_powerful_hemingway.sql`)
