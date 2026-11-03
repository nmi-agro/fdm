---
title: Soil Analyses
---

Soil analysis is a fundamental practice in agriculture, providing valuable insights into the health and fertility of the soil. The Farm Data Model (FDM) provides a structured way to store and manage soil analysis data.

## Structure of Soil Sample Data

In FDM, soil analysis data is linked to a specific `Field`. A `soilSampling` action is created to record the details of the sampling event. This is stored in the `soilSampling` table, which includes:

- **`b_id_sampling`**: A unique identifier for the sampling event.
- **`b_id`**: The ID of the `Field` where the sample was taken.
- **`a_id`**: The ID of the corresponding `soilAnalysis` record.
- **`b_sampling_date`**: The date when the soil sample was taken.
- **`a_depth_upper` and `a_depth_lower`**: The upper and lower depths of the soil sample.
- **`b_sampling_geometry`**: The locations of the subsamples, stored as a GeoJSON `MultiPoint` (WGS84).
- **`b_sampling_geometry_zone`**: The area the analysis represents, stored as a GeoJSON `MultiPolygon` (WGS84). It is `null` when the analysis represents the whole field, which is the case for manually entered analyses and older data.

Both geometries are optional. `addSoilAnalysis` and `updateSoilAnalysis` accept them next to the soil parameters; a `Polygon` zone is converted to a `MultiPolygon`, and other geometry types are rejected.

The results of the soil analysis are stored in the `soilAnalysis` table. This table includes a wide range of parameters, such as:

- **`a_id`**: A unique identifier for the analysis record.
- **`a_date`**: The date the analysis was performed.
- **`a_source`**: The laboratory that performed the analysis.
- **`a_ph_cc`**: The pH of the soil.
- **`a_som_loi`**: The organic matter content of the soil.
- **Nutrient Levels:** A comprehensive set of columns for the levels of key nutrients, such as nitrogen (N), phosphorus (P), and potassium (K), as well as micronutrients.
- **`b_gwl_class`**: The groundwater level classification.
- **`b_soiltype_agr`**: The agricultural soil type.

## Linking to Fields

Each `soilAnalysis` record is linked to a `soilSampling` record, which in turn is linked to a `Field`. This creates a clear and traceable link between the soil analysis results and the specific location where the sample was taken.

This allows you to track changes in soil health over time, identify areas of nutrient deficiency or excess, and make more informed decisions about fertilizer and amendment applications.

## Current soil data and sampling zones

Large fields are often sampled per zone, and the zones are not always sampled on the same date. `getCurrentSoilData` and `getCurrentSoilDataForFarm` therefore derive the current value of each soil parameter per parameter, as follows:

1. The most recent analysis with a value for the parameter decides.
2. If that analysis has no sampling zone, it represents the whole field and its value is used.
3. If it has a sampling zone, only zone analyses are combined: the zone analyses sampled at most one calendar month before it. Older analyses, including older whole-field analyses, are ignored for this parameter. Each zone is clipped to the field boundary.
4. Within one zone the most recent value is used. An older zone that lies for at least 90% within a newer zone is replaced by it, and where zones partly overlap, the newer zone takes the overlapping area.
5. Across zones, numeric parameters take the mean weighted by area, and categorical parameters (`b_soiltype_agr`, `b_gwl_class`) take the value with the largest area. The weights are normalised over the area that has a value.

Because the rules apply per parameter, a newer analysis only replaces the parameters it contains. For example, a newer whole-field analysis with only Nmin replaces `a_nmin_cc`, but leaves the zone values for P, K and organic matter in place.

Each item of the result shows how its value came about:

- **`sources`**: the contributing analyses, newest first, with their `a_id`, `a_source`, `b_sampling_date`, depths, value and `area_fraction`.
- **`is_aggregated`**: `true` when the value combines several zones.
- **`coverage`**: the share of the field that the sources represent (0–1).
- **`has_coverage_warning`**: `true` when the zones cover less than 95% of the field. The value is then still returned, but it only applies to the sampled part.

For fields without sampling zones, every item has exactly one source and the values are the same as the most recent value per parameter.

`getCurrentSoilDataPerZone` returns the same result split per zone, with the zone geometry clipped to the field, its area in hectares and the analyses that belong to it. Analyses whose zones overlap for at least 90% (intersection over union) form one zone; analyses without a zone form the whole-field zone.
