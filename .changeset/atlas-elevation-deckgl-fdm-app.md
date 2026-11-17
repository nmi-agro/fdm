---
"@nmi-agro/fdm-app": minor
---

The Atlas "Hoogtekaart" now draws the AHN4 elevation with deck.gl-raster instead of a forked COG protocol. The colour scale follows the 2nd to 98th percentile of the elevation in view, so small height differences within a field stand out. The hover value no longer sends a request, and the field outlines are white dotted, as in the other thematic atlas layers.
