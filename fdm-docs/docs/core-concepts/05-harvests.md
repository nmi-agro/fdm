---
title: Harvests
---

Harvesting is a critical event in the cultivation cycle. In the Farm Data Model (FDM), the harvest is not just a single data point but a detailed data structure that captures the nuances of different crops and their specific measurements. This detailed approach allows for accurate agronomic calculations, such as nutrient balances and yield comparisons.

## The Harvest Data Model

In FDM, a harvest is intrinsically linked to a **cultivation**. A single cultivation can have multiple harvest events, especially for crops like grass that are cut multiple times a season. The core data structure for a harvest involves several related entities:

- `cultivation_harvesting`: This table links a harvest event to a specific cultivation (`b_lu`) and records the `b_lu_harvest_date`.
- `harvestables`: Each harvest event can produce one or more "harvestables", and "harvestable" can be linked to multiple harvest events. For example, a potato harvestable might be linked to multiple fields, but collected in the same batch. Note that while the database schema supports it, due to the complexity fdm-core functions currently only support 1:1 relations between harvests and harvestables.
- `harvestable_analyses`: For each harvestable, one or more analyses can be recorded. This is where the specific measurements for the harvest are stored.

This structure provides a flexible and detailed representation of harvest events, accommodating a wide range of crops and harvesting practices.

## Variable Harvest Parameters

A key challenge in modeling harvests is the diversity of parameters measured for different crops. What is relevant for a silage maize grower is different from what a potato farmer measures. For example:

- For **silage maize**, a farmer might record the fresh weight yield (`b_lu_yield_fresh`) and the dry matter percentage (`b_lu_dm`).
- For **potatoes**, the gross yield (`b_lu_yield_bruto`), tare percentage (`b_lu_tarra`), and underwater weight (`b_lu_uww`) are common parameters.
- For **cereals**, fresh weight yield (`b_lu_yield_fresh`), moisture content (`b_lu_moist`), and crude protein (`b_lu_cp`) are often measured.

FDM is designed to store these crop-specific parameters as they are measured in the field, ensuring that the raw data is preserved.

## Standardization using Harvest Categories

While storing crop-specific parameters is essential for data fidelity, many agronomic calculations require standardized values. The two most important standardized parameters in FDM are:

- `b_lu_yield`: The dry matter yield in kilograms per hectare (kg DM/ha).
- `b_lu_n_harvestable`: The nitrogen content of the harvested product in grams of nitrogen per kilogram of dry matter (g N/kg DM).

To bridge the gap between the various measured parameters and these standardized values, FDM uses a system of **Harvest Categories** (`b_lu_harvestcat`). Each cultivation in the FDM catalogue is assigned to a harvest category. This category determines which parameters are expected at harvest and, crucially, defines the formulas used to calculate the standardized `b_lu_yield` and `b_lu_n_harvestable`.

### Example of Harvest Categories and Formulas

Here are a few examples of how harvest categories are used to standardize harvest data:

- **HC020 (Grassland)**:
  - **Measured parameters**: `b_lu_yield` (already in kg DM/ha) and `b_lu_cp` (crude protein in g/kg DM).
  - **Formulas**:
    - `b_lu_yield` is used directly.
    - `b_lu_n_harvestable` is calculated from crude protein: `b_lu_n_harvestable = b_lu_cp / 6.25`.

- **HC042 (Potatoes)**:
  - **Measured parameters**: `b_lu_yield_bruto` (kg/ha), `b_lu_tarra` (%), and `b_lu_uww` (g/5kg). `b_lu_n_harvestable` is often a default value for the crop.
  - **Formulas**:
    - First, dry matter content (`b_lu_dm`) is calculated from underwater weight: `b_lu_dm = (b_lu_uww * 0.049 + 2.0) * 10`.
    - Then, fresh yield is calculated: `b_lu_yield_fresh = b_lu_yield_bruto * (1 - b_lu_tarra / 100)`.
    - Finally, dry matter yield is calculated: `b_lu_yield = b_lu_yield_fresh * b_lu_dm / 1000`.

- **HC050 (Cereals)**:
  - **Measured parameters**: `b_lu_yield_fresh` (kg/ha), `b_lu_moist` (%), and `b_lu_cp` (g/kg DM).
  - **Formulas**:
    - Dry matter content is calculated from moisture: `b_lu_dm = (100 - b_lu_moist) * 10`.
    - Dry matter yield is calculated: `b_lu_yield = b_lu_yield_fresh * b_lu_dm / 1000`.
    - Nitrogen content is calculated from crude protein (using a specific factor for cereals): `b_lu_n_harvestable = b_lu_cp / 5.7`.

### Practical Implications

This two-step approach of storing raw data and standardizing it through harvest categories offers several advantages:

- **Data Integrity**: The original, measured data is never lost.
- **Flexibility**: The system can easily be extended to support new crops or measurement techniques by adding new harvest categories.
- **Comparability**: By converting all harvest data to a standardized format, it becomes possible to compare yields and nutrient removal across different crops and farms.
- **Agronomic Accuracy**: Standardized data is essential for accurate nutrient management, as it allows for precise calculation of nutrient offtake in the harvested biomass.
