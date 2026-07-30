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
- **`b_sampling_geometry`**: The geographic coordinates where the sample was taken, stored as a GeoJSON `MultiPoint`.

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
