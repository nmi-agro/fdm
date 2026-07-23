# @nmi-agro/fdm-api

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
