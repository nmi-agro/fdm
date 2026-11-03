# @nmi-agro/fdm-api

## 0.3.0

### Minor Changes

- [#829](https://github.com/nmi-agro/fdm/pull/829) [`641f7d7`](https://github.com/nmi-agro/fdm/commit/641f7d70815e82a4c3c70ee8de36823bdea7cb8a) Thanks [@SvenVw](https://github.com/SvenVw)! - Add a Changelog page to the API reference, shown directly below the introduction. It is written in `src/changelog.md`, which is copied to `dist` during the build, and lists notable API changes for API users.

- [#873](https://github.com/nmi-agro/fdm/pull/873) [`e4ac9ad`](https://github.com/nmi-agro/fdm/commit/e4ac9ad7d4d2efc0aa43e2595c3f9c3a75ff56ac) Thanks [@octavianchiriac-agro](https://github.com/octavianchiriac-agro)! - Add the optional query parameter `effective_nitrogen` to `GET /farms/{b_id_farm}/calculations/nitrogen-balance` and `GET /fields/{b_id}/calculations/nitrogen-balance`. With `effective_nitrogen=true`, the nitrogen balance is calculated with effective nitrogen and MINIP mineralization, and the `target` is omitted from the response because it only applies to the balance with total nitrogen. The default remains the balance with total nitrogen.

- [#832](https://github.com/nmi-agro/fdm/pull/832) [`fd705d4`](https://github.com/nmi-agro/fdm/commit/fd705d46a9923b56a6b255300b44fc6ee587eea7) Thanks [@SvenVw](https://github.com/SvenVw)! - Add farm group endpoints: `GET`/`POST /organizations/{organization_id}/farm-groups`, `GET`/`PATCH`/`DELETE /farm-groups/{b_id_group}`, and `POST /farm-groups/{b_id_group}/farms` and `DELETE /farm-groups/{b_id_group}/farms/{b_id_farm}` to add farms and end their membership, and `PATCH /farm-groups/{b_id_group}/farms/{b_id_farm}/{b_group_joined}` to update the join date and/or end date of a period, and `DELETE /farm-groups/{b_id_group}/farms/{b_id_farm}/{b_group_joined}` to delete a period as if the farm never was part of the group in it. The optional dates `b_group_joined` and `b_group_leaved` set from and until when a farm is part of a group. `GET /farms` accepts a `b_id_group` query parameter.

- [#829](https://github.com/nmi-agro/fdm/pull/829) [`1821195`](https://github.com/nmi-agro/fdm/commit/1821195fa5fb7579b8cdfc82661a906dbf01f06b) Thanks [@SvenVw](https://github.com/SvenVw)! - Add read-only indicator endpoints: `GET /fields/{b_id}/indicators`, `GET /farms/{b_id_farm}/indicators` (area-weighted farm scores) and `GET /fields/{b_id}/measures/catalogue` (field measure options with applicability, predicted impacts and recommendations). These endpoints use a new `nmi` rate-limit bucket (10 requests per minute per key), counted instead of the `general` bucket. The API reference marks these operations with a "New" badge. When indicator results are unavailable, the endpoints return a generic 503; the underlying cause is logged server-side under the same `error_id` as the response.

- [#881](https://github.com/nmi-agro/fdm/pull/881) [`feeea94`](https://github.com/nmi-agro/fdm/commit/feeea943853f8ef0b36e10ef48de2a159fa63cb6) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Removed the /farms/{b_id_farm}/fertilizer-catalogue endpoint. Use /farms/{b_id_farm}/catalogues/fertilizer instead.

- [#881](https://github.com/nmi-agro/fdm/pull/881) [`0ae30e9`](https://github.com/nmi-agro/fdm/commit/0ae30e94aba841a757d402bbb92e5b10968d3e43) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Add read-only endpoints for the cultivation, fertilizer and field measure catalogues:

  - `GET /catalogues` lists the available catalogues and their `source` codes.
  - `GET /farms/{b_id_farm}/catalogues/{cultivation|fertilizer|measure}` lists the catalogues enabled on a farm.
  - `GET /farms/{b_id_farm}/catalogues/{cultivation|fertilizer|measure}/items` lists the items in the enabled catalogues, or in one catalogue with the optional `source` query parameter, paginated with `limit` and `offset`. Returns `404` when the catalogue is not enabled on the farm.

  `POST /farms` now enables the default catalogues (`baat` and the farm's own fertilizers, `brp` cultivations and `bln` field measures) and adds the catalogue fertilizers to the farm's fertilizer list, all in the same transaction as the farm itself. Farms created through the API can therefore be used for cultivations, fertilizer applications and measures right away.

### Patch Changes

- [#875](https://github.com/nmi-agro/fdm/pull/875) [`ab316a7`](https://github.com/nmi-agro/fdm/commit/ab316a75bba36d412fea4686a2214b65f6fb741e) Thanks [@octavianchiriac-agro](https://github.com/octavianchiriac-agro)! - `GET /fields/{b_id}/measures/catalogue` recommends at most one variant per measure (IDs that differ only in a trailing lowercase letter, such as `bln_BM56b` and `bln_BM56c`) and no variant when another variant of that measure is already adopted on the field. A variant that is not selectable (for example because it conflicts with an adopted measure) no longer hides a selectable variant of the same measure. The API reference and changelog describe this.

- [#870](https://github.com/nmi-agro/fdm/pull/870) [`fdad56f`](https://github.com/nmi-agro/fdm/commit/fdad56f8f24e47a68322272c0e201780dbd59a57) Thanks [@SvenVw](https://github.com/SvenVw)! - Remove the disabled, commented-out mineralization endpoints, which depended on calculator functions that no longer exist.
- Updated dependencies [[`2d9da29`](https://github.com/nmi-agro/fdm/commit/2d9da29dcf294ad8817ce8095fe02a178f49ea67), [`05fcc10`](https://github.com/nmi-agro/fdm/commit/05fcc106e6bf1c5018c436c0d33f296a75f137ba), [`cc8a891`](https://github.com/nmi-agro/fdm/commit/cc8a89101cb6a573a3822be02ced6d17224d54fa), [`23d5b19`](https://github.com/nmi-agro/fdm/commit/23d5b19b517523ac206ac528ef59abbb5e9f144f), [`cf1fb25`](https://github.com/nmi-agro/fdm/commit/cf1fb25994f3d8485410e826fc4220143acd4050), [`2e0ab65`](https://github.com/nmi-agro/fdm/commit/2e0ab65ac95fac055d38d494ee08aac366a11eeb), [`1970cef`](https://github.com/nmi-agro/fdm/commit/1970cef75abba6dd5c831a7a70b71c27d043689b), [`d8b1b60`](https://github.com/nmi-agro/fdm/commit/d8b1b602987a3d10448b94dbc3bd66805ef192bd), [`fdad56f`](https://github.com/nmi-agro/fdm/commit/fdad56f8f24e47a68322272c0e201780dbd59a57), [`8498cbc`](https://github.com/nmi-agro/fdm/commit/8498cbce7096b00e466225cbd8b9a2c57bb702e9), [`fa57acb`](https://github.com/nmi-agro/fdm/commit/fa57acb13cb01e8e896661d01cbe3099f150552e), [`4f209c9`](https://github.com/nmi-agro/fdm/commit/4f209c969a41b26a67411a8ffc7ab342f244e196), [`0e9b593`](https://github.com/nmi-agro/fdm/commit/0e9b593b0080553b243d23f68bf56d972d651eda), [`b8d12f1`](https://github.com/nmi-agro/fdm/commit/b8d12f19fd2c7cb859ed500dd01115e24a8b5ebc), [`f7c4ff2`](https://github.com/nmi-agro/fdm/commit/f7c4ff2f57048bb0d5e88a90c2e7d85294ab9d7b)]:
  - @nmi-agro/fdm-calculator@0.20.0
  - @nmi-agro/fdm-core@0.39.0

## 0.2.9

### Patch Changes

- [#852](https://github.com/nmi-agro/fdm/pull/852) [`83f37d5`](https://github.com/nmi-agro/fdm/commit/83f37d5594d6359c6f557a6f4f6456a2fe640148) Thanks [@SvenVw](https://github.com/SvenVw)! - Document that `b_end` and `m_end` are the last day a field is managed or a measure is applied (inclusive, Europe/Amsterdam), and that an end date on 1 January is returned as 31 December of the previous year.

  Dates in API responses are now serialised as their calendar date in Europe/Amsterdam instead of UTC, so a date stored at midnight in Europe/Amsterdam is no longer returned as the previous day. Updating a field without `b_end` now leaves its stored end date untouched.

- Updated dependencies [[`702c643`](https://github.com/nmi-agro/fdm/commit/702c643678d15caae37cffd7a1497c0ce73954ad)]:
  - @nmi-agro/fdm-core@0.38.1
  - @nmi-agro/fdm-calculator@0.19.3

## 0.2.8

### Patch Changes

- Updated dependencies [[`8cc7fb3`](https://github.com/nmi-agro/fdm/commit/8cc7fb3e92dc47d79d3f768de4e148c9f5346c59)]:
  - @nmi-agro/fdm-calculator@0.19.3

## 0.2.7

### Patch Changes

- Updated dependencies [[`7608c10`](https://github.com/nmi-agro/fdm/commit/7608c10a111481871140399a35f5e7f39bd4ecdf)]:
  - @nmi-agro/fdm-calculator@0.19.2

## 0.2.6

### Patch Changes

- Updated dependencies [[`ac78820`](https://github.com/nmi-agro/fdm/commit/ac7882026875aad8147b7a03ad094a36fa02fe52), [`4eb2599`](https://github.com/nmi-agro/fdm/commit/4eb25999b4eaab2fed1079eb9c59dee7d2e82b7a)]:
  - @nmi-agro/fdm-core@0.38.0
  - @nmi-agro/fdm-calculator@0.19.1

## 0.2.5

### Patch Changes

- Updated dependencies [[`e9da046`](https://github.com/nmi-agro/fdm/commit/e9da046dac5e807e04374cb9f9f2c757eff1ea5f), [`3e3230c`](https://github.com/nmi-agro/fdm/commit/3e3230cc91e57e2abc3e3df7081700391f58038b), [`c5286b4`](https://github.com/nmi-agro/fdm/commit/c5286b4098cb76633c5032fb02013f4f4390a8cf), [`85457b3`](https://github.com/nmi-agro/fdm/commit/85457b3c39d1d4e729c89d8f7838854e4edc64d2), [`42beda5`](https://github.com/nmi-agro/fdm/commit/42beda51e13e28b4294c30a001646e17873e73be), [`0b481fb`](https://github.com/nmi-agro/fdm/commit/0b481fb25ff5a66bfeed2461dc1a2620287a5ff9), [`c5286b4`](https://github.com/nmi-agro/fdm/commit/c5286b4098cb76633c5032fb02013f4f4390a8cf), [`da715c6`](https://github.com/nmi-agro/fdm/commit/da715c6e142a35c8a4b5d0ffe47fc18e2df84cc1), [`b1e8cfd`](https://github.com/nmi-agro/fdm/commit/b1e8cfda34f1f36c75460982ee4b977bc01ec5b0)]:
  - @nmi-agro/fdm-calculator@0.19.0
  - @nmi-agro/fdm-core@0.37.0

## 0.2.4

### Patch Changes

- [#693](https://github.com/nmi-agro/fdm/pull/693) [`30f2748`](https://github.com/nmi-agro/fdm/commit/30f274831dfcc0b8404046e2e8c103e8d48e28a6) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate to TypeScript V7

- [#660](https://github.com/nmi-agro/fdm/pull/660) [`5da4dc5`](https://github.com/nmi-agro/fdm/commit/5da4dc5445c6c4613dcab9e8a78ce9ccff4867ad) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate for linting and formatting from Biome to oxlint and oxfmt

- Updated dependencies [[`f8ca5b6`](https://github.com/nmi-agro/fdm/commit/f8ca5b6fa0ef4ee109d919e4865e27e797299160), [`af8cf53`](https://github.com/nmi-agro/fdm/commit/af8cf53a82a2c3525c56977f2746c742d04cfdb7), [`30f2748`](https://github.com/nmi-agro/fdm/commit/30f274831dfcc0b8404046e2e8c103e8d48e28a6), [`9688dd1`](https://github.com/nmi-agro/fdm/commit/9688dd18bd247283d87f8b7d12a049291d5ffd9f), [`bb689c9`](https://github.com/nmi-agro/fdm/commit/bb689c922ed81bd90f8b26dfb18313f655a69cad), [`5bdd718`](https://github.com/nmi-agro/fdm/commit/5bdd718665ff0e549d12aeefc8e99ad6e7add5d8), [`def7e8f`](https://github.com/nmi-agro/fdm/commit/def7e8f6b378cf7b9dfd89ac15e630116cd113be), [`5aa2d57`](https://github.com/nmi-agro/fdm/commit/5aa2d57759cbae2e44b56f88f961f58cb8146a3a), [`130a468`](https://github.com/nmi-agro/fdm/commit/130a468f037f46466f116f1106a70399f3101fcb), [`94e073f`](https://github.com/nmi-agro/fdm/commit/94e073f935c05413f12cf37cadacdfec63ac8a6d), [`c2cdeb0`](https://github.com/nmi-agro/fdm/commit/c2cdeb02703a94409106fa0c54c97e26471aa46f), [`5da4dc5`](https://github.com/nmi-agro/fdm/commit/5da4dc5445c6c4613dcab9e8a78ce9ccff4867ad), [`7a774d6`](https://github.com/nmi-agro/fdm/commit/7a774d604ed390c682672bf3afc6cf6d3f411027)]:
  - @nmi-agro/fdm-calculator@0.18.0
  - @nmi-agro/fdm-core@0.36.0

## 0.2.3

### Patch Changes

- Updated dependencies [[`845197e`](https://github.com/nmi-agro/fdm/commit/845197e28776b331f6d44e0eb64dc144e786f8f3)]:
  - @nmi-agro/fdm-core@0.35.0
  - @nmi-agro/fdm-calculator@0.17.1

## 0.2.2

### Patch Changes

- Updated dependencies [[`d4e5c73`](https://github.com/nmi-agro/fdm/commit/d4e5c73fad558934c30a1534972cd6118ff2886a)]:
  - @nmi-agro/fdm-calculator@0.17.0
  - @nmi-agro/fdm-core@0.34.1

## 0.2.1

### Patch Changes

- [#656](https://github.com/nmi-agro/fdm/pull/656) [`7957f3a`](https://github.com/nmi-agro/fdm/commit/7957f3a40a9c9fe582f40b686444f0bea92cd2f9) Thanks [@SvenVw](https://github.com/SvenVw)! - Return 404 for all paths that don't match a registered route, before authentication runs.

  Previously, requests to non-existent paths (e.g. from bot scanners hitting `/credentials.json`) would trigger the auth middleware — including a database lookup — and generate a `console.warn` log entry with `status=401`. Now a new `createPathExistenceGuard` middleware short-circuits these requests with a 404 RFC 9457 response and a `console.debug` log, with no auth DB lookup.

- Updated dependencies [[`98e0127`](https://github.com/nmi-agro/fdm/commit/98e0127bd3f02e193ad57a1cfef18fc10df40c67), [`afdd78f`](https://github.com/nmi-agro/fdm/commit/afdd78f16fad2aef17e03e4eace48628ef7a2d51), [`c07e18c`](https://github.com/nmi-agro/fdm/commit/c07e18c7bc178a7c052fcdde0db30a56d508587a), [`98edeca`](https://github.com/nmi-agro/fdm/commit/98edecaebdd50ae8f0e26980cc2fc9c642e3cad9), [`98edeca`](https://github.com/nmi-agro/fdm/commit/98edecaebdd50ae8f0e26980cc2fc9c642e3cad9)]:
  - @nmi-agro/fdm-core@0.34.0
  - @nmi-agro/fdm-calculator@0.16.0

## 0.2.0

### Minor Changes

- [#611](https://github.com/nmi-agro/fdm/pull/611) [`d2ec5cb`](https://github.com/nmi-agro/fdm/commit/d2ec5cb5621a8de8ad00bde8afd437f84cc10ece) Thanks [@SvenVw](https://github.com/SvenVw)! - Add calculation endpoints for balances, norms, nutrient advice to fdm-api

- [#611](https://github.com/nmi-agro/fdm/pull/611) [`14fa569`](https://github.com/nmi-agro/fdm/commit/14fa5694f0b18c917a98ac1f2ab1e8b151131372) Thanks [@SvenVw](https://github.com/SvenVw)! - Initial release

  A new package that hosts the FDM REST API. The Hono-based API is created via `createFdmApi(fdm, auth, config)` and can be mounted in any host application. Includes API key authentication, RFC 7807 error responses, request guards, per-key rate limiting, an OpenAPI 3.1 specification, and interactive API documentation.

- [#611](https://github.com/nmi-agro/fdm/pull/611) [`06f8b12`](https://github.com/nmi-agro/fdm/commit/06f8b129d424d13c8f5e5b4fb226aa01ab6aa9a5) Thanks [@SvenVw](https://github.com/SvenVw)! - Expose all fdm-core domain functions as REST endpoints in fdm-api

### Patch Changes

- Updated dependencies [[`8e454a3`](https://github.com/nmi-agro/fdm/commit/8e454a3d9af12a66b7f13ae0dd7d5e72c2d0a857), [`df22bcb`](https://github.com/nmi-agro/fdm/commit/df22bcb2516cfb04cfe97ab6f490e9a003a67ff5), [`c09b5bf`](https://github.com/nmi-agro/fdm/commit/c09b5bf87af13c2b9cb6f1200c7e293492a12a8c), [`be2f3ae`](https://github.com/nmi-agro/fdm/commit/be2f3aebd1816b832d9915bf1b7f961b16f18585), [`c30057e`](https://github.com/nmi-agro/fdm/commit/c30057ea07f4646bd588d93a1eba894733076dae), [`f243894`](https://github.com/nmi-agro/fdm/commit/f243894ee8f0fe9e64d313d64a0008a7703c1f49), [`e12afe4`](https://github.com/nmi-agro/fdm/commit/e12afe49ad898412dfe12f487b6a4ca46c57c66f)]:
  - @nmi-agro/fdm-core@0.33.0
  - @nmi-agro/fdm-calculator@0.15.0
