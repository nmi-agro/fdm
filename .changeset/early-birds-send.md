---
"@nmi-agro/fdm-calculator": minor
---

Add grazing derivation engine with _Handboek Melkveehouderij_ standard constants and benchmarks, computing distinct weidedagen, max daily weide-uren, pooled Weidemelk 120x6 compliance, beweidingsplatform, stocking densities, rest periods, and overgrazing alerts. The beweidingsplatform uses the grazed area per field (`b_area_grazed`), so successive grazing strips on a field add up.

Add grazing allocation rules: `calculateGrazingAllocationArea` (area to allocate to a herd for a strip or plot), `estimateGrassIntake` (grass intake and supplementation from the grass growth on the platform, following Nieuw Nederlands Weiden) and `calculatePlatformArea`, with reference values for grass growth, sward heights and grazing hours.
