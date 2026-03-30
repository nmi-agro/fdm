# FDM: Transforming Farm Data into Actionable Insights

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nmi-agro/fdm)

The Farm Data Model (FDM) is an open-source project designed to empower data-driven decision-making in agriculture.  By providing a standardized, flexible, and extensible schema for organizing and analyzing farm data, FDM enables seamless data integration, analysis, and ultimately, improved farm management practices and lowering environmental impact.

<img src="/fdm-docs/static/img/fdm-high-resolution-logo.png" alt="FDM Logo" height="250px">

## Key Features & Benefits

* **Standardized Schema:** FDM's core strength lies in its robust, well-defined schema.  This structure ensures consistency and interoperability, allowing diverse agricultural data sources to seamlessly integrate and communicate. This structured approach facilitates easier data analysis and exchange between different farm management systems and platforms.
* **Single Source of Truth:**  FDM adheres to the principle of a single source of truth, meaning that each piece of information is stored in only one place within the schema. This eliminates data conflicts and inconsistencies, ensuring data integrity and reliability.
* **Asset-Action Model:** FDM utilizes an intuitive "Asset-Action" model, where "Assets" represent physical or conceptual entities like fields, crops, or equipment, and "Actions" represent operations or events related to these assets, such as sowing, fertilizing, or harvesting. This clear separation provides a granular view of farm activities and their impact.
* **Hierarchical Structure:**  Data is organized hierarchically within the schema, allowing for logical grouping and efficient querying.  This facilitates a deeper understanding of relationships between different data points, enabling more insightful analysis.
* **Extensibility:**  While standardized, FDM is also highly extensible. Users can add custom attributes and actions to cater to specific needs without compromising the overall schema's integrity. This flexibility makes FDM adaptable to the diverse and evolving landscape of modern agriculture.
* **Open-Source Collaboration:**  Developers, agronomists, and other interested individuals are encouraged to contribute, fostering innovation and ensuring the project remains relevant and robust.
* **Data-Driven Decisions:**  Ultimately, FDM empowers farmers and agronomists to make data-driven decisions. By providing a clear framework for data analysis, FDM supports optimized resource allocation, improved crop management strategies, lower environmental impact and enhanced overall farm productivity.

## FDM Ecosystem: A Modular Approach

FDM comprises several interconnected packages, each serving a distinct purpose:

* **`fdm-core`:** The foundation of FDM, providing the core data schema and functions for interacting with it. A TypeScript library designed for seamless integration into various applications. Directly interacts with your database, managing all CRUD operations.

* **`fdm-data`:** Extends `fdm-core` with pre-defined catalogues of data records (fertilizers, cultivations). Users can select from existing catalogues or easily create their own, streamlining data entry and ensuring consistency.

* **`fdm-calculator`**:  This package provides functions to calculate nutrient doses and nitrogen balance at both farm and field levels, offering valuable insights and decision support tools based on the FDM schema.

* **`fdm-agents`**: Provides a framework for strategic decision support using Agentic AI. It combines Large Language Models (LLMs) with the FDM's deterministic calculation engine to assist in making complex farm management decisions, starting with Gerrit, the fertilizer application planner.

* **`fdm-app`**: A React application offering a user-friendly interface for visualizing and managing farm data.  Utilizes `fdm-core` for database interaction and provides a practical demonstration of FDM's capabilities.

* **`fdm-docs`:** Houses the comprehensive documentation for the entire FDM project.

## Running Locally with Docker

The preferred way to run the `fdm-app` locally is using Docker. This ensures a consistent environment and simplifies setup. Here's how you can get started:

**Prerequisites:**

* **Docker Desktop:** Ensure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running on your system.
* **Git:** Ensure you have [Git](https://git-scm.com/downloads) installed on your system. This is needed to clone the repository.

**Steps:**

1. **Clone the Repository:**

    ```bash
    git clone https://github.com/nmi-agro/fdm.git
    cd fdm
    ```

    This will download the entire FDM project to your local machine.

2. **Build the Docker Images:**

    ```bash
    docker compose build
    ```

    This command builds the Docker images defined in the `docker-compose.yml` file. This includes setting up the `fdm-app` and the `postgres` service. This step only needs to be executed once, or after changing a part of the code.

3. **Start the Application:**

    ```bash
    docker compose up -d
    ```

    This command starts the application in detached mode (`-d`), meaning it will run in the background. This will start both the `fdm-app` and the `postgres` service. You can then access the application by browsing to `http://localhost:5173`

4. **Run migrations and sync catalogues**
    The first time the app starts, the migrations will be run. This will only happen once. If the database gets reset, the migrations will be ran again.

5. **Stop the Application:**

    ```bash
    docker compose down
    ```

    This command stops and removes the containers created by `docker compose up`.

**Additional Notes:**

* **Database Persistence:** The `docker-compose.yml` file is configured to persist the PostgreSQL database data in a volume. This means your data will not be lost when you stop and restart the containers. If you want to fully reset the database, also execute `docker compose volume rm postgres_data`
* **Environment Variables:** The application requires several environment variables to be set. These are configured in the `docker-compose.yml` file. If you run the application outside of docker, make sure to set the variables in the `.env` file as well.
* **Accessing the Application:** Once the containers are running, the `fdm-app` will be accessible in your browser at `http://localhost:5173`.
* **Changing Code:** If you change the code, make sure to rebuild the images with `docker compose build`

## Getting Involved

We welcome contributions of all kinds! Whether you're a developer, agronomist, or simply an interested user, you can contribute by:

* **Testing & Providing Feedback:** Your experiences and insights are invaluable. Share your thoughts and suggestions through our GitHub Discussions.
* **Reporting Bugs:** Help us improve by reporting any issues you encounter. Detailed bug reports are greatly appreciated.
* **Requesting Features:**  Have an idea for a new feature?  Submit your requests through GitHub Discussions.
* **Contributing Code & Documentation:**  Join our development efforts by contributing code or improving our documentation.

## Made Possible By

FDM is developed by the [Nutriënten Management Instituut](https://www.nmi-agro.nl/) as part of the Horizon Europe projects: [NutriBudget](https://www.nutribudget.eu/) and [PPS BAAT](https://www.handboekbodemenbemesting.nl/nl/handboekbodemenbemesting/pps-baat.htm).

<img src="https://www.nutribudget.eu/wp-content/themes/nutribudget/images/logo-nutribudget.png" alt="NutriBudget Logo" height="250px">
<img src="https://www.beterbodembeheer.nl/wp-content/uploads/2024/01/pps-baat-projectlogo.png" alt="PPS BAAT Logo" height="250px">
<img src="https://ec.europa.eu/regional_policy/images/information-sources/logo-download-center/eu_funded_en.jpg" alt="EU Logo" height="300px">
<img src="https://media.licdn.com/dms/image/C560BAQEYGcm4HjNnxA/company-logo_200_200/0?e=2159024400&v=beta&t=u40rJ7bixPWB2SAqaj3KCKzJRoKcqf0wUXCdmsTDQvw" alt="NMI Logo" height="250px">

## Contact

Maintainer: @SvenVw
Reviewer: @gerardhros
