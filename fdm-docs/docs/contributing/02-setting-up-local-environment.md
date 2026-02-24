---
title: Setting up Local Environment
sidebar_label: Setting up Local Environment
---

This guide will walk you through the process of setting up a local development environment for the Farm Data Model (FDM) project.

## Prerequisites

Before you begin, you will need to have the following software installed on your machine:

* **[Node.js](https://nodejs.org/en/download)**: FDM is a TypeScript and JavaScript project, so you will need to have Node.js installed.
* **[`pnpm`](https://pnpm.io/installation)**: FDM uses `pnpm` for package management, so you will need to have it installed.
* **[Git](https://git-scm.com/downloads)**: FDM is hosted on GitHub, so you will need to have Git installed to clone the repository.
* **[Docker](https://docs.docker.com/get-docker/)**: FDM uses Docker to run the necessary services, such as the PostgreSQL database.

## Cloning the Repository

First, you need to clone the FDM repository from GitHub:

```bash
git clone https://github.com/nmi-agro/fdm.git
```

## Installing Dependencies

Next, you need to install the dependencies for all the packages in the monorepo. You can do this by running the following command from the root of the repository:

```bash
pnpm install
```

## Setting up `.env` files

FDM uses `.env` files to manage environment variables. You will need to create a `.env` file in the `fdm-app` package. You can do this by copying the `.env.example` file:

```bash
cp fdm-app/.env.example fdm-app/.env
```

You will then need to fill in the values for the environment variables in the `.env` file.

## Running Necessary Services

FDM requires a PostgreSQL database to be running. The easiest way to do this is to use Docker. You can start the database by running the following command from the root of the repository:

```bash
docker-compose up -d
```

## External Services

The `fdm-calculator` requires the `nmi-api` for Dutch nutrient advices. You can find the documentation for this API at [https://api.nmi-agro.nl/docs](https://api.nmi-agro.nl/docs). You need to have a NMI API key to access this service.

## Running the Application

Once you have completed all the previous steps, you can run the `fdm-app` by running the following command from the root of the repository:

```bash
pnpm --filter fdm-app dev
```

This will start the development server, and you should be able to access the application in your browser at `http://localhost:5173`.
