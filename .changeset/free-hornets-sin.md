---
"@svenvw/fdm-calculator": patch
---

Fix: isFieldInGWGBGebied, isFieldInNatura2000Gebied, and isFieldInDerogatieVrijeZone now return false instead of throwing an error when a centroid coordinate lies outside the GeoTIFF bounding box (null value)
