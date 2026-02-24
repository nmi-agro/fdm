# Farm Data Model Core (`fdm-core`)

> [!WARNING]  
> Until version v1.0.0, no schema migrations are provided, and the database schema may break between updates.  **Back up your data before upgrading.**

The `fdm-core` package is the heart of the Farm Data Model (FDM) project. It provides the core data schema and essential functions for interacting with it.  This TypeScript library seamlessly integrates into various applications, offering a robust and standardized way to manage and analyze farm data.  `fdm-core` interacts directly with your PostgreSQL-compatible database, handling all CRUD (Create, Read, Update, Delete) operations.

## Key Features

* **Standardized Schema:**  `fdm-core` implements the FDM schema, ensuring data consistency and interoperability across different agricultural systems. This structured approach facilitates easier data analysis and exchange.
* **Asset-Action Model:**  The schema follows an intuitive Asset-Action model, clearly separating farm entities (Assets like fields, crops, equipment) from operations performed on them (Actions like planting, fertilizing, harvesting).
* **Hierarchical Structure:** Data is organized hierarchically, enabling logical grouping and efficient querying. This facilitates deeper analysis and understanding of relationships between different data points.
* **TypeScript Support:**  Built with TypeScript, `fdm-core` offers type safety and improved developer experience, reducing errors and enhancing code maintainability.
* **Direct Database Interaction:**  The library interacts directly with your PostgreSQL database, managing all CRUD operations efficiently.
* **Open Source & Extensible:** As an open-source project, `fdm-core` welcomes community contributions.  While standardized, the schema can be extended to accommodate specific needs without compromising its integrity.

## Getting Started

1. **Installation:**
   ```bash
   pnpm add @nmi-agro/fdm-core
   ```
2. **Database Setup:** `fdm-core` utilizes [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) and requires a PostgreSQL-compatible database. Configure your database connection details (URL, authentication) using environment variables as described in the documentation.

3. **Integration:** Import `fdm-core` into your application and use the provided functions to interact with the FDM schema. See the documentation for detailed usage examples.

## Key Functionalities
`fdm-core` provides a range of functions for managing various aspects of farm data:

* **Farm Management:** Create, update, retrieve, and delete farm records.
* **Field Management:** Handle field data, including geometry and linking to farms.
* **Cultivation Management:** Manage cultivation catalogues and track sowing events.
* **Fertilizer Management:** Interact with fertilizer catalogues, track acquisition, picking, and application.
* **Soil Analysis Management:** Record and retrieve soil analysis results and sampling details.

## Contributing
Contributions are welcome! See the main FDM project documentation for guidelines on contributing code, reporting bugs, and requesting features.

## Made Possible By
FDM is developed by the [Nutriënten Management Instituut](https://www.nmi-agro.nl/) as part of the Horizon Europe projects: [NutriBudget](https://www.nutribudget.eu/) and [PPS BAAT](https://www.handboekbodemenbemesting.nl/nl/handboekbodemenbemesting/pps-baat.htm).

## Contact
Maintainer: @SvenVw
Reviewer: @gerardhros