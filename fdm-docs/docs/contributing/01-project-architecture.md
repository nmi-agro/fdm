---
title: Project Architecture
sidebar_label: Project Architecture
---

The Farm Data Model (FDM) is a monorepo that is managed with `pnpm` workspaces and `turbo`. This structure allows us to manage multiple packages within a single repository, which simplifies dependency management and improves code sharing.

## Monorepo Structure

The FDM monorepo is organized into the following packages:

- **`fdm-core`**: This package contains the core data model, including the database schema, TypeScript types, and JSON schemas.
- **`fdm-data`**: This package contains the standardized catalogues for crops, fertilizers, and other agricultural inputs.
- **`fdm-calculator`**: This package contains the agronomic calculation engine, which is used to perform calculations such as nitrogen balance and fertilizer recommendations.
- **`fdm-app`**: This package is a reference implementation of a farm management application that is built on top of the FDM.
- **`fdm-docs`**: This package contains the documentation for the FDM project, which is built with Docusaurus.

## `pnpm` Workspaces

`pnpm` workspaces are used to manage the dependencies between the different packages in the monorepo. This allows us to install all the dependencies for all the packages with a single command, and it also ensures that the same version of a dependency is used across all packages.

## `turbo`

`turbo` is a high-performance build system for JavaScript and TypeScript codebases. It is used to orchestrate the build process for the FDM monorepo, and it provides features such as caching and parallel execution to speed up the build process.
