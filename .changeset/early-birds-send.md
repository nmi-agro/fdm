---
"@nmi-agro/fdm-calculator": minor
---

Add grazing derivation engine with constants from the _Handboek Melkveehouderij_, computing distinct weidedagen, max daily weide-uren, pooled Weidemelk 120x6 compliance, beweidingsplatform, stocking densities, rest periods, and overgrazing alerts. The beweidingsplatform uses the grazed area per field (`b_area_grazed`), so successive grazing strips on a field add up. Rest periods are counted per part of a field (`calculateRestBeforeUses`), so successive strips are not flagged as overgrazing; the rest threshold is 21 days (Handboek table 3.8).

Add grazing allocation rules: `calculateGrazingAllocationArea` (area to allocate to a herd for a strip or plot, with the grass on offer at in-grazing plus the regrowth during grazing), `estimateGrassIntake` (grass intake and supplementation from the grass growth on the platform, following Nieuw Nederlands Weiden) and `calculatePlatformArea`, with reference values for grass growth, regrowth during grazing, sward heights and grazing hours. The grazing systems include Nieuw Nederlands Weiden: a new whole field every day. Values that are not stated in the cited sources are documented as assumptions.
