# @nmi-agro/fdm-rvo

## 0.3.0

### Minor Changes

- [#644](https://github.com/nmi-agro/fdm/pull/644) [`1e74b1a`](https://github.com/nmi-agro/fdm/commit/1e74b1ac76a0eec217020459a473c2449bb29da3) Thanks [@SvenVw](https://github.com/SvenVw)! - Add function `validateShapefileYear` to check whether has no fields with a starting date greater than selected year

### Patch Changes

- [#634](https://github.com/nmi-agro/fdm/pull/634) [`afdd78f`](https://github.com/nmi-agro/fdm/commit/afdd78f16fad2aef17e03e4eace48628ef7a2d51) Thanks [@SvenVw](https://github.com/SvenVw)! - Resolve all TypeScript errors in `fdm-app`, making it fully type-safe. Includes `MultiPolygon` support in `fdm-core` schema types and geometry fixes in `fdm-rvo`.

- Updated dependencies [[`98e0127`](https://github.com/nmi-agro/fdm/commit/98e0127bd3f02e193ad57a1cfef18fc10df40c67), [`afdd78f`](https://github.com/nmi-agro/fdm/commit/afdd78f16fad2aef17e03e4eace48628ef7a2d51), [`98edeca`](https://github.com/nmi-agro/fdm/commit/98edecaebdd50ae8f0e26980cc2fc9c642e3cad9)]:
  - @nmi-agro/fdm-core@0.34.0

## 0.2.3

### Patch Changes

- Updated dependencies [[`8e454a3`](https://github.com/nmi-agro/fdm/commit/8e454a3d9af12a66b7f13ae0dd7d5e72c2d0a857), [`df22bcb`](https://github.com/nmi-agro/fdm/commit/df22bcb2516cfb04cfe97ab6f490e9a003a67ff5), [`c30057e`](https://github.com/nmi-agro/fdm/commit/c30057ea07f4646bd588d93a1eba894733076dae), [`e12afe4`](https://github.com/nmi-agro/fdm/commit/e12afe49ad898412dfe12f487b6a4ca46c57c66f)]:
  - @nmi-agro/fdm-core@0.33.0

## 0.2.2

### Patch Changes

- [#557](https://github.com/nmi-agro/fdm/pull/557) [`fa0fc06`](https://github.com/nmi-agro/fdm/commit/fa0fc06516ec743dd29b285c020e501c98d5868b) Thanks [@SvenVw](https://github.com/SvenVw)! - Bump to TypeScript V6

- [#559](https://github.com/nmi-agro/fdm/pull/559) [`1d8bbf1`](https://github.com/nmi-agro/fdm/commit/1d8bbf18f00b237dfd99272b9a0662d352d27d53) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate from rollup to tsdown

- Updated dependencies [[`fa0fc06`](https://github.com/nmi-agro/fdm/commit/fa0fc06516ec743dd29b285c020e501c98d5868b), [`e396027`](https://github.com/nmi-agro/fdm/commit/e396027e4422b0dbb402ed7d965d155c7c79424c), [`3ce3f81`](https://github.com/nmi-agro/fdm/commit/3ce3f81256b84d1311b1ffda2eeabd9785f48964), [`b278794`](https://github.com/nmi-agro/fdm/commit/b278794c06af35ce5996965f6bfa020332e6270f), [`7d01bfc`](https://github.com/nmi-agro/fdm/commit/7d01bfcebb3e17dfa16217d462012976dff034d9), [`1d8bbf1`](https://github.com/nmi-agro/fdm/commit/1d8bbf18f00b237dfd99272b9a0662d352d27d53)]:
  - @nmi-agro/fdm-core@0.32.0

## 0.2.1

### Patch Changes

- [#564](https://github.com/nmi-agro/fdm/pull/564) [`585a38a`](https://github.com/nmi-agro/fdm/commit/585a38a9df86ba0e2b8b6a20ac1e3acaff077efd) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix `exchangeToken` to return `tokenResponse.access_token` (was returning `unknown` via the wrong camelCase property)

## 0.2.0

### Minor Changes

- [#374](https://github.com/nmi-agro/fdm/pull/374) [`b57842f`](https://github.com/nmi-agro/fdm/commit/b57842f9c8217867057a76c8c10766048bf1e6a2) Thanks [@SvenVw](https://github.com/SvenVw)! - Initial version of `fdm-rvo` that provides the logic for fdm-app to connect to RVO and sync fields with fdm-core

### Patch Changes

- Updated dependencies [[`ae7d3c9`](https://github.com/nmi-agro/fdm/commit/ae7d3c98be19fb2cd3abf8b5de37f0e5312fd557), [`69122ba`](https://github.com/nmi-agro/fdm/commit/69122ba66cdb6eb791e0fb51acd0f042d8ac7a71), [`0f359ad`](https://github.com/nmi-agro/fdm/commit/0f359adc81efdac957fadab687ac1d61c8ddfc05), [`6b00be9`](https://github.com/nmi-agro/fdm/commit/6b00be9c0999b3510a3af86b64d2002ee66ecc1b), [`21ef50a`](https://github.com/nmi-agro/fdm/commit/21ef50aa3c9e2b59366b1d27183cf9306c8dbe33), [`2fb53de`](https://github.com/nmi-agro/fdm/commit/2fb53dee72bee18b6db11de2939699e2d567f336)]:
  - @nmi-agro/fdm-core@0.31.0
