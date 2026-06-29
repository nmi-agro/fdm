## Background

Currently, the `@nmi-agro/fdm` monorepo uses [Biome](https://biomejs.dev/) for both linting and formatting. We are evaluating a migration to the [Oxc toolchain](https://oxc.rs/)—specifically `oxlint` for linting and `oxfmt` for formatting—to unify our tooling across projects.

The goal is to adopt the exact same linting and formatting configuration currently used in the [`SvenVw/rvo-connector`](https://github.com/SvenVw/rvo-connector) repository.

## Current State

- **Formatter/Linter:** Biome (`@biomejs/biome`)
- **Config File:** `biome.json` at the root
- **Editor Integration:** `.vscode/settings.json` configures `biomejs.biome` as the default formatter for TypeScript, JavaScript, and JSON.
- **Scripts:** The root `package.json` contains:
  - `format-and-lint`: `biome check .`
  - `format-and-lint:fix`: `biome check . --write`
  - `format-and-lint:fix-unsafe`: `biome check . --write --unsafe`
- **Turborepo:** `turbo.json` caches these `//#format-and-lint` tasks.

## Proposed Migration Plan

### 1. Remove Biome

- Uninstall `@biomejs/biome` from the root `devDependencies`.
- Delete `biome.json`.

### 2. Install Oxc Tools

- Install `oxlint`, `oxfmt`, and `oxlint-tsgolint` as `devDependencies` in the root workspace:
  ```sh
  pnpm add -wD oxlint oxfmt oxlint-tsgolint
  ```

### 3. Add Oxc Configuration

Create the configuration files in the root directory using the settings from `rvo-connector`:

- **`.oxlintrc.json`**: Enable plugins `unicorn`, `typescript`, `oxc`, `node`, `promise`, `import` and their corresponding rules.
- **`.oxfmtrc.json`**:
  ```json
  {
    "$schema": "./node_modules/oxfmt/configuration_schema.json",
    "semi": false,
    "useTabs": false
  }
  ```

### 4. Update VS Code Settings

Update `.vscode/settings.json` to use the Oxc extension (`oxc.oxc-vscode`) as the default formatter for the relevant languages:

```json
{
  "editor.defaultFormatter": "oxc.oxc-vscode",
  "[typescriptreact]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
  "[typescript]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
  "[javascript]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
  "[json]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
  "editor.formatOnSave": true
}
```

### 5. Update Scripts and Turborepo Configuration

Replace the Biome scripts in the root `package.json` with Oxc equivalents, matching the naming convention and type-aware capabilities from `rvo-connector`.

```json
"scripts": {
  "lint": "oxlint --type-aware",
  "lint:fix": "oxlint --type-aware --fix",
  "lint:fix-suggest": "oxlint --type-aware --fix-suggestions",
  "lint:fix-suggest-unsafe": "oxlint --type-aware --fix --fix-suggestions",
  "format": "oxfmt"
}
```

Since we changed the script names, we must also update `turbo.json` to track `//#lint` and `//#format` instead of `//#format-and-lint`.

### 6. Resolve All Linting Issues

Run the new linter across the entire codebase and manually resolve all reported issues so that the repository conforms to the new ruleset and CI pipelines can pass cleanly. Where applicable, use the automatic fix scripts (`lint:fix` or `lint:fix-suggest`).

## Tasks

- [ ] Remove Biome configuration and dependencies
- [ ] Install Oxc toolchain
- [ ] Add `.oxlintrc.json` and `.oxfmtrc.json`
- [ ] Update `.vscode/settings.json`
- [ ] Update `package.json` and `turbo.json` scripts
- [ ] Run the new formatter and linter
- [ ] Resolve all remaining linting issues across the monorepo
