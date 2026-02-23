# fdm-calculator

## 0.11.1

### Patch Changes

- [#472](https://github.com/SvenVw/fdm/pull/472) [`d82c60b`](https://github.com/SvenVw/fdm/commit/d82c60b1162ebe982a337d9ea1bde96650446b17) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix: isFieldInGWGBGebied, isFieldInNatura2000Gebied, and isFieldInDerogatieVrijeZone now return false instead of throwing an error when a centroid coordinate lies outside the GeoTIFF bounding box (null value)

## 0.11.0

### Minor Changes

- [#422](https://github.com/SvenVw/fdm/pull/422) [`4687738`](https://github.com/SvenVw/fdm/commit/4687738e3b8ef35d071ae16b218d567a3cfbf3be) Thanks [@SvenVw](https://github.com/SvenVw)! - Exclude buffer strips from calculating farm balances and set field values to 0

- [#415](https://github.com/SvenVw/fdm/pull/415) [`01d7174`](https://github.com/SvenVw/fdm/commit/01d7174bef42f2fc8e71b4bb25eee045687e8c56) Thanks [@SvenVw](https://github.com/SvenVw)! - Implement Dutch nitrogen reduction (korting) logic for grassland renewal and destruction for 2025 and 2026. Includes localized Dutch error messages for invalid operation dates.

- [#407](https://github.com/SvenVw/fdm/pull/407) [`6f7f271`](https://github.com/SvenVw/fdm/commit/6f7f27183f66bcc329720af5dcc17f250d74cbcf) Thanks [@SvenVw](https://github.com/SvenVw)! - For balance calculation cache per field instead of per farm and thus replace getNitrogenBalance with getNitrogenBalanceField and getOrganicMatterBalance with getOrganicMatterBalanceField

- [#422](https://github.com/SvenVw/fdm/pull/422) [`4687738`](https://github.com/SvenVw/fdm/commit/4687738e3b8ef35d071ae16b218d567a3cfbf3be) Thanks [@SvenVw](https://github.com/SvenVw)! - Do not provide nutrient advice for buffer strips by setting the output to 0

- [#422](https://github.com/SvenVw/fdm/pull/422) [`4687738`](https://github.com/SvenVw/fdm/commit/4687738e3b8ef35d071ae16b218d567a3cfbf3be) Thanks [@SvenVw](https://github.com/SvenVw)! - For buffer strips set the norm values to 0 as they have no 'plaatsingsruimte'

### Patch Changes

- [#407](https://github.com/SvenVw/fdm/pull/407) [`6f7f271`](https://github.com/SvenVw/fdm/commit/6f7f27183f66bcc329720af5dcc17f250d74cbcf) Thanks [@SvenVw](https://github.com/SvenVw)! - Refactor Nitrogen and Organic Matter balance calculations to use a bottom-up (Field -> Farm) approach

- Updated dependencies [[`ae0468c`](https://github.com/SvenVw/fdm/commit/ae0468c9b37f1326634bff24bd667ec5003d4bed), [`c316515`](https://github.com/SvenVw/fdm/commit/c3165156c249931f56a97fa4a0b82493a5e25c9b), [`da3e50a`](https://github.com/SvenVw/fdm/commit/da3e50a571483c576dd88abecd3e70ca0b9f22ba), [`bcd3a32`](https://github.com/SvenVw/fdm/commit/bcd3a3289c9a13ffc36ea108e502661496164bf7), [`75553c4`](https://github.com/SvenVw/fdm/commit/75553c41830c8519788a68560d9403192790d051)]:
  - @svenvw/fdm-core@0.29.0

## 0.10.2

### Patch Changes

- 3f16a89: Fixes that `determineMineralAmmoniaEmissionFactor` returned a percentage instead of a factor

## 0.10.1

### Patch Changes

- bc23b79: Fix calculating stikstofgebruiksnorm for snijmais in 2026
- 3053340: Fix nitrogen usage norms calculation for temporary grasslands in 2025 and 2026 by improving time-based period matching and handling timezone edge cases.
- 005de6d: Fix that the nitrogen discount (korting) for catch crops is not applied to grasslands

## 0.10.0

### Minor Changes

- 61966db: Unified the data shape between farm and field nitrogen balance results. Added further breakdown on farm balance result, based on the type of fertilizer, or the contribution of fixation, harvests, and residues.
- 99a8797: Add calculation support of Dutch norms for fertilizer applications for 2026
- 6d28fd7: Include at NL Stikstofgebruiksnormen that nl_335 (Natuurterreinen (incl. heide)) is set to be not bouwland

### Patch Changes

- ba2c7dc: Fix calculating korting at stikstofgebruiksnorm when vangewas is sown on October 15th
- 2c5de99: Make fdm-data, fdm-calculator and fdm-data fully type-safe, including inferring dependencies in the monorepo
- 67612d7: Fixes target value for nitrogen balance at arable, clay and dry soil to be 115 kg N / ha instead of 125 kg N / ha
- Updated dependencies [022a347]
- Updated dependencies [1885f8a]
- Updated dependencies [2c5de99]
  - @svenvw/fdm-core@0.28.0

## 0.9.0

### Minor Changes

- ca76b7d: The output of nitrogen balance now includes for emission a distinction between ammonia and nitrate
- 21a4cf9: Add `calculateOrganicMatterBalance` and `getOrganicMatterBalance` to calculate organic matter balances of a farm
- 3b5cd55: Add calculation of nitrate emission in the nitrogen balance

### Patch Changes

- 0268ecd: Optimize build configuration:
  - Fix issue where dependencies could be accidentally bundled into the output.
  - Improve development build performance by skipping minification.
  - Standardize source map generation.

- Updated dependencies [d8dcd23]
- Updated dependencies [7a8f5a9]
- Updated dependencies [6f51ad5]
- Updated dependencies [0268ecd]
- Updated dependencies [dd3a6f1]
- Updated dependencies [f51b412]
- Updated dependencies [f51b412]
- Updated dependencies [92fdf21]
  - @svenvw/fdm-core@0.27.0

## 0.8.0

### Minor Changes

- a74a6e8: Add `getNutrientAdvice` and `requestNutrientAdvice` to fetch nutrient advices from the NMI API
- 77c309d: The nitrogen balance can now be calculated per field instead of only per farm.
- 77c309d: The nitrogen balance calculation now gracefully handles errors for individual fields. Instead of failing the entire farm calculation, it will now return partial results for successfully calculated fields and provide specific error messages for fields that encountered issues.
- 91d4103: Add cached versions of main calculator functions for `balance` and `norms` to enable caching
- 8b2bf8c: Add functions to calculate the norm filling by fertilizer application for NL 2025

### Patch Changes

- 726ae00: Fixes to differentiate stikstofgebruiksnorm for grassland based on "beweiden" or "volledig maaien"
- Updated dependencies [a226f7e]
- Updated dependencies [a00a331]
- Updated dependencies [8f9d4ff]
- Updated dependencies [2f7b281]
- Updated dependencies [c939de9]
- Updated dependencies [b58cd07]
- Updated dependencies [b58cd07]
- Updated dependencies [ac5d94f]
- Updated dependencies [6bcb528]
- Updated dependencies [91d4103]
  - @svenvw/fdm-core@0.26.0

## 0.7.2

### Patch Changes

- 9b9dc68: Fixes ammonia emission factor for residues to be converted from percentage to factor

## 0.7.1

### Patch Changes

- ba3d4d3: Fixes to include missing `injection` value for `p_app_method`
- dcf0577: Add check for bare soil crop codes at `determineManureAmmoniaEmissionFactor`
- e715493: Fix determining cropland at `determineManureAmmoniaEmissionFactor`
- 12565b2: Improved `determineManureAmmoniaEmissionFactor` so that it in all cases will return a value
  - @svenvw/fdm-core@0.25.1

## 0.7.0

### Minor Changes

- fa5aab5: Adds support for derogatievrije zones at dierlijke mest gebruiksnorm calculation
- be7d733: Add support for cultivations with different stikstofgebruiksnormen for first and subsequent years.

### Patch Changes

- 7cfc412: Prevent overwhelming the nitrogen balance calculation with many fields by organizing calculations into batches.
- 85b964d: Fix exception when calculating stikstofgebruiksnorm for cultivations with sub_types.
- 82bb999: In norms, replace vector lookups of remote datasets with raster queries to improve performance and reliability.
- 8333884: Fixes exception at calculating stikstofgebruiksnorm when potato crop has no variety provided
- d25b70e: Improve nitrogen balance calculation performance for fertilizer supply by iterating over each fertilizer application only once.
- 14c8a06: Improve nitrogen balance performance by retrieving deposition values more efficiently from the remote GeoTIFF (batched requests + caching)
- a1ef995: Improve nitrogen balance calculation performance for ammonia emissions from fertilizer applications by iterating over each application only once.
- Updated dependencies [af57dd1]
- Updated dependencies [29b0937]
- Updated dependencies [aa7a1b1]
- Updated dependencies [8cc6e4a]
- Updated dependencies [5cf76d4]
- Updated dependencies [86e16c2]
  - @svenvw/fdm-core@0.25.0

## 0.6.1

### Patch Changes

- a9acf19: Fix divide-by-zero in nitrogen balance when b_lu_hi is undefined or 0

## 0.6.0

### Minor Changes

- 140e957: Refactor nitrogen balance: replace "volatilization" with "emission" to enable inclusion of nitrate leaching.
- 34b6e57: Use default values for mineralization instead of calculating it using MINIP.
- 12dbc4c: Export the function getRegion, isFieldInNVGebied, isFieldInGWGBGebie and isFieldInNatura2000Gebied

### Patch Changes

- Updated dependencies [344e75c]
  - @svenvw/fdm-core@0.24.0

## 0.5.3

### Patch Changes

- 9b71a8f: Give Natura 2000 and GWBG derogation norms priority over NV-gebied
- 74dbb41: Add Natura 2000 proximity check to derogation norm calculation
- 03f2d99: Fix derogation norm for GWBG-gebieden: 170 kg N/ha

## 0.5.2

### Patch Changes

- 11136b2: Fix issues with tests that used outdated gwl classes
- Updated dependencies [828ad89]
  - @svenvw/fdm-core@0.23.2

## 0.5.1

### Patch Changes

- 48b94c3: Support the updated classed for `b_gwl_class` at `calculateTargetForNitrogenBalance`
- Updated dependencies [d331cca]
  - @svenvw/fdm-core@0.23.1

## 0.5.0

### Minor Changes

- Implement detailed calculations for `norms` in The Netherlands for 2025, including stikstofgebruiksnorm, fosfaatgebruiksnorm and dierlijke mest norm
- Add setup for `norms` to provide functions for regions and years to calculate the amount of fertilizer that can be applied according to local legislation

### Patch Changes

- db5e7fe: Update dependencies
- f19238b: Fix calculation of crop residue biomass at nitrogen balance calculation
- Updated dependencies [52e0959]
- Updated dependencies [0f8e4eb]
- Updated dependencies [db5e7fe]
- Updated dependencies [b502367]
- Updated dependencies [b40cffa]
- Updated dependencies [cbf5340]
- Updated dependencies [51722cc]
- Updated dependencies [2ac1471]
  - @svenvw/fdm-core@0.23.0

## 0.4.1

### Patch Changes

- 7c36ecc: Fix calculation of ammonia emission by other fertilizers by excluding manure, mineral and compost
- 3e73281: Switch to return 0 for unsupported application methods for organic fertilizers at NH3 emission
  - @svenvw/fdm-core@0.22.1

## 0.4.0

### Minor Changes

- 5d0a80b: Expand number of nutrients in output of `calculateDose`
- fbbdc57: Add doses of individual applications to the output of `calculateDose`
- 2c6251c: Add calculation of ammonia emissions to nitrogen balance calculation.

### Patch Changes

- 955f854: Fix unit conversion at calculation of N supply by other fertilizers
- Updated dependencies [ce5ffa8]
- Updated dependencies [b6721b4]
- Updated dependencies [780e8c4]
- Updated dependencies [ac05d8b]
- Updated dependencies [a58b367]
- Updated dependencies [afe2a32]
- Updated dependencies [e6c0fa3]
- Updated dependencies [75693e4]
  - @svenvw/fdm-core@0.22.0

## 0.3.3

### Patch Changes

- 94a82f6: Fix at balance calculation to convert null values to 0 and prevent exception due to Decimal

## 0.3.2

### Patch Changes

- Updated dependencies [8cb4399]
  - @svenvw/fdm-core@0.21.1

## 0.3.1

### Patch Changes

- Updated dependencies [004c58d]
- Updated dependencies [7b447f6]
- Updated dependencies [7b447f6]
- Updated dependencies [842aac4]
  - @svenvw/fdm-core@0.21.0

## 0.3.0

### Minor Changes

- 119c328: Add the function `calculateNitrogenBalance` to calculate on farm level the nitrogen balance
- 119c328: Add the function `collectInputForNitrogenBalance` to collect input data from a fdm instance for the `calculateNitrogenBalance` function
- ba3801c: Add function `collectInputForNitrogenBalance` to collect the input data from a fdm instance to calculate the nitrogen balance
- c122c66: Add function to calculate target for nitrogen balance

### Patch Changes

- Updated dependencies [e260795]
- Updated dependencies [0dc93fd]
- Updated dependencies [5a3bf78]
- Updated dependencies [c44812f]
- Updated dependencies [cf399ca]
- Updated dependencies [249138c]
- Updated dependencies [f05e1cb]
- Updated dependencies [9a5be3b]
- Updated dependencies [6292cf3]
- Updated dependencies [f05e1cb]
- Updated dependencies [286abb9]
- Updated dependencies [bdf0cb0]
- Updated dependencies [343c580]
- Updated dependencies [ef8a2c6]
- Updated dependencies [e260795]
- Updated dependencies [13210e6]
- Updated dependencies [18f195b]
- Updated dependencies [a550805]
- Updated dependencies [7e881c1]
- Updated dependencies [d4a7e02]
- Updated dependencies [e0a779c]
- Updated dependencies [c44812f]
- Updated dependencies [dd7bb7b]
- Updated dependencies [ec0494c]
- Updated dependencies [0a546d4]
- Updated dependencies [ec0494c]
- Updated dependencies [6676992]
- Updated dependencies [4027c9a]
  - @svenvw/fdm-core@0.20.0

## 0.2.6

### Patch Changes

- Updated dependencies [eed1780]
  - @svenvw/fdm-core@0.19.0

## 0.2.5

### Patch Changes

- 175ea6a: Minify the code during rollup with terser
- Updated dependencies [c240486]
- Updated dependencies [e9926cb]
- Updated dependencies [82f4767]
- Updated dependencies [a52796a]
- Updated dependencies [9ea6795]
- Updated dependencies [a259ff6]
- Updated dependencies [01081b3]
- Updated dependencies [d693cdb]
- Updated dependencies [0944ef1]
- Updated dependencies [175ea6a]
- Updated dependencies [9f4d818]
  - @svenvw/fdm-core@0.18.0

## 0.2.4

### Patch Changes

- Updated dependencies [9bfd0a8]
  - @svenvw/fdm-core@0.17.0

## 0.2.3

### Patch Changes

- Updated dependencies [e134cfc]
  - @svenvw/fdm-core@0.16.0

## 0.2.2

### Patch Changes

- Updated dependencies [b601b5f]
- Updated dependencies [9b1f522]
- Updated dependencies [f056396]
- Updated dependencies [cdb1d02]
- Updated dependencies [9a6e329]
  - @svenvw/fdm-core@0.15.0

## 0.2.1

### Patch Changes

- 98e20ac: List other `fdm` packages as `dependencies` instead `peerDependencies` to prevent not needed major version bumps

## 0.2.0

### Minor Changes

- 45eda20: Add `p_dose_nw` to output at `calculateDose`

### Patch Changes

- e312060: Fix at `calculateDose` the unit of the output
- Updated dependencies [4d1dbd9]
- Updated dependencies [4d1dbd9]
- Updated dependencies [0224544]
- Updated dependencies [0b28bd5]
- Updated dependencies [1a295b0]
- Updated dependencies [6a01698]
- Updated dependencies [972bac8]
- Updated dependencies [7387530]
  - @svenvw/fdm-core@0.14.0

## 0.1.1

### Patch Changes

- da00990: Fix using incorrect unit for nutrient content of fertilizer
- Updated dependencies [9830186]
- Updated dependencies [06619e7]
  - @svenvw/fdm-core@0.13.0

## 0.1.0

### Minor Changes

- 475986f: Add `calculateDose` and `getDoseForField` to retrieve the nutrient doses

### Patch Changes

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
  - @svenvw/fdm-core@0.12.0

## 0.0.2

### Patch Changes

- Upgrade to use ES2022

## 0.0.1

### Patch Changes

- Updated dependencies [6f6b1c4]
- Updated dependencies [1750661]
  - fdm-core@0.3.1
