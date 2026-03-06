# FDM App (`fdm-app`)

The `fdm-app` is a React application providing a user-friendly interface for visualizing and managing farm data based on the Farm Data Model (FDM) schema. It utilizes `fdm-core` for seamless database interaction and serves as a practical demonstration of FDM's capabilities.  This intuitive interface empowers users to interact with their farm data, gaining valuable insights and streamlining farm management decisions.

> [!IMPORTANT]  
> `fdm-app` is currently in alpha state. It includes features such as interactive data visualization, streamlined data management, user authentication and authorization, and organization management.
> See our [roadmap](https://github.com/nmi-agro/fdm/milestones) for planned milestones.

## Key Features

* **Interactive Data Visualization:**  Visualize farm data, including fields, cultivations, fertilizer applications, and soil analysis results, on an interactive map interface. Explore data spatially and gain a comprehensive overview of your farm operations.
* **Streamlined Data Management:**  Manage farm data efficiently through intuitive forms and workflows. Create, update, and delete records for farms, fields, cultivations, fertilizers, and soil analyses with ease.
* **User Authentication and Authorization:** Securely manage user accounts and access control.  Utilize authentication features to protect sensitive farm data. The authentication includes social log in methods.
* **Integration with FDM Core:**  Seamlessly integrates with `fdm-core` for robust data management and access to the standardized FDM schema. Leverages the power and consistency of `fdm-core` for reliable data handling.
* **Open Source and Customizable:**  As an open-source project, `fdm-app` is highly customizable. Adapt the interface, add new features, and tailor the application to meet specific farm management needs.

## Getting Started

1. **Prerequisites:** Ensure you have a PostgreSQL-compatible database set up and configured with the FDM schema (using `fdm-core`). Refer to the `fdm-core` documentation for database setup instructions.

2. **Installation:**

```bash
   pnpm add @nmi-agro/fdm-app
```

3.  **Configuration:**
    Configure the application by setting environment variables. Create a `.env` file in the `fdm-app` directory by copying the provided `.env.example` file:

    ```bash
    cp .env.example .env
    ```

    Edit the `.env` file and provide values for the necessary variables. Key configuration areas include:
    *   **General:** Application name (`VITE_FDM_NAME`), environment (`NODE_ENV`).
    *   **Session:** A strong secret key (`FDM_SESSION_SECRET`).
    *   **Database:** Connection details for your PostgreSQL database.
    *   **Authentication:** Secrets and URLs for `better-auth` and optionally OAuth providers (Google, Microsoft).
    *   **Map:** Map provider configuration (`PUBLIC_MAP_PROVIDER`) and API key if using MapTiler (`PUBLIC_MAPTILER_API_KEY`).
    *   **Data URLs:** Paths to external data files (`AVAILABLE_FIELDS_URL`).
    *   **Analytics (Optional):** Configuration for Sentry and/or PostHog. These services are disabled by default. To enable them, provide the relevant keys/DSNs as described in `.env.example`.

    Refer to the comments within the `.env.example` file for detailed explanations of each variable and whether it's required. **Never commit your `.env` file to version control.**

4.  **Running the App:**
```bash
    # Development mode
    pnpm dev

    # Production build
    pnpm build
    pnpm start
```    

## Key Functionalities
* **Farm Management:** Create, view, update, and delete farm records, including adding and removing associated fields. Manage farm details and their associated data using the application.
* **Field Management:** Add, edit, and remove fields associated with a farm. Visualize fields on a map, view detailed information about each field, including soil status, and update field properties.
* **Cultivation Management:** Manage cultivations on fields, recording sowing dates and other relevant details. Track the progress of crops and plan future farming activities.
* **Fertilizer Management:** Record fertilizer applications, pick specific fertilizer products for use, and manage fertilizer applications on fields. Track fertilizer usage and optimize application strategies.
* **Soil Analysis Management:** Record and visualize soil analysis results. Track soil health and make informed decisions about fertilization and other management practices

## Contributing
We welcome contributions to enhance the functionality and user experience of `fdm-app`. See the main FDM project documentation for guidelines on contributing code, reporting bugs, and requesting features.

## Made Possible By

FDM is developed by the [Nutriënten Management Instituut](https://www.nmi-agro.nl/) as part of the Horizon Europe projects: [NutriBudget](https://www.nutribudget.eu/) and [PPS BAAT](https://www.handboekbodemenbemesting.nl/nl/handboekbodemenbemesting/pps-baat.htm).


## Contact

Maintainer: @SvenVw
Reviewer: @gerardhros
