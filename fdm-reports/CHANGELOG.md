# @nmi-agro/fdm-reports

## 0.1.1

### Patch Changes

- [#988](https://github.com/nmi-agro/fdm/pull/988) [`33b59b0`](https://github.com/nmi-agro/fdm/commit/33b59b0c7e3b61cc061fe69eb9f5369be0e8d072) Thanks [@SvenVw](https://github.com/SvenVw)! - The fertilizer plan includes the legal application norms for 2027 (provisional, the same rules as 2026).

  The norms in the fertilizer plan now use the norm input that the calculator collects for the plan year. That input also holds the cultivations of the previous year, so the previous-year rules (catch crop and winter crop) see the previous season, and the harvests, so crops with a norm for multiple harvests ("meermalige oogst") are no longer calculated as harvested once. The norms and the fillings of a plan use the same grazing intention.

- Updated dependencies [[`33b59b0`](https://github.com/nmi-agro/fdm/commit/33b59b0c7e3b61cc061fe69eb9f5369be0e8d072)]:
  - @nmi-agro/fdm-calculator@0.22.0

## 0.1.0

### Minor Changes

- [#916](https://github.com/nmi-agro/fdm/pull/916) [`971f138`](https://github.com/nmi-agro/fdm/commit/971f138a51fe4a3fa02b77d6c00930a81adf4fd1) Thanks [@SvenVw](https://github.com/SvenVw)! - New package with the yearly fertilizer plan (bemestingsplan): collecting its data, calculating it, rendering the PDF, storing it (`establishFertilizerPlan`) and checking whether a saved plan still matches the current data (`createFertilizerPlanStatusChecker`). The PDF is uploaded before the plan is saved, so a plan always has a file. A field whose usage norms cannot be calculated is shown with an error, and the rest of the plan is still made. The input hash includes the version of this package and of fdm-calculator, so plans are reported as outdated when the calculation changes.

- [#973](https://github.com/nmi-agro/fdm/pull/973) [`8ca24d1`](https://github.com/nmi-agro/fdm/commit/8ca24d1702ca08556173f8cd341dac837977120c) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Require Node.js 26 or higher (`engines.node` is now `>=26.0.0`) and build for the `node26` target.

### Patch Changes

- [#945](https://github.com/nmi-agro/fdm/pull/945) [`7ff6748`](https://github.com/nmi-agro/fdm/commit/7ff67483a033d2b92f4015d8eaa630490cbb885e) Thanks [@octavianchiriac-agro](https://github.com/octavianchiriac-agro)! - The organic matter balance in the fertilizer plan report now uses the most recent soil data per parameter up to the end of the year, also from analyses sampled before that year.

- [#959](https://github.com/nmi-agro/fdm/pull/959) [`97d64f0`](https://github.com/nmi-agro/fdm/commit/97d64f08103a4e5978ecb3305e76651c36cc3018) Thanks [@SvenVw](https://github.com/SvenVw)! - The fertilizer plan looks up the cached usage norms, fillings, nutrient advice and organic matter balance of all fields with one query per calculation instead of one per field. The fields are listed in the order of the farm's fields.
- Updated dependencies [[`971f138`](https://github.com/nmi-agro/fdm/commit/971f138a51fe4a3fa02b77d6c00930a81adf4fd1), [`971f138`](https://github.com/nmi-agro/fdm/commit/971f138a51fe4a3fa02b77d6c00930a81adf4fd1), [`971f138`](https://github.com/nmi-agro/fdm/commit/971f138a51fe4a3fa02b77d6c00930a81adf4fd1), [`7ff6748`](https://github.com/nmi-agro/fdm/commit/7ff67483a033d2b92f4015d8eaa630490cbb885e), [`97d64f0`](https://github.com/nmi-agro/fdm/commit/97d64f08103a4e5978ecb3305e76651c36cc3018), [`97d64f0`](https://github.com/nmi-agro/fdm/commit/97d64f08103a4e5978ecb3305e76651c36cc3018), [`e33bc95`](https://github.com/nmi-agro/fdm/commit/e33bc95a03a642c9c348289810db6bd22f135732), [`55ae6ba`](https://github.com/nmi-agro/fdm/commit/55ae6ba549684808aa83aba0ea0f446c82fad64b), [`2b531e7`](https://github.com/nmi-agro/fdm/commit/2b531e7314856701cf8b4117da44a3e21d562636), [`fd9d527`](https://github.com/nmi-agro/fdm/commit/fd9d527a438690728dc2331230a45ec181bef400), [`9a8d4e0`](https://github.com/nmi-agro/fdm/commit/9a8d4e0fa0af4567ecb0fbed6d270ebb178a9941), [`104576e`](https://github.com/nmi-agro/fdm/commit/104576e826ff758b74250b3edb132204b557c6c5), [`0d3b76d`](https://github.com/nmi-agro/fdm/commit/0d3b76d810ffb925beac26311dc075936f0c9f7f), [`865695a`](https://github.com/nmi-agro/fdm/commit/865695a5b240ccd3806ecb91276653cbc75610df), [`e1d8e0c`](https://github.com/nmi-agro/fdm/commit/e1d8e0cda1ce0a21932f68a33dd3a0449d35bff2), [`8ca24d1`](https://github.com/nmi-agro/fdm/commit/8ca24d1702ca08556173f8cd341dac837977120c), [`8ca24d1`](https://github.com/nmi-agro/fdm/commit/8ca24d1702ca08556173f8cd341dac837977120c), [`8ca24d1`](https://github.com/nmi-agro/fdm/commit/8ca24d1702ca08556173f8cd341dac837977120c), [`9c3e86f`](https://github.com/nmi-agro/fdm/commit/9c3e86f0cdbdec414278eaaf1c40a5be010ca6cd), [`9c3e86f`](https://github.com/nmi-agro/fdm/commit/9c3e86f0cdbdec414278eaaf1c40a5be010ca6cd), [`06b5af6`](https://github.com/nmi-agro/fdm/commit/06b5af679259944b36df57734bb4a8e18ef0aa5d), [`905679c`](https://github.com/nmi-agro/fdm/commit/905679cc6e8b474c3252d53113f05d45c06a7e99), [`905679c`](https://github.com/nmi-agro/fdm/commit/905679cc6e8b474c3252d53113f05d45c06a7e99), [`2c9cc22`](https://github.com/nmi-agro/fdm/commit/2c9cc22ce8043d60dc8bd8c36d569bef18af52af)]:
  - @nmi-agro/fdm-calculator@0.21.0
  - @nmi-agro/fdm-core@0.40.0
  - @nmi-agro/fdm-storage@0.1.0
