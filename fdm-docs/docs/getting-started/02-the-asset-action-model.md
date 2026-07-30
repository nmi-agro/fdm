---
title: The Asset-Action Model
---

The Asset-Action model serves as the architectural foundation for the Farm Data Model (FDM). It provides a framework for organizing agricultural data by separating physical or conceptual entities from the events that affect them. This structure is designed to bring clarity to farm data and enable detailed analysis.

## Core Concepts

The model is built around two fundamental concepts:

### Assets

**Assets** represent the entities within a farm operation. They are the objects that have value or play a significant role in the system. In FDM, key assets include:

- **Farms:** The top-level container for all other assets.
- **Fields:** The primary spatial asset, representing a specific area of land.
- **Cultivations:** An instance of a crop being grown on a field.
- **Fertilizers:** A specific batch or acquisition of a fertilizer product.
- **Soil Samples:** A physical sample of soil taken from a field.

### Actions

**Actions** represent the operations or events that affect assets. These capture the dynamic processes that shape the state of farm assets. Common actions include:

- **Sowing:** Planting a crop, which creates a new `cultivation` asset.
- **Fertilizing:** Applying fertilizer to a field, which modifies the `field` or `cultivation` state.
- **Harvesting:** Gathering a crop, which modifies the `cultivation` asset.
- **Soil Sampling:** Taking a soil sample, which creates a new `soil sample` asset.

## Design Philosophy

The Asset-Action model aligns with agricultural operations by distinguishing between the object being managed and the activity performed upon it.

For example, rather than recording a single abstract metric like "effective nitrogen dose," the model records the specific components:

1. The **Asset** (the field).
2. The **Action** (the application of fertilizer), including the specific type, amount, and date.

This separation allows for more nuanced analysis. An agronomist can calculate nitrogen use efficiency by aggregating all application actions for a specific field asset over a growing season, rather than relying on pre-aggregated or simplified data points.

## Key Characteristics

The structure of the Asset-Action model supports various data requirements:

- **Granularity:** Actions can be defined with varying levels of detail, from broad categories (e.g., "planting") to specific instances containing detailed parameters (e.g., specific hybrid variety and seeding rate).
- **Relationships:** The model captures relationships between entities and events. A single asset can be the subject of multiple actions over time (e.g., a field undergoes plowing, sowing, and harvesting). Conversely, a single action can involve multiple assets.
- **Temporal Tracking:** Actions are associated with timestamps. This allows the system to track changes in assets over time, providing a historical view of farm operations.
- **Extensibility:** Both assets and actions can include custom attributes to capture specific data relevant to the operation, such as geometry for fields or application methods for fertilizer actions.

## Practical Implementation

The Asset-Action Model creates a traceable history of all farm activities. Each action is linked to a specific asset, and the sequence of actions on an asset tells the story of that asset over time.

For example, the history of a `field` asset might look like this:

1. **Create Field:** The `field` asset is created with its initial geometry and properties.
2. **Sow Crop:** A `sowing` action is performed on the `field`, creating a new `cultivation` asset.
3. **Apply Fertilizer:** A `fertilizing` action is performed on the `field`, adding nutrients to the soil.
4. **Harvest Crop:** A `harvesting` action is performed on the `field`, gathering the crop and ending the `cultivation`.

This creates a complete and auditable record of activities on the farm, which is essential for traceability and compliance.
