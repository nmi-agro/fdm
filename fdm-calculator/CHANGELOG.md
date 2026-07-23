# fdm-calculator

## 0.17.1

### Patch Changes

- Updated dependencies [[`845197e`](https://github.com/nmi-agro/fdm/commit/845197e28776b331f6d44e0eb64dc144e786f8f3)]:
  - @nmi-agro/fdm-core@0.35.0

## 0.17.0

### Minor Changes

- [#674](https://github.com/nmi-agro/fdm/pull/674) [`d4e5c73`](https://github.com/nmi-agro/fdm/commit/d4e5c73fad558934c30a1534972cd6118ff2886a) Thanks [@SvenVw](https://github.com/SvenVw)! - Add the stikstofgebruiksnorms for the new 2026 cultivations

### Patch Changes

- Updated dependencies []:
  - @nmi-agro/fdm-core@0.34.1

## 0.16.0

### Minor Changes

- [#638](https://github.com/nmi-agro/fdm/pull/638) [`c07e18c`](https://github.com/nmi-agro/fdm/commit/c07e18c7bc178a7c052fcdde0db30a56d508587a) Thanks [@SvenVw](https://github.com/SvenVw)! - Document and expose official BLN3 aggregation results in calculation types.
  - **Expose Aggregations**: Explicitly documents and types `Bln3AggregationResult` and the `Bln3Score.aggregations` field as fully implemented and returned by the NMI API.
  - **Reduces Overhead**: Developers consuming this package can now pull pre-computed official hierarchical aggregations (such as OBI subcategories and the S_BLN root score) directly from the API response payload without needing to write or maintain approximate client-side formulas.

- [#632](https://github.com/nmi-agro/fdm/pull/632) [`98edeca`](https://github.com/nmi-agro/fdm/commit/98edecaebdd50ae8f0e26980cc2fc9c642e3cad9) Thanks [@SvenVw](https://github.com/SvenVw)! - Add BCS (BodemConditieScore) calculation functions.
  - `calculateBcs(scores, labContext?)` — computes D_BCS (weighted total) and I_BCS (normalized 0–1 indicator) using exact Decimal.js arithmetic. Supports all 9 visual field indicators; when the optional `labContext` is provided, also derives and includes lab-based `a_ph_bcs` and `a_som_bcs` scores
  - `getBcsScoreColor(d_bcs)` — maps a D_BCS value to a colour band: `"red"` (< 10), `"orange"` (< 20), `"yellow"` (< 30), `"green"` (< 40), or `"emerald"` (≥ 40)
  - `getBcsScoreLabel(d_bcs)` — returns a Dutch label for a D_BCS value (Slecht / Onvoldoende / Matig / Goed / Zeer goed)
  - `derivePhBcs(d_ph_delta)` — derives a BCS pH score (0–2) from D_PH_DELTA using the OBIC logistic function
  - `deriveOmBcs(a_som_loi, crop_category, soiltype_n)` — derives a BCS organic matter score (0–2) from an a_som_loi lab measurement using OBIC crop × soil type quantile thresholds
  - `BCS_INDICATORS` — expanded to 11 entries (9 field + 2 lab-derived) with `source: "field" | "lab"` property, in paper-form order
  - `calcPhDelta(params)` — ports the OBIC `calc_ph_delta` function using embedded Handboek Bodem en Bemesting lookup tables (5.1, 5.2, 5.3, mh, mh_kl). Accepts soil type, clay%, OM%, crop plan fractions, and measured pH-CaCl₂. Returns D_PH_DELTA = max(0, pH_optimum − pH_measured)
  - `SoiltypeAgr` and `CalcPhDeltaParams` — exported types for calcPhDelta

### Patch Changes

- Updated dependencies [[`98e0127`](https://github.com/nmi-agro/fdm/commit/98e0127bd3f02e193ad57a1cfef18fc10df40c67), [`afdd78f`](https://github.com/nmi-agro/fdm/commit/afdd78f16fad2aef17e03e4eace48628ef7a2d51), [`98edeca`](https://github.com/nmi-agro/fdm/commit/98edecaebdd50ae8f0e26980cc2fc9c642e3cad9)]:
  - @nmi-agro/fdm-core@0.34.0

## 0.15.0

### Minor Changes

- [#608](https://github.com/nmi-agro/fdm/pull/608) [`c09b5bf`](https://github.com/nmi-agro/fdm/commit/c09b5bf87af13c2b9cb6f1200c7e293492a12a8c) Thanks [@SvenVw](https://github.com/SvenVw)! - Add BLN3 score calculation module. Exports `requestBln3Score` (raw NMI API call to `POST /maatwerk/bln3/score/field`), `getBln3Score` (cached wrapper via `withCalculationCache`), and `collectInputForBln3Score` (assembles field inputs from fdm-core: lat/lon from field centroid, soil analysis parameters, cultivations mapped from BRP catalogue codes, and adopted BLN measures). Types exported: `Bln3Score`, `Bln3ScoreInputs`, `Bln3ScoreCollectedInputs`, `Bln3IndicatorResult`, `Bln3AggregationResult`.

### Patch Changes

- [#618](https://github.com/nmi-agro/fdm/pull/618) [`be2f3ae`](https://github.com/nmi-agro/fdm/commit/be2f3aebd1816b832d9915bf1b7f961b16f18585) Thanks [@SvenVw](https://github.com/SvenVw)! - Remove norm values received from NMI API for nutrient advice as those are not used and can confuse the thinking process of Gerrit

- [#611](https://github.com/nmi-agro/fdm/pull/611) [`f243894`](https://github.com/nmi-agro/fdm/commit/f243894ee8f0fe9e64d313d64a0008a7703c1f49) Thanks [@SvenVw](https://github.com/SvenVw)! - When the norms can not be determined (not a calculation error) return a distinct error message and show it as warning instead of an error to the user

- Updated dependencies [[`8e454a3`](https://github.com/nmi-agro/fdm/commit/8e454a3d9af12a66b7f13ae0dd7d5e72c2d0a857), [`df22bcb`](https://github.com/nmi-agro/fdm/commit/df22bcb2516cfb04cfe97ab6f490e9a003a67ff5), [`c30057e`](https://github.com/nmi-agro/fdm/commit/c30057ea07f4646bd588d93a1eba894733076dae), [`e12afe4`](https://github.com/nmi-agro/fdm/commit/e12afe49ad898412dfe12f487b6a4ca46c57c66f)]:
  - @nmi-agro/fdm-core@0.33.0

## 0.14.0

### Minor Changes

- [#553](https://github.com/nmi-agro/fdm/pull/553) [`16692f1`](https://github.com/nmi-agro/fdm/commit/16692f1c368e4ff24497ae1a3cbb61f4a0d1a04e) Thanks [@SvenVw](https://github.com/SvenVw)! - Add Mineralization module to request the nsupply and dyna endpoint at NMI API

### Patch Changes

- [#557](https://github.com/nmi-agro/fdm/pull/557) [`fa0fc06`](https://github.com/nmi-agro/fdm/commit/fa0fc06516ec743dd29b285c020e501c98d5868b) Thanks [@SvenVw](https://github.com/SvenVw)! - Bump to TypeScript V6

- [#559](https://github.com/nmi-agro/fdm/pull/559) [`1d8bbf1`](https://github.com/nmi-agro/fdm/commit/1d8bbf18f00b237dfd99272b9a0662d352d27d53) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate from rollup to tsdown

- Updated dependencies [[`fa0fc06`](https://github.com/nmi-agro/fdm/commit/fa0fc06516ec743dd29b285c020e501c98d5868b), [`e396027`](https://github.com/nmi-agro/fdm/commit/e396027e4422b0dbb402ed7d965d155c7c79424c), [`3ce3f81`](https://github.com/nmi-agro/fdm/commit/3ce3f81256b84d1311b1ffda2eeabd9785f48964), [`b278794`](https://github.com/nmi-agro/fdm/commit/b278794c06af35ce5996965f6bfa020332e6270f), [`7d01bfc`](https://github.com/nmi-agro/fdm/commit/7d01bfcebb3e17dfa16217d462012976dff034d9), [`1d8bbf1`](https://github.com/nmi-agro/fdm/commit/1d8bbf18f00b237dfd99272b9a0662d352d27d53)]:
  - @nmi-agro/fdm-core@0.32.0

## 0.13.3

### Patch Changes

- [#584](https://github.com/nmi-agro/fdm/pull/584) [`4da1980`](https://github.com/nmi-agro/fdm/commit/4da19808a0dc21f2be07c9d490a54f0ef61c027a) Thanks [@SvenVw](https://github.com/SvenVw)! - Move GeoTIFF deposition fetch outside DB transaction in nitrogen balance data collection, freeing the database connection during HTTP/raster operations and reducing connection pool pressure under concurrent load

## 0.13.2

### Patch Changes

- [#569](https://github.com/nmi-agro/fdm/pull/569) [`8d7bf3f`](https://github.com/nmi-agro/fdm/commit/8d7bf3f26700d764a8d253087e1b966dc47d035e) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix a bug in organic matter supply calculation where `undefined` crop residues yielded zero supply; it now correctly calculates supply for residues that are not explicitly removed.

## 0.13.1

### Patch Changes

- [#552](https://github.com/nmi-agro/fdm/pull/552) [`45718ae`](https://github.com/nmi-agro/fdm/commit/45718ae5288f59797612d8a382f042598ecec163) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Fix type error in tests where errors are expected to be catched

- Updated dependencies [[`9dfd545`](https://github.com/nmi-agro/fdm/commit/9dfd545b834f90492d3599a0e82fe66978e56889)]:
  - @nmi-agro/fdm-core@0.31.1

## 0.13.0

### Minor Changes

- [#547](https://github.com/nmi-agro/fdm/pull/547) [`0f359ad`](https://github.com/nmi-agro/fdm/commit/0f359adc81efdac957fadab687ac1d61c8ddfc05) Thanks [@SvenVw](https://github.com/SvenVw)! - Replace per-field query loops with farm-level batch queries in all input collectors for balances and norms, eliminating N+1 database round-trips for large farms.

- [#534](https://github.com/nmi-agro/fdm/pull/534) [`2c9d6e9`](https://github.com/nmi-agro/fdm/commit/2c9d6e9fea5a2eabab44ca4bf67951825a3b6aa5) Thanks [@SvenVw](https://github.com/SvenVw)! - Add new public API exports for uncached norm-filling calculations and nitrogen balance aggregation:
  - **`createUncachedFunctionsForFertilizerApplicationFilling`:** Creates calculation functions that bypass the fdm database cache layer. Intended for evaluating proposed (not yet persisted) fertilizer plans where caching provides no benefit and direct calculation is preferred.
  - **`calculateNitrogenBalancesFieldToFarm`:** Aggregates field-level nitrogen balances up to the farm level.

- [#515](https://github.com/nmi-agro/fdm/pull/515) [`ae7d3c9`](https://github.com/nmi-agro/fdm/commit/ae7d3c98be19fb2cd3abf8b5de37f0e5312fd557) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Added `collectInputForNitrogenBalanceForFarms` and `collectInputForOrganicMatterBalanceForFarms` to collect balance inputs for multiple farms, reducing database lookups by deduplicating catalogue queries across farms. The functions use a composable pattern: first fetch enabled catalogues for all farms in one query, then fetch catalogue items once per unique catalogue, then process each farm individually.

### Patch Changes

- [#548](https://github.com/nmi-agro/fdm/pull/548) [`c570b8a`](https://github.com/nmi-agro/fdm/commit/c570b8a51bb22e513b4c07b0e9efdd072807dd5c) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix nitrogen removal for crop residues: residues left on the field are no longer counted as removed, while residues removed from the field are.

- [#535](https://github.com/nmi-agro/fdm/pull/535) [`6b00be9`](https://github.com/nmi-agro/fdm/commit/6b00be9c0999b3510a3af86b64d2002ee66ecc1b) Thanks [@SvenVw](https://github.com/SvenVw)! - Set minimum node.js version to v24

- [#503](https://github.com/nmi-agro/fdm/pull/503) [`71dcf8a`](https://github.com/nmi-agro/fdm/commit/71dcf8a15801d4faf476c18bbc4f2eb6b488c823) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix falsy checks to correctly preserve `0` and `false` values in calculations, ensuring accurate results when valid zero or false inputs are provided.

- Updated dependencies [[`ae7d3c9`](https://github.com/nmi-agro/fdm/commit/ae7d3c98be19fb2cd3abf8b5de37f0e5312fd557), [`69122ba`](https://github.com/nmi-agro/fdm/commit/69122ba66cdb6eb791e0fb51acd0f042d8ac7a71), [`0f359ad`](https://github.com/nmi-agro/fdm/commit/0f359adc81efdac957fadab687ac1d61c8ddfc05), [`6b00be9`](https://github.com/nmi-agro/fdm/commit/6b00be9c0999b3510a3af86b64d2002ee66ecc1b), [`21ef50a`](https://github.com/nmi-agro/fdm/commit/21ef50aa3c9e2b59366b1d27183cf9306c8dbe33), [`2fb53de`](https://github.com/nmi-agro/fdm/commit/2fb53dee72bee18b6db11de2939699e2d567f336)]:
  - @nmi-agro/fdm-core@0.31.0

## 0.12.2

### Patch Changes

- [#528](https://github.com/nmi-agro/fdm/pull/528) [`534836a`](https://github.com/nmi-agro/fdm/commit/534836a7493201c77b5c7766c86290d7168e6f76) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix intermittent `fetch failed` errors during GeoTIFF processing by implementing a multi-layered defense strategy:
  - **Hybrid Loading**: Small files (<= 2MB) are now buffered in RAM to eliminate excessive HTTP Range requests.
  - **Concurrency Throttling**: Added a semaphore to limit concurrent raster reads, protecting the socket pool.
  - **Robustness**: Integrated 10s timeouts, `AbortSignal` support for request cancellation, and automatic retries with exponential backoff for transient network failures.
- Updated dependencies [[`e9a3cd4`](https://github.com/nmi-agro/fdm/commit/e9a3cd4de585c2e05fc215ff0c5e758005c48f73)]:
  - @nmi-agro/fdm-core@0.30.1

## 0.12.1

### Patch Changes

- [#495](https://github.com/nmi-agro/fdm/pull/495) [`9d5050a`](https://github.com/nmi-agro/fdm/commit/9d5050aef5f70636be638d2f1a4027ccd22f4189) Thanks [@SvenVw](https://github.com/SvenVw)! - Fixes for farm nitrogen balance to exclude nitrate leaching

## 0.12.0

### Minor Changes

- [#465](https://github.com/nmi-agro/fdm/pull/465) [`8dcc0ae`](https://github.com/nmi-agro/fdm/commit/8dcc0aeb951a12941737f1416961cea36c24c318) Thanks [@SvenVw](https://github.com/SvenVw)! - Add calculateNlvSupplyBySom to calculate the change in NLV by a change in SOM

- [#465](https://github.com/nmi-agro/fdm/pull/465) [`1df6896`](https://github.com/nmi-agro/fdm/commit/1df6896be4082d79ff817799beffa2dc6121b563) Thanks [@SvenVw](https://github.com/SvenVw)! - Add the function calculateWaterSupplyBySom to calculate the change in water holding capacity for a topsoil based on change in SOM

### Patch Changes

- [#474](https://github.com/nmi-agro/fdm/pull/474) [`5579ab3`](https://github.com/nmi-agro/fdm/commit/5579ab3674d963e194aa8295b706266f591cbb45) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate organization from `SvenVw` to `nmi-agro`

- Updated dependencies [[`ecd4d21`](https://github.com/nmi-agro/fdm/commit/ecd4d2184de555cbace8d031d0b63d121de9971f), [`5579ab3`](https://github.com/nmi-agro/fdm/commit/5579ab3674d963e194aa8295b706266f591cbb45), [`4fe42b1`](https://github.com/nmi-agro/fdm/commit/4fe42b1b0345c20ccb4b6697174259dd3ccbef6b), [`1ac14fe`](https://github.com/nmi-agro/fdm/commit/1ac14fed4dca7a830f5d51c498976c0d17e53868)]:
  - @nmi-agro/fdm-core@0.30.0

## 0.11.1

### Patch Changes

- [#472](https://github.com/nmi-agro/fdm/pull/472) [`d82c60b`](https://github.com/nmi-agro/fdm/commit/d82c60b1162ebe982a337d9ea1bde96650446b17) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix: isFieldInGWGBGebied, isFieldInNatura2000Gebied, and isFieldInDerogatieVrijeZone now return false instead of throwing an error when a centroid coordinate lies outside the GeoTIFF bounding box (null value)

## 0.11.0

### Minor Changes

- [#422](https://github.com/nmi-agro/fdm/pull/422) [`4687738`](https://github.com/nmi-agro/fdm/commit/4687738e3b8ef35d071ae16b218d567a3cfbf3be) Thanks [@SvenVw](https://github.com/SvenVw)! - Exclude buffer strips from calculating farm balances and set field values to 0

- [#415](https://github.com/nmi-agro/fdm/pull/415) [`01d7174`](https://github.com/nmi-agro/fdm/commit/01d7174bef42f2fc8e71b4bb25eee045687e8c56) Thanks [@SvenVw](https://github.com/SvenVw)! - Implement Dutch nitrogen reduction (korting) logic for grassland renewal and destruction for 2025 and 2026. Includes localized Dutch error messages for invalid operation dates.

- [#407](https://github.com/nmi-agro/fdm/pull/407) [`6f7f271`](https://github.com/nmi-agro/fdm/commit/6f7f27183f66bcc329720af5dcc17f250d74cbcf) Thanks [@SvenVw](https://github.com/SvenVw)! - For balance calculation cache per field instead of per farm and thus replace getNitrogenBalance with getNitrogenBalanceField and getOrganicMatterBalance with getOrganicMatterBalanceField

- [#422](https://github.com/nmi-agro/fdm/pull/422) [`4687738`](https://github.com/nmi-agro/fdm/commit/4687738e3b8ef35d071ae16b218d567a3cfbf3be) Thanks [@SvenVw](https://github.com/SvenVw)! - Do not provide nutrient advice for buffer strips by setting the output to 0

- [#422](https://github.com/nmi-agro/fdm/pull/422) [`4687738`](https://github.com/nmi-agro/fdm/commit/4687738e3b8ef35d071ae16b218d567a3cfbf3be) Thanks [@SvenVw](https://github.com/SvenVw)! - For buffer strips set the norm values to 0 as they have no 'plaatsingsruimte'

### Patch Changes

- [#407](https://github.com/nmi-agro/fdm/pull/407) [`6f7f271`](https://github.com/nmi-agro/fdm/commit/6f7f27183f66bcc329720af5dcc17f250d74cbcf) Thanks [@SvenVw](https://github.com/SvenVw)! - Refactor Nitrogen and Organic Matter balance calculations to use a bottom-up (Field -> Farm) approach

- Updated dependencies [[`ae0468c`](https://github.com/nmi-agro/fdm/commit/ae0468c9b37f1326634bff24bd667ec5003d4bed), [`c316515`](https://github.com/nmi-agro/fdm/commit/c3165156c249931f56a97fa4a0b82493a5e25c9b), [`da3e50a`](https://github.com/nmi-agro/fdm/commit/da3e50a571483c576dd88abecd3e70ca0b9f22ba), [`bcd3a32`](https://github.com/nmi-agro/fdm/commit/bcd3a3289c9a13ffc36ea108e502661496164bf7), [`75553c4`](https://github.com/nmi-agro/fdm/commit/75553c41830c8519788a68560d9403192790d051)]:
  - @nmi-agro/fdm-core@0.29.0

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
  - @nmi-agro/fdm-core@0.28.0

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
  - @nmi-agro/fdm-core@0.27.0

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
  - @nmi-agro/fdm-core@0.26.0

## 0.7.2

### Patch Changes

- 9b9dc68: Fixes ammonia emission factor for residues to be converted from percentage to factor

## 0.7.1

### Patch Changes

- ba3d4d3: Fixes to include missing `injection` value for `p_app_method`
- dcf0577: Add check for bare soil crop codes at `determineManureAmmoniaEmissionFactor`
- e715493: Fix determining cropland at `determineManureAmmoniaEmissionFactor`
- 12565b2: Improved `determineManureAmmoniaEmissionFactor` so that it in all cases will return a value
  - @nmi-agro/fdm-core@0.25.1

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
  - @nmi-agro/fdm-core@0.25.0

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
  - @nmi-agro/fdm-core@0.24.0

## 0.5.3

### Patch Changes

- 9b71a8f: Give Natura 2000 and GWBG derogation norms priority over NV-gebied
- 74dbb41: Add Natura 2000 proximity check to derogation norm calculation
- 03f2d99: Fix derogation norm for GWBG-gebieden: 170 kg N/ha

## 0.5.2

### Patch Changes

- 11136b2: Fix issues with tests that used outdated gwl classes
- Updated dependencies [828ad89]
  - @nmi-agro/fdm-core@0.23.2

## 0.5.1

### Patch Changes

- 48b94c3: Support the updated classed for `b_gwl_class` at `calculateTargetForNitrogenBalance`
- Updated dependencies [d331cca]
  - @nmi-agro/fdm-core@0.23.1

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
  - @nmi-agro/fdm-core@0.23.0

## 0.4.1

### Patch Changes

- 7c36ecc: Fix calculation of ammonia emission by other fertilizers by excluding manure, mineral and compost
- 3e73281: Switch to return 0 for unsupported application methods for organic fertilizers at NH3 emission
  - @nmi-agro/fdm-core@0.22.1

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
  - @nmi-agro/fdm-core@0.22.0

## 0.3.3

### Patch Changes

- 94a82f6: Fix at balance calculation to convert null values to 0 and prevent exception due to Decimal

## 0.3.2

### Patch Changes

- Updated dependencies [8cb4399]
  - @nmi-agro/fdm-core@0.21.1

## 0.3.1

### Patch Changes

- Updated dependencies [004c58d]
- Updated dependencies [7b447f6]
- Updated dependencies [7b447f6]
- Updated dependencies [842aac4]
  - @nmi-agro/fdm-core@0.21.0

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
  - @nmi-agro/fdm-core@0.20.0

## 0.2.6

### Patch Changes

- Updated dependencies [eed1780]
  - @nmi-agro/fdm-core@0.19.0

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
  - @nmi-agro/fdm-core@0.18.0

## 0.2.4

### Patch Changes

- Updated dependencies [9bfd0a8]
  - @nmi-agro/fdm-core@0.17.0

## 0.2.3

### Patch Changes

- Updated dependencies [e134cfc]
  - @nmi-agro/fdm-core@0.16.0

## 0.2.2

### Patch Changes

- Updated dependencies [b601b5f]
- Updated dependencies [9b1f522]
- Updated dependencies [f056396]
- Updated dependencies [cdb1d02]
- Updated dependencies [9a6e329]
  - @nmi-agro/fdm-core@0.15.0

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
  - @nmi-agro/fdm-core@0.14.0

## 0.1.1

### Patch Changes

- da00990: Fix using incorrect unit for nutrient content of fertilizer
- Updated dependencies [9830186]
- Updated dependencies [06619e7]
  - @nmi-agro/fdm-core@0.13.0

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
  - @nmi-agro/fdm-core@0.12.0

## 0.0.2

### Patch Changes

- Upgrade to use ES2022

## 0.0.1

### Patch Changes

- Updated dependencies [6f6b1c4]
- Updated dependencies [1750661]
  - fdm-core@0.3.1
