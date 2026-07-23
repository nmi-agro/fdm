---
title: Farms
---

The `Farm` asset is the top-level container for all other assets and actions in the Farm Data Model (FDM). It represents a single farming business or enterprise and is the primary unit within the system.

## Properties

A `Farm` has the following properties, which are stored in the `farms` table:

- **`b_id_farm`**: A unique identifier for the farm. This is the primary key for the `farms` table.
- **`b_name_farm`**: The name of the farm.
- **`b_businessid_farm`**: The business ID associated with the farm (e.g., a Chamber of Commerce number).
- **`b_address_farm`**: The physical address of the farm.
- **`b_postalcode_farm`**: The postal code of the farm address.

## Users and Roles

Users are associated with a `Farm` through the `fdm-authz` schema. The `role` table links a `principal_id` (the user) to a `resource_id` (the `b_id_farm`). This allows you to control who has access to the farm's data and what actions they can perform.

For a detailed explanation of the authorization system, please see the [Authorization](./10-authorization.md) page.

## Farm-Related Data

In addition to the basic properties, a `Farm` can have several other types of data associated with it:

- **Organic Certifications:** You can store information about a farm's organic certifications in the `organicCertifications` and `organicCertificationsHolding` tables. This includes details like the certification body, certification numbers (e.g., TRACES, Skal), and the dates the certification was issued and expires.
- **Derogations:** The `derogations` and `derogationApplying` tables are used to track any special permissions (derogations) that a farm has been granted for a specific year. These are related to legal norms for fertilizer application.
- **Grazing Intentions:** The `intendingGrazing` table allows you to record a farm's intention to graze animals for a specific year. This is a boolean flag associated with the farm and the year.
- **Catalogue Preferences:** The `fertilizerCatalogueEnabling` and `cultivationCatalogueSelecting` tables allow you to specify which data sources a farm uses for its fertilizer and cultivation catalogues. This provides flexibility in managing standardized data.
