---
title: Overview
---

The `fdm-calculator` includes functionality to validate agronomic data against regional norms for fertilizer application. This capability supports nutrient management by comparing planned or actual applications against specific regulatory limits.

## Relevance and Data Usage

Calculating norms within FDM utilizes data that is already recorded for other insights, such as field details, crop types, and fertilizer applications. This approach avoids the need for double data entry and allows farmers to view compliance status alongside other agronomic indicators.

Providing these insights is relevant for farmers who need to adhere to environmental regulations to ensure sustainable practices and meet legal requirements.

## System Structure and Extensibility

The norm calculation system in `fdm-calculator` is designed to be extensible across different regions and timeframes. The internal architecture organizes logic by:

- **Region:** Supporting different countries or regulatory zones (e.g., `NL` for Netherlands).
- **Year:** Allowing for annual updates to regulations (e.g., `2025`, `2026`, `2027`).

This structure enables the addition of new regional rule sets or the updating of existing ones as regulations evolve, without disrupting previous implementations.

The logic of a rule lives in the earliest year it applies to. A later year with exactly the same rules uses the functions of that year instead of a copy: the functions read the norm year from their input (for example the main crop period and the reduction windows of that year), and the factories bind the input collectors to the requested year. A year gets its own functions only when a regulation or RVO table changes something, and then only for what changes. Each year keeps its own tests, so the results for that year stay covered when the shared functions change.

## Current Implementation: Netherlands 2025, 2026 and 2027

The current implementation in `fdm-calculator` covers the Dutch nutrient management regulations for **2025**, **2026** and, provisionally, **2027**. The supported years are exported as `NORMS_YEARS`.

### 2025

- **[Nitrogen Usage Norm (`Stikstofgebruiksnorm`)](./nl/2025/stikstofgebruiksnorm.md):** Calculates the maximum total effective nitrogen (in kg N/ha) allowed. The calculation considers factors such as the main crop, geographical location (including `NV-gebieden`), and soil region.
- **[Phosphate Usage Norm (`Fosfaatgebruiksnorm`)](./nl/2025/fosfaatgebruiksnorm.md):** Determines the maximum amount of phosphate (in kg P₂O₅ per hectare) allowed. This limit is based on the land use type (grassland or arable land) and the phosphate status of the soil.
- **[Animal Manure Usage Norm (`Dierlijke Mest Gebruiksnorm`)](./nl/2025/dierlijke-mest-gebruiksnorm.md):** Specifies the maximum nitrogen from animal manure (in kg N/ha) permitted. The limit depends on the farm's derogation status and the field's location.

### 2026

- **[Nitrogen Usage Norm (`Stikstofgebruiksnorm`)](./nl/2026/stikstofgebruiksnorm.md):** As in 2025, but no longer dependent on derogation status.
- **[Phosphate Usage Norm (`Fosfaatgebruiksnorm`)](./nl/2026/fosfaatgebruiksnorm.md):** Unchanged from 2025.
- **[Animal Manure Usage Norm (`Dierlijke Mest Gebruiksnorm`)](./nl/2026/dierlijke-mest-gebruiksnorm.md):** A flat 170 kg N/ha, because derogation was phased out after 2025.
- **[Renure Usage Norm (`Renure Gebruiksnorm`)](./nl/2026/renure-gebruiksnorm.md):** New in 2026. Renure products have their own ceiling of 80 kg N/ha on top of the animal manure norm.

### 2027 (provisional)

- **[2027 overview](./nl/2027/01-index.md):** Uses the 2026 rules (the same four norms, values and rules), until the official 2027 tables are published.

For detailed logic and specific parameters of these norms, refer to their respective pages.

## Customization

The `fdm-calculator` can be extended to support additional norms. The system's modular design allows for the integration of custom configuration files or new logic modules to meet specific regional requirements or certification schemes.
