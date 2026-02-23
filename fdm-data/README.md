# FDM Data (`fdm-data`)

The `fdm-data` package extends the Farm Data Model (FDM) core functionality by providing predefined catalogues of data records, such as fertilizers and cultivations. This streamlines data entry and ensures consistency by allowing users to select from existing catalogues or easily create their own by submitting a PR to this package.

## Key Features

*   **Predefined Catalogues:** `fdm-data` includes ready-to-use catalogues for common agricultural data, such as fertilizers and cultivations, saving time and effort in data entry.
*   **Simplified Data Entry:** Using predefined catalogues simplifies data entry and reduces errors by providing standardized options for common data points.  This contributes to cleaner and more reliable data.
*   **Data Consistency:** Catalogues enforce consistent terminology and data structures, improving data quality and facilitating analysis.
*   **TypeScript Support:** Built with TypeScript, providing type safety and improved developer experience.
*   **ES Module:** This package is build as an ES module.

## Getting Started

1.  **Installation:**

    ```bash
    pnpm add @nmi-agro/fdm-data
    ```

2.  **Integration:** Import `fdm-data` into your application along with `fdm-core`. The catalogues are designed to work directly with the core FDM schema. See the usage examples below.

## Usage

### Fertilizers

```typescript
import { getFertilizersCatalogue } from "@nmi-agro/fdm-data";

// Get the BAAT fertilizer catalogue
const baatCatalogue = getFertilizersCatalogue("baat");

// Now you can use the baatCatalogue data
console.log(baatCatalogue[0]) // Logs the first entry of the baat fertilizer catalogue
