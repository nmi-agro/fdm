---
title: Introduction to FDM App
sidebar_label: Introduction
---

The `fdm-app` is a practical, working example of an application that is built with the Farm Data Model (FDM). It serves as a reference implementation and a showcase of the capabilities of the FDM.

## Features

The `fdm-app` includes the following features:

- **Farm Data Visualization:** You can view your farm data on a map, including field polygon and with tables for your rotation.
- **Action Logging:** You can log the actions that take place on your farm, such as sowing, fertilizing, and harvesting.
- **Data Analysis:** You can use the `fdm-app` to analyze your farm data and gain insights into your nutrient management.

## User Manual

The `fdm-app` ships a public, Dutch user manual at `/manual`. It explains how to use the app and, under `/manual/background`, what the agronomic results mean (nitrogen balance, organic matter balance, application standards, nutrient advice, soil quality and mineralisation). It can be read without signing in, and pages in the app link to it with a "?" button.

The content is Markdown in `fdm-app/app/content/manual`, one file per chapter, with an author guide in its `README.md`. Each chapter lists the app routes it describes. Tests check that every **bold** label in the manual still exists in the app, and CI warns when a pull request changes a described route without its chapter. The product name is filled in per deployment, so a fork with its own name gets a matching manual.

## Technical Stack

The `fdm-app` is built with a technical stack that provides specific functionalities and benefits:

- **Frontend Framework:**
  - **React 19:** A JavaScript library for building user interfaces.
  - **React Router 8 (formerly Remix):** Manages both frontend routing and backend data operations, contributing to a cohesive development experience.
  - **Vite:** A build tool that provides fast server starts and Hot Module Replacement (HMR) for development.

- **UI & Styling:**
  - **Tailwind CSS 4:** A utility-first CSS framework for building custom designs.
  - **shadcn/ui (Radix UI):** A collection of re-usable components built on Radix UI primitives and styled with Tailwind CSS, supporting accessibility and modularity.
  - **Framer Motion:** A motion library for React that supports animations and gestures in the UI.
  - **Lucide React:** An icon library that integrates with React applications.
  - **Sonner:** A toast component for displaying notifications and messages to the user.

- **Backend & Data Management:**
  - **PostgreSQL:** An open-source relational database system.
  - **Drizzle ORM:** A TypeScript ORM for interacting with the database in a type-safe way.
  - **@nmi-agro/fdm-core:** The core Farm Data Model library, providing business logic and data interaction capabilities.
  - **@nmi-agro/fdm-data:** Standardized agricultural catalogues for consistent data entry and reference.
  - **@nmi-agro/fdm-calculator:** A library for performing agronomic calculations.

- **Authentication & Authorization:**
  - **Better Auth:** A library for user authentication and session management.
  - **@nmi-agro/fdm-core (Authorization module):** Manages role-based access control (RBAC) for various FDM resources.

- **GIS & Mapping:**
  - **MapLibre GL JS & React Map GL:** For interactive maps and geospatial data visualization.
  - **Turf.js:** A geospatial library for spatial analysis operations.
  - **Proj4:** A JavaScript library for coordinate transformation.
  - **Flatgeobuf:** An open format for publishing and consuming geospatial data.

- **Error Tracking & Analytics:**
  - **Sentry:** For error tracking and performance monitoring.
  - **PostHog:** For product analytics.

This combination of technologies supports a functional environment for building agricultural applications.

## A Working Application

The `fdm-app` is not just a demo, it is a working application that can be used as inspiration for your own farm management solutions. You can use it as a starting point for your own projects, or you can contribute to its development to help make it even better.
