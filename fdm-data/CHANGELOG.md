# fdm-data

## 0.19.1

### Patch Changes

- 2c5de99: Make fdm-data, fdm-calculator and fdm-data fully type-safe, including inferring dependencies in the monorepo

## 0.19.0

### Minor Changes

- cd8a771: Add `b_lu_eom` and `b_lu_eom_residue` to brp catalogue with default values
- 9283c86: Add `b_lu_dm` to brp catalogue as the default value for the dry matter content in the harvested product of the cultivation in g DM / kg fresh
- b24d2d1: Add `b_lu_harvestcat` field to BRP catalogue entries, providing default harvest class assignment for cultivations

### Patch Changes

- 43d35b2: Fixes that nl_6794 (groene braak) has b_lu_harvestable set to 'none' and thus is not harvestable
- 0268ecd: Optimize build configuration:
  - Fix issue where dependencies could be accidentally bundled into the output.
  - Improve development build performance by skipping minification.
  - Standardize source map generation.

- b24d2d1: Improve default yield values for some categories, especially nature, in brp catalogue

## 0.18.1

### Patch Changes

- ed53b86: Add `p_type_rvo` to SRM catalogue

## 0.18.0

### Minor Changes

- 97083dd: Adds `b_lu_start_default` and `b_date_harvest_default` to brp catalogue
- d6b8900: Add `p_type_rvo` to `baat` catalogue

## 0.17.1

### Patch Changes

- e4ce36a: Replace unknown values for `b_lu_yield`, `b_lu_hi`, `b_lu_n_harvestable` and `b_lu_n_residue` with median value for `b_lu_croprotation` instead of 0

## 0.17.0

### Minor Changes

- 16270d6: Add `p_ef_nh3` to synced values for `baat` catalogue

### Patch Changes

- e844f9d: Fixes unit of `p_ef_nh3` to be a fraction instead of percentage

## 0.16.0

### Minor Changes

- 34ce6df: Add the new BRP 2025 crops to the brp cultivation dataset
- 5790000: Add `b_lu_variety_options` to cultivation catalogue items to list the possible varieties for a cultivation.
- 34ce6df: Add the `b_lu_rest_oravib` property to the BRP cultivation dataset

## 0.15.0

### Minor Changes

- 6821ee9: Correct the values for `b_lu_yield` at `brp` cultivation catalogue

### Patch Changes

- db5e7fe: Update dependencies

## 0.14.1

### Patch Changes

- ffd1b3e: Added test for new parameters at cultivation

## 0.14.0

### Minor Changes

- 093784b: Add `p_no3_rt` and `p_nh4_rt` to SRM catalogue.
- e37b6f0: Add `p_app_method_options` as parameter of Fertilizer Catalogue
- 7f95233: Expose the `ApplicationMethods` union type in the `@nmi-agro/fdm-data` package
- a898e30: Add `baat` as new catalogue for fertilizers

## 0.13.1

### Patch Changes

- 5eb6ef2: Fix typo in parameter name `p_cl_rt` in the type CatalogueFertilizerItem

## 0.13.0

### Minor Changes

- af2c6a2: Add the new cultivation catalogue parameters to brp: `b_lu_croprotation`, `b_lu_yield`, `b_lu_hi`, `b_lu_n_harvestable`, `b_lu_n_residue`, `b_n_fixation`

## 0.12.0

### Minor Changes

- 7e66231: Add function `hashFertilizer` to create hash for fertilizer
- 1218ab7: Add `hashCultivation` to get the hash of a cultivation item

### Patch Changes

- e9926cb: Rename `p_cl_cr` to `p_cl_rt` as the previous name was a typo
- 175ea6a: Minify the code during rollup with terser

## 0.11.0

### Minor Changes

- c93c076: Add function `getFertilizerCatalogue` to replace `extendFertilizersCatalogue`
- 5a93b69: Add function `getCultivationCatalogue` to replace `extendCultivationsCatalogue`

### Patch Changes

- 7499eae: Remove dependency on `drizzle-orm` and `fdm-core`
- ae3447f: Add CI tests

## 0.10.3

### Patch Changes

- 98e20ac: List other `fdm` packages as `dependencies` instead `peerDependencies` to prevent not needed major version bumps

## 0.10.2

### Patch Changes

- Updated dependencies [4d1dbd9]
- Updated dependencies [4d1dbd9]
- Updated dependencies [0224544]
- Updated dependencies [0b28bd5]
- Updated dependencies [1a295b0]
- Updated dependencies [6a01698]
- Updated dependencies [972bac8]
- Updated dependencies [7387530]
  - @nmi-agro/fdm-core@0.14.0

## 0.10.1

### Patch Changes

- Updated dependencies [9830186]
- Updated dependencies [06619e7]
  - @nmi-agro/fdm-core@0.13.0

## 0.10.0

### Minor Changes

- 2508042: Add `b_lu_harvestable` as property to catalogue of `brp`

### Patch Changes

- ed82ff6: Fix that typescript declarations are included in the build
- Updated dependencies [5d2871e]
- Updated dependencies [644a159]
- Updated dependencies [e518d78]
- Updated dependencies [9e05058]
- Updated dependencies [d2a2ab7]
- Updated dependencies [1b435a3]
- Updated dependencies [488f898]
- Updated dependencies [ed82ff6]
- Updated dependencies [d2a2ab7]
- Updated dependencies [aede4a7]
- Updated dependencies [9e6f2d7]
- Updated dependencies [644a159]
  - @nmi-agro/fdm-core@0.12.0

## 0.9.0

### Minor Changes

- c584d5a: Switch from Vite to Rollup to fix building errors (and Rollup is better suited for server-only modules)

### Patch Changes

- Updated dependencies [341b0a3]
- Updated dependencies [0d97679]
- Updated dependencies [f7d7a50]
- Updated dependencies [899b99c]
- Updated dependencies [f7d7a50]
- Updated dependencies [c584d5a]
- Updated dependencies [f7d7a50]
- Updated dependencies [073b92e]
  - @nmi-agro/fdm-core@0.11.0

## 0.8.2

### Patch Changes

- Replace ESLint with Biome and format the code accordingly
- Updated dependencies
  - @nmi-agro/fdm-core@0.10.2

## 0.8.1

### Patch Changes

- Use the same version for `vite`, `typescript` and `dotenvx` across packages and update those to the latest version
- Updated dependencies
  - @nmi-agro/fdm-core@0.10.1

## 0.8.0

### Patch Changes

- Updated dependencies [520a074]
- Updated dependencies [2171b68]
- Updated dependencies [2171b68]
  - @nmi-agro/fdm-core@0.10.0

## 0.7.0

### Patch Changes

- Updated dependencies [441decd]
- Updated dependencies [71cbba3]
- Updated dependencies [5d0e1f7]
- Updated dependencies [315710b]
  - @nmi-agro/fdm-core@0.9.0

## 0.6.0

### Patch Changes

- Updated dependencies [83c589b]
- Updated dependencies [6a3e6db]
  - @nmi-agro/fdm-core@0.8.0

## 0.5.0

### Patch Changes

- Upgrade to use ES2022
- Updated dependencies [7af3fda]
- Updated dependencies [bc4e75f]
- Updated dependencies [a948c61]
- Updated dependencies [efa423d]
- Updated dependencies [b0c001e]
- Updated dependencies [6ef3d44]
- Updated dependencies [61da12f]
- Updated dependencies [5be0abc]
- Updated dependencies [4189f5d]
  - @nmi-agro/fdm-core@0.7.0

## 0.4.0

### Minor Changes

- d39b097: Add `extendCultivationsCatalogue` to extend the `cultivations_catalogue` table
- d39b097: Add `brp` as catalogue for cultivations

### Patch Changes

- 35c55e1: Add example configuration file as `.env.example`
- 6694029: Upgrade `pnpm` to 9.14.2
- Updated dependencies [35c55e1]
- Updated dependencies [6694029]
- Updated dependencies [c316d5c]
- Updated dependencies [b1dea77]
- Updated dependencies [49aa60c]
  - @nmi-agro/fdm-core@0.6.0

## 0.3.0

### Patch Changes

- Updated dependencies [5fa0cdc]
- Updated dependencies [f9050b0]
- Updated dependencies
- Updated dependencies [7aff5c6]
  - @nmi-agro/fdm-core@0.5.0

## 0.2.0

### Minor Changes

- e62c51d: Add `srm` as option for `datasetName` at `extendFertilizersCatalogue`

### Patch Changes

- 08ac0ed: Add workflow for prereleases
- Updated dependencies
- Updated dependencies [a2ee857]
  - @nmi-agro/fdm-core@0.4.0

## 0.1.1

### Patch Changes

- Updated dependencies [6f6b1c4]
- Updated dependencies [1750661]
  - fdm-core@0.3.1

## 0.1.0

### Minor Changes

- b8f1615: Initialize fdm-data package

### Patch Changes

- Updated dependencies [6fb7d11]
- Updated dependencies [73bdd1c]
- Updated dependencies [3160e82]
  - fdm-core@0.3.0
