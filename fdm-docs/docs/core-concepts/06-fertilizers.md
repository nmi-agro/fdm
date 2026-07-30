---
title: Fertilizers
---

Fertilizer management is a critical aspect of modern agriculture, and the Farm Data Model (FDM) provides a comprehensive way to track and manage fertilizer applications.

## Defining and Applying Fertilizers

In FDM, there are two main ways to work with fertilizers:

1. **Using Pre-defined Fertilizers from a Catalogue:** FDM includes a `fertilizersCatalogue` that contains a standardized list of common fertilizers. This catalogue provides information about each fertilizer, including its nutrient content, density, and application methods. When you use a fertilizer from the catalogue, you create a `fertilizerPicking` record to link your specific fertilizer instance to the catalogue entry.
2. **Defining Custom Fertilizers:** If a fertilizer is not in the catalogue, you can define a custom one by creating a new entry in the `fertilizers` table. Storing specific nutrient analysis for custom fertilizers is a planned feature and not yet implemented. This is particularly useful for manure and other organic fertilizers, which can have highly variable nutrient content.

When you apply a fertilizer to a `Field`, you create a fertilizer application action. This action is stored in the `fertilizerApplication` table and records:

- **`p_app_id`**: A unique identifier for the application event.
- **`b_id`**: The ID of the `Field` where the fertilizer was applied.
- **`p_id`**: The ID of the specific fertilizer instance that was used.
- **`p_app_amount`**: The amount of fertilizer that was applied (typically in kg/ha).
- **`p_app_method`**: The method of application (e.g., broadcasting, injection).
- **`p_app_date`**: The date of the application.

## The `fertilizersCatalogue`

The `fertilizersCatalogue` is a key component of the FDM. It provides a structured way to represent fertilizers, which has several benefits:

- **Data Consistency:** Using a standardized list of fertilizers helps ensure that data is consistent and comparable across different farms and applications.
- **Reduced Data Entry:** By pre-defining common fertilizers, the need for manual data entry is reduced.
- **Facilitates Calculations:** The `fertilizersCatalogue` provides data useful for agronomic calculations, such as nutrient balance and fertilizer recommendations. Each entry in the catalogue contains a detailed breakdown of the fertilizer's composition, including its content of macro and micronutrients.
