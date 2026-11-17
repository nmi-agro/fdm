# fdm-docs

## 0.14.1

### Patch Changes

- [#836](https://github.com/nmi-agro/fdm/pull/836) [`722b9c8`](https://github.com/nmi-agro/fdm/commit/722b9c8fc44a744bfafb7605f22fca69b5e81969) Thanks [@SvenVw](https://github.com/SvenVw)! - Add docs about connecting to KvK

- [#887](https://github.com/nmi-agro/fdm/pull/887) [`4bbebb3`](https://github.com/nmi-agro/fdm/commit/4bbebb3ccf1f6269a562165f901e69b277584887) Thanks [@SvenVw](https://github.com/SvenVw)! - Restore the full API reference. After TypeDoc switched to `NodeNext` module resolution, the package entry points could not resolve their re-exports, so most functions and types were missing from the Reference section. The API reference build now fails on type errors instead of silently leaving out symbols it cannot resolve.

- [#868](https://github.com/nmi-agro/fdm/pull/868) [`4f209c9`](https://github.com/nmi-agro/fdm/commit/4f209c969a41b26a67411a8ffc7ab342f244e196) Thanks [@octavianchiriac-agro](https://github.com/octavianchiriac-agro)! - Corrected the displayed units and names of several soil parameters to match the NMI parameter definitions: `a_c_of` is now shown in g C/kg and `a_n_rt` in mg N/kg, `a_mg_co` uses the same "mmol+/kg" notation as `a_ca_co` and `a_k_co`, and these three exchangeable cations are now labelled "uitwisselbaar" instead of "totale bodemvoorraad". The input range for `a_ca_co_po` is limited to 1–100 %. Bulk density is documented in g/cm³ throughout the calculator.

- [#864](https://github.com/nmi-agro/fdm/pull/864) [`658e02e`](https://github.com/nmi-agro/fdm/commit/658e02ebb07ed7b99857afb308e19ca81a96d733) Thanks [@SvenVw](https://github.com/SvenVw)! - Describe how the period-based nitrogen usage norm for temporary grassland (`Tijdelijk grasland`) and the sowing-date rule for grass for industrial processing (`Gras voor industriële verwerking`) are applied in the 2025 and 2026 nitrogen usage norm documentation. State that the 2026 grassland renewal and destruction reductions apply only on sand and loess. List consumption and seed potato grow-out with haulm destruction after 15 August (`loofvernietiging na 15 augustus`) as not implemented.

## 0.14.0

### Minor Changes

- [#735](https://github.com/nmi-agro/fdm/pull/735) [`69ba843`](https://github.com/nmi-agro/fdm/commit/69ba843bf4a8b1747972b05736194abb9ee54804) Thanks [@SvenVw](https://github.com/SvenVw)! - Add more information about how the fdm data schema works and can be expanded

- [#753](https://github.com/nmi-agro/fdm/pull/753) [`46f75be`](https://github.com/nmi-agro/fdm/commit/46f75be1e49db2a84a3e9f6543fed569cbade4f2) Thanks [@SvenVw](https://github.com/SvenVw)! - Update 2025 and 2026 Dutch nitrogen usage norm (`stikstofgebruiksruimte`) documentation:

  - Document per-teelt accumulation and volgteelt rules per RVO Tabel 2.
  - Document footnote 7a green manure conditions and footnote 2/6 maize exclusions.
  - Document hoofdgewas definition (longest presence in 15 May – 15 July window).
  - Document intentional crop code mappings (quinoa to spinach volgteelt, grass catch crops to grass seed rows, nature/fallow to 0 kg N/ha).
  - Add explicit out-of-scope / not-yet-implemented section covering yield-based norm increases (stikstofdifferentiatie / art. 28c Urm Tabel 1a), French-fry potatoes on clay (Tabel 2a), grass seed with fodder cut, grass seed stubble destruction (footnote 7b), mixed cropping/undersowing, fixed farm norm (footnote 9), and two-year winter crop budget splits (footnote 5/18).

- [#753](https://github.com/nmi-agro/fdm/pull/753) [`63e93f9`](https://github.com/nmi-agro/fdm/commit/63e93f9504cab01560ff7d5f2aa9e1bbd81e8a9c) Thanks [@SvenVw](https://github.com/SvenVw)! - Add documentation about the 2026 fertilizer application norms in the Netherlands and extend the 2025 documentation about catch crops and winter crops

## 0.13.1

### Patch Changes

- [#693](https://github.com/nmi-agro/fdm/pull/693) [`4670727`](https://github.com/nmi-agro/fdm/commit/4670727b0c0f2a32b3c4e577acb119e9fe9651a0) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate to TypeScript V7. However keep TypeScript V6 for typedoc as V7 does not expose the API that typedocs needs (will probably be included in TypeScript V7.1).

- [#660](https://github.com/nmi-agro/fdm/pull/660) [`5da4dc5`](https://github.com/nmi-agro/fdm/commit/5da4dc5445c6c4613dcab9e8a78ce9ccff4867ad) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate for linting and formatting from Biome to oxlint and oxfmt

## 0.13.0

### Minor Changes

- [#636](https://github.com/nmi-agro/fdm/pull/636) [`98e0127`](https://github.com/nmi-agro/fdm/commit/98e0127bd3f02e193ad57a1cfef18fc10df40c67) Thanks [@SvenVw](https://github.com/SvenVw)! - Add section about setting up certificates for signing in with Microsoft

## 0.12.0

### Minor Changes

- [#611](https://github.com/nmi-agro/fdm/pull/611) [`8f1bb7d`](https://github.com/nmi-agro/fdm/commit/8f1bb7d4e31d4030fe8b237870362513dee01531) Thanks [@SvenVw](https://github.com/SvenVw)! - Add REST API documentation section

  Introduces `docs/rest-api/` in `fdm-docs` covering the contract baseline for the new FDM public REST API:
  - **Overview** — target audience (first-party automation, trusted partners, public integrations), compatibility policy (no `/v1`, follows `fdm-core`), FDM-native field names, and the existing internal routes that remain unchanged.
  - **Authentication** — user-owned API keys, `X-API-Key` and `Authorization: Bearer` header support, ambiguity rejection when both headers are present, key lifecycle (active/revoked/expired), rotation guidance, and leaked-key incident response.
  - **Authorization** — effective access model (API key inherits owning user's FDM access), role-based permissions (`owner`/`advisor`/`researcher`), organization-membership access path, membership-removal behaviour, and `audit_channel` tagging.
  - **Limits & Pagination** — 5 MB JSON body limit, 10,000-coordinate GeoJSON limit, per-key rate limits (120 general / 30 write / 10 calculation requests per minute), and offset-based pagination with defaults (limit 50, max 200).
  - **Errors** — RFC 7807 Problem Details format, full error catalog (400–500), and examples for validation, not-found, and internal-error responses.
  - **Endpoints** — endpoint tables with `fdm-core` mappings and example requests/responses for farms, fields, cultivations, soil analyses, and calculation endpoints.
  - **Delete Semantics** — hard-delete behavior and exact cascade chains for `removeFarm`, `removeField`, `removeCultivation`, and `removeSoilAnalysis`, sourced directly from `fdm-core` implementation.

## 0.11.1

### Patch Changes

- [#557](https://github.com/nmi-agro/fdm/pull/557) [`fa0fc06`](https://github.com/nmi-agro/fdm/commit/fa0fc06516ec743dd29b285c020e501c98d5868b) Thanks [@SvenVw](https://github.com/SvenVw)! - Bump to TypeScript V6

## 0.11.0

### Minor Changes

- [#374](https://github.com/nmi-agro/fdm/pull/374) [`81dd1b6`](https://github.com/nmi-agro/fdm/commit/81dd1b684fb10f188ebfb7aa769c4027c69f991f) Thanks [@SvenVw](https://github.com/SvenVw)! - Add the reference for fdm-rvo

- [#534](https://github.com/nmi-agro/fdm/pull/534) [`2c9d6e9`](https://github.com/nmi-agro/fdm/commit/2c9d6e9fea5a2eabab44ca4bf67951825a3b6aa5) Thanks [@SvenVw](https://github.com/SvenVw)! - Add documentation section for `fdm-agents`, covering the Gerrit fertilizer application planner agent: architecture (Reasoner-Verifier), usage examples, planning strategies, security model, and future expansion plans.

### Patch Changes

- [#535](https://github.com/nmi-agro/fdm/pull/535) [`6b00be9`](https://github.com/nmi-agro/fdm/commit/6b00be9c0999b3510a3af86b64d2002ee66ecc1b) Thanks [@SvenVw](https://github.com/SvenVw)! - Set minimum node.js version to v24

## 0.10.0

### Minor Changes

- [#470](https://github.com/nmi-agro/fdm/pull/470) [`70f85ae`](https://github.com/nmi-agro/fdm/commit/70f85aee2792d004e001bf4e71718042b548036c) Thanks [@SvenVw](https://github.com/SvenVw)! - Add invitations to the page about Authorization

### Patch Changes

- [#474](https://github.com/nmi-agro/fdm/pull/474) [`5579ab3`](https://github.com/nmi-agro/fdm/commit/5579ab3674d963e194aa8295b706266f591cbb45) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate organization from `SvenVw` to `nmi-agro`

## 0.9.1

### Patch Changes

- [#415](https://github.com/nmi-agro/fdm/pull/415) [`3675792`](https://github.com/nmi-agro/fdm/commit/36757922dd4e71d4767defd906d2a986757d09f5) Thanks [@SvenVw](https://github.com/SvenVw)! - Updated 2025 nitrogen usage norm documentation to include grassland renewal and destruction reduction rules.

## 0.9.0

### Minor Changes

- ec38fe3: Add an page to core concepts about how harvests work in FDM
- b79086d: Add explanation of how the calculation for nitrate leaching works
- 1da9360: Extend the pages about core-concepts of FDM, update schema description and reorganize the docs
- 86c958a: Add page about the calculation of the organic matter balance

### Patch Changes

- 887ead3: Upgrade to Node.js v24

## 0.8.0

### Minor Changes

- 6ee8422: Update and extend the documentation for 2025 Dutch Fertilizer Application Norms, e.g. explaining how filling is calculated

## 0.7.0

### Minor Changes

- 9cf8827: Update the explanation of how mineralization is calculated in the nitrogen balance: use default values instead of MINIP calculations.
- eb59f37: Update the nitrogen balance description to reflect replacing "volatilization" with "emission".

## 0.6.1

### Patch Changes

- 07392e0: Fix broken link to documentation website at July 2025 Release Notes blog post

## 0.6.0

### Minor Changes

- f78d85e: Add explanation of how Dutch legal norms are calculated with fdm-calculator

### Patch Changes

- db5e7fe: Update dependencies

## 0.5.0

### Minor Changes

- bfcd788: Update database tables description to be up-to-date with the definitions in `fdm-core`
- c865f44: Add documentation explaining ammonia-emission calculation in the nitrogen-balance section.

### Patch Changes

- 14e57e6: Update to react 19

## 0.4.0

### Minor Changes

- 6305c52: Add documentation for nitrogen balance calculation

## 0.3.0

### Minor Changes

- e1fa278: Add autogenerated reference documentation for `fdm-core`, `fdm-data` and `fdm-calculator` based on TypeDoc to the documentation
- e1fa278: Revised the documentation, made it up to date and included complete description of database tables

## 0.2.2

### Patch Changes

- Replace ESLint with Biome and format the code accordingly

## 0.2.1

### Patch Changes

- Rename to `@nmi-agro/fdm-docs` to be consistent in naming with the other packages
- Use the same version for `vite`, `typescript` and `dotenvx` across packages and update those to the latest version

## 0.2.0

### Minor Changes

- Restructure the docs and add a getting started guide

## 0.1.4

### Patch Changes

- 7edc605: Upgrade to docusaurus v3.6 and enable docusaurus/faster

## 0.1.3

### Patch Changes

- 6694029: Upgrade `pnpm` to 9.14.2

## 0.1.2

### Patch Changes

- b357b4c: Trigger test and publish for fdm-docs only if change is made in fdm-docs

## 0.1.1

### Patch Changes

- Fix deployment to GitHub Pages

## 0.1.0

### Minor Changes

- Setup a documentation website for fdm
