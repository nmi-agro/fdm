---
title: Quick Start Guide
---

This guide will walk you through the basics of using the Farm Data Model (FDM) in your own applications. We will cover how to install FDM, connect to a database, create a `farm`, add a `field`, and perform a simple `action` like sowing a crop.

## Installation

First, you need to install the FDM packages from `npm`. You will need `fdm-core` for the core data model and `fdm-data` for the standardized catalogues.

```bash
npm install @nmi-agro/fdm-core @nmi-agro/fdm-data
```

## Connecting to a Database

FDM uses a PostgreSQL database to store its data. You will need to have a running PostgreSQL instance and the necessary credentials to connect to it.

Here is an example of how to create a `Drizzle` client and connect to a PostgreSQL database:

```typescript
import { createFdmServer } from '@nmi-agro/fdm-core';

// Ensure your environment variables are set for PostgreSQL connection
const fdm = createFdmServer(
  process.env.DB_HOST,
  Number(process.env.DB_PORT),
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  process.env.DB_NAME,
);

// Define a placeholder principal ID for actions
const principal_id = 'quick-start-user-id';
```

## Creating a Farm

The `farm` is the top-level asset in FDM. It is the container for all other assets and actions.

Here is how you can create a new `farm`:

```typescript
import { addFarm } from '@nmi-agro/fdm-core';

// To create a new farm:
const farmName = 'My Test Farm';
const b_id_farm = await addFarm(
  fdm,
  principal_id,
  farmName,
  '123456', // Dummy business ID
  'Farm Lane 1', // Dummy address
  '1234AB', // Dummy postal code
);
console.log(`Created Farm with ID: ${b_id_farm}`);
```

## Adding a Field

A `field` is the primary spatial asset in FDM. It represents a specific area of land where agricultural activities take place.

Here is how you can add a new `field` to a `farm`:

```typescript
import { addField } from '@nmi-agro/fdm-core';

// To add a new field to the farm:
const fieldName = 'My Test Field';
const fieldGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ],
  ],
}; // Dummy GeoJSON geometry

const b_id_field = await addField(
  fdm,
  principal_id,
  b_id_farm, // Use the farm ID from the previous step
  fieldName,
  'source-1', // Dummy source ID
  fieldGeometry,
  new Date(), // Current date as start date
  'owned', // Acquiring method
);
console.log(`Added Field with ID: ${b_id_field}`);
```

## Sowing a Crop

Sowing is an `action` that creates a new `cultivation` asset on a `field`.

Here is how you can sow a crop on a `field`:

```typescript
import { addCultivation } from '@nmi-agro/fdm-core';
import { cultivationsCatalogue } from '@nmi-agro/fdm-data';

// To sow a crop on a field:
const cropName = 'Wheat'; // Example crop
const sowingDate = new Date(); // Current date as sowing date

const crop = cultivationsCatalogue.find(c => c.b_lu_name === cropName);

if (!crop) {
  throw new Error(`Crop not found: ${cropName}`);
}

const b_lu_cultivation = await addCultivation(
  fdm,
  principal_id,
  crop.b_lu_catalogue,
  b_id_field, // Use the field ID from the previous step
  sowingDate, // b_lu_start
  // b_lu_end, m_cropresidue, b_lu_variety are optional
);
console.log(`Sowed ${cropName} on Field ${b_id_field} with Cultivation ID: ${b_lu_cultivation}`);
```
