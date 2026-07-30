# @nmi-agro/fdm-agents

## 0.5.0

### Minor Changes

- [#712](https://github.com/nmi-agro/fdm/pull/712) [`43ba345`](https://github.com/nmi-agro/fdm/commit/43ba345bb838ed671b8eefb5b3aa6b35b169cd2c) Thanks [@SvenVw](https://github.com/SvenVw)! - Gerrit is now Renure-aware. Added an `includeRenure` fertilizer plan strategy (RVO mestcodes 130-134) with a new "RENURE" prompt section explaining the 80 kg N/ha norm (on top of the 170 kg dierlijke-mest norm). `searchFertilizers` now exposes `p_type_rvo` and, together with `simulateFarmPlan`'s new compliance check, only filters/flags Renure products when `includeRenure` is false **and** the plan's calendar year is 2026 or later — Renure has no legal meaning before 2026, so the toggle never affects earlier years.

### Patch Changes

- [#716](https://github.com/nmi-agro/fdm/pull/716) [`8cf22f3`](https://github.com/nmi-agro/fdm/commit/8cf22f3776811bf3682071bac7aa32a1d446ad7d) Thanks [@SvenVw](https://github.com/SvenVw)! - Replace Gemini 3.5 Flash with Gemini 3.6 Flash

- [#693](https://github.com/nmi-agro/fdm/pull/693) [`30f2748`](https://github.com/nmi-agro/fdm/commit/30f274831dfcc0b8404046e2e8c103e8d48e28a6) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate to TypeScript V7

- [#716](https://github.com/nmi-agro/fdm/pull/716) [`e8a325a`](https://github.com/nmi-agro/fdm/commit/e8a325ac5ac54ab074da53344be1309739be2b4b) Thanks [@SvenVw](https://github.com/SvenVw)! - Replace Gemini 3.1 Flash Lite with Gemini 3.5 Flash Lite

- [#660](https://github.com/nmi-agro/fdm/pull/660) [`5da4dc5`](https://github.com/nmi-agro/fdm/commit/5da4dc5445c6c4613dcab9e8a78ce9ccff4867ad) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate for linting and formatting from Biome to oxlint and oxfmt

- Updated dependencies [[`a73a977`](https://github.com/nmi-agro/fdm/commit/a73a97733453191cd486f3261f5bb613a7f8b512), [`f8ca5b6`](https://github.com/nmi-agro/fdm/commit/f8ca5b6fa0ef4ee109d919e4865e27e797299160), [`af8cf53`](https://github.com/nmi-agro/fdm/commit/af8cf53a82a2c3525c56977f2746c742d04cfdb7), [`30f2748`](https://github.com/nmi-agro/fdm/commit/30f274831dfcc0b8404046e2e8c103e8d48e28a6), [`f09806b`](https://github.com/nmi-agro/fdm/commit/f09806b1df03d193740dcdbe578be42ffc611b48), [`9688dd1`](https://github.com/nmi-agro/fdm/commit/9688dd18bd247283d87f8b7d12a049291d5ffd9f), [`bb689c9`](https://github.com/nmi-agro/fdm/commit/bb689c922ed81bd90f8b26dfb18313f655a69cad), [`5bdd718`](https://github.com/nmi-agro/fdm/commit/5bdd718665ff0e549d12aeefc8e99ad6e7add5d8), [`def7e8f`](https://github.com/nmi-agro/fdm/commit/def7e8f6b378cf7b9dfd89ac15e630116cd113be), [`5aa2d57`](https://github.com/nmi-agro/fdm/commit/5aa2d57759cbae2e44b56f88f961f58cb8146a3a), [`130a468`](https://github.com/nmi-agro/fdm/commit/130a468f037f46466f116f1106a70399f3101fcb), [`94e073f`](https://github.com/nmi-agro/fdm/commit/94e073f935c05413f12cf37cadacdfec63ac8a6d), [`c2cdeb0`](https://github.com/nmi-agro/fdm/commit/c2cdeb02703a94409106fa0c54c97e26471aa46f), [`5da4dc5`](https://github.com/nmi-agro/fdm/commit/5da4dc5445c6c4613dcab9e8a78ce9ccff4867ad), [`7a774d6`](https://github.com/nmi-agro/fdm/commit/7a774d604ed390c682672bf3afc6cf6d3f411027)]:
  - @nmi-agro/fdm-data@0.23.0
  - @nmi-agro/fdm-calculator@0.18.0
  - @nmi-agro/fdm-core@0.36.0

## 0.4.2

### Patch Changes

- Updated dependencies [[`845197e`](https://github.com/nmi-agro/fdm/commit/845197e28776b331f6d44e0eb64dc144e786f8f3)]:
  - @nmi-agro/fdm-core@0.35.0
  - @nmi-agro/fdm-calculator@0.17.1

## 0.4.1

### Patch Changes

- Updated dependencies [[`d4e5c73`](https://github.com/nmi-agro/fdm/commit/d4e5c73fad558934c30a1534972cd6118ff2886a), [`af91940`](https://github.com/nmi-agro/fdm/commit/af91940e7b683741787b6c37ed53580a815bfd2c), [`2a169b4`](https://github.com/nmi-agro/fdm/commit/2a169b467d8bd3900fae8f85bf19ff807312f1ce)]:
  - @nmi-agro/fdm-calculator@0.17.0
  - @nmi-agro/fdm-data@0.22.0
  - @nmi-agro/fdm-core@0.34.1

## 0.4.0

### Minor Changes

- [#646](https://github.com/nmi-agro/fdm/pull/646) [`9a8b5fa`](https://github.com/nmi-agro/fdm/commit/9a8b5fa1b0c8e34cb7c9bc9e874f77c410665350) Thanks [@SvenVw](https://github.com/SvenVw)! - Enable the user to select fertilizers for the strategy at Gerrit to ignore certain fertilizers

- [#646](https://github.com/nmi-agro/fdm/pull/646) [`7f501b5`](https://github.com/nmi-agro/fdm/commit/7f501b528f0df2ac9f6112e54023079cc4eca8a2) Thanks [@SvenVw](https://github.com/SvenVw)! - Add generating claryfing questions at beginning of Gerrit to get additional user input for that farm specific

- [#646](https://github.com/nmi-agro/fdm/pull/646) [`d333599`](https://github.com/nmi-agro/fdm/commit/d333599c83859b3f77915a1df0d651aa022dc5c0) Thanks [@SvenVw](https://github.com/SvenVw)! - Use streaming for Gerrit and show progress while awaiting the response of Gerrit

- [#646](https://github.com/nmi-agro/fdm/pull/646) [`814c8fc`](https://github.com/nmi-agro/fdm/commit/814c8fccdbd8db794dfde6ab5f946a4e03f4377c) Thanks [@SvenVw](https://github.com/SvenVw)! - Switch default model for Gerrit to Gemini 3.5 Flash

- [#628](https://github.com/nmi-agro/fdm/pull/628) [`f889ae6`](https://github.com/nmi-agro/fdm/commit/f889ae6f1bb0fe05c95f347fd9923295c59d3591) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Added the helpdesk triage agent. This agent can take the ticket body text, and generate a subject line and assign a priority for it. It is independent of the fdm-helpdesk package and works as a feature of fdm-app.

### Patch Changes

- [#646](https://github.com/nmi-agro/fdm/pull/646) [`3d0099f`](https://github.com/nmi-agro/fdm/commit/3d0099f023fcd5e4f7746049be6cb575d6f3eedf) Thanks [@SvenVw](https://github.com/SvenVw)! - Rewrite prompt and tools to Dutch to improve the Dutch wording in the response

- Updated dependencies [[`98e0127`](https://github.com/nmi-agro/fdm/commit/98e0127bd3f02e193ad57a1cfef18fc10df40c67), [`afdd78f`](https://github.com/nmi-agro/fdm/commit/afdd78f16fad2aef17e03e4eace48628ef7a2d51), [`c07e18c`](https://github.com/nmi-agro/fdm/commit/c07e18c7bc178a7c052fcdde0db30a56d508587a), [`98edeca`](https://github.com/nmi-agro/fdm/commit/98edecaebdd50ae8f0e26980cc2fc9c642e3cad9), [`98edeca`](https://github.com/nmi-agro/fdm/commit/98edecaebdd50ae8f0e26980cc2fc9c642e3cad9)]:
  - @nmi-agro/fdm-core@0.34.0
  - @nmi-agro/fdm-calculator@0.16.0

## 0.3.1

### Patch Changes

- [#618](https://github.com/nmi-agro/fdm/pull/618) [`1454660`](https://github.com/nmi-agro/fdm/commit/145466048fb0e5e52ec2e0d4e19708722cb2c0be) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate from @google/adk to LangChain

- Updated dependencies [[`8e454a3`](https://github.com/nmi-agro/fdm/commit/8e454a3d9af12a66b7f13ae0dd7d5e72c2d0a857), [`df22bcb`](https://github.com/nmi-agro/fdm/commit/df22bcb2516cfb04cfe97ab6f490e9a003a67ff5), [`c09b5bf`](https://github.com/nmi-agro/fdm/commit/c09b5bf87af13c2b9cb6f1200c7e293492a12a8c), [`be2f3ae`](https://github.com/nmi-agro/fdm/commit/be2f3aebd1816b832d9915bf1b7f961b16f18585), [`c30057e`](https://github.com/nmi-agro/fdm/commit/c30057ea07f4646bd588d93a1eba894733076dae), [`3319d6a`](https://github.com/nmi-agro/fdm/commit/3319d6a3b4c51dabe8e1813570350e9a851f0dd6), [`f243894`](https://github.com/nmi-agro/fdm/commit/f243894ee8f0fe9e64d313d64a0008a7703c1f49), [`e12afe4`](https://github.com/nmi-agro/fdm/commit/e12afe49ad898412dfe12f487b6a4ca46c57c66f)]:
  - @nmi-agro/fdm-core@0.33.0
  - @nmi-agro/fdm-calculator@0.15.0
  - @nmi-agro/fdm-data@0.21.0

## 0.3.0

### Minor Changes

- [#592](https://github.com/nmi-agro/fdm/pull/592) [`9b8c9b1`](https://github.com/nmi-agro/fdm/commit/9b8c9b1ac31e33cde360561aeffb04a5766afa8d) Thanks [@SvenVw](https://github.com/SvenVw)! - Add skill for crop-specific fertilizer preferences

- [#592](https://github.com/nmi-agro/fdm/pull/592) [`f76facd`](https://github.com/nmi-agro/fdm/commit/f76facdd86c062d3a2e5cf718e1061f9c58b0a7c) Thanks [@SvenVw](https://github.com/SvenVw)! - Add a short field-level explanation for the fertilizer plan generated by Gerrit to gain more insights in the provided plan

### Patch Changes

- [#592](https://github.com/nmi-agro/fdm/pull/592) [`367d4d3`](https://github.com/nmi-agro/fdm/commit/367d4d307df9df1ba54de4ad764e40998671d065) Thanks [@SvenVw](https://github.com/SvenVw)! - For Gerrit prioritize supplying N, P and K above a positive organic matter balance if constrained

- [#557](https://github.com/nmi-agro/fdm/pull/557) [`fa0fc06`](https://github.com/nmi-agro/fdm/commit/fa0fc06516ec743dd29b285c020e501c98d5868b) Thanks [@SvenVw](https://github.com/SvenVw)! - Bump to TypeScript V6

- [#559](https://github.com/nmi-agro/fdm/pull/559) [`1d8bbf1`](https://github.com/nmi-agro/fdm/commit/1d8bbf18f00b237dfd99272b9a0662d352d27d53) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate from rollup to tsdown

- Updated dependencies [[`16692f1`](https://github.com/nmi-agro/fdm/commit/16692f1c368e4ff24497ae1a3cbb61f4a0d1a04e), [`a922790`](https://github.com/nmi-agro/fdm/commit/a922790e92121bf5c1371885e17533fab3c27bf8), [`fa0fc06`](https://github.com/nmi-agro/fdm/commit/fa0fc06516ec743dd29b285c020e501c98d5868b), [`e396027`](https://github.com/nmi-agro/fdm/commit/e396027e4422b0dbb402ed7d965d155c7c79424c), [`3ce3f81`](https://github.com/nmi-agro/fdm/commit/3ce3f81256b84d1311b1ffda2eeabd9785f48964), [`b278794`](https://github.com/nmi-agro/fdm/commit/b278794c06af35ce5996965f6bfa020332e6270f), [`7d01bfc`](https://github.com/nmi-agro/fdm/commit/7d01bfcebb3e17dfa16217d462012976dff034d9), [`1d8bbf1`](https://github.com/nmi-agro/fdm/commit/1d8bbf18f00b237dfd99272b9a0662d352d27d53)]:
  - @nmi-agro/fdm-calculator@0.14.0
  - @nmi-agro/fdm-data@0.20.0
  - @nmi-agro/fdm-core@0.32.0

## 0.2.1

### Patch Changes

- [#552](https://github.com/nmi-agro/fdm/pull/552) [`bc66091`](https://github.com/nmi-agro/fdm/commit/bc660919b72abf951d7cbc42f3cd5c527d03fac5) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Fix type issue where `fieldMetrics` could possibly be null

- Updated dependencies [[`45718ae`](https://github.com/nmi-agro/fdm/commit/45718ae5288f59797612d8a382f042598ecec163), [`9dfd545`](https://github.com/nmi-agro/fdm/commit/9dfd545b834f90492d3599a0e82fe66978e56889)]:
  - @nmi-agro/fdm-calculator@0.13.1
  - @nmi-agro/fdm-core@0.31.1

## 0.2.0

### Minor Changes

- [#534](https://github.com/nmi-agro/fdm/pull/534) [`2c9d6e9`](https://github.com/nmi-agro/fdm/commit/2c9d6e9fea5a2eabab44ca4bf67951825a3b6aa5) Thanks [@SvenVw](https://github.com/SvenVw)! - Add `fdm-agents` package — a framework for strategic decision support using Agentic AI. Ships the first agent, **Gerrit**, an expert Dutch agronomist that generates agronomically sound and legally compliant fertilizer application plans.

  Key features:
  - **Reasoner-Verifier Architecture:** LLM handles reasoning and narrative; all norm calculations and compliance checks are delegated to deterministic `fdm-calculator` tools — the LLM never does arithmetic itself.
  - **Multi-Strategy Support:** Organic farming, derogation (no mineral phosphate), fill-manure-space, NH₃ emission reduction, nitrogen balance target, and rotation-level (bouwplan) consistency.
  - **RVO Compliance:** Verifies plans against Dutch RVO legal norms at the farm aggregate level while evaluating agronomic needs at the field level.
  - **Soil-Aware Context:** Injects key field metadata (soil type, groundwater class, SOM) into the planning prompt for field-specific recommendations.
  - **Security Hardened:** Sanitizes user-supplied `additionalContext` against prompt-injection (strips code blocks, HTML tags, and known override phrases; hard-capped at 1000 characters). API keys and NMI credentials are strictly server-side and never transmitted to the LLM.

### Patch Changes

- Updated dependencies [[`c570b8a`](https://github.com/nmi-agro/fdm/commit/c570b8a51bb22e513b4c07b0e9efdd072807dd5c), [`ae7d3c9`](https://github.com/nmi-agro/fdm/commit/ae7d3c98be19fb2cd3abf8b5de37f0e5312fd557), [`69122ba`](https://github.com/nmi-agro/fdm/commit/69122ba66cdb6eb791e0fb51acd0f042d8ac7a71), [`0f359ad`](https://github.com/nmi-agro/fdm/commit/0f359adc81efdac957fadab687ac1d61c8ddfc05), [`0f359ad`](https://github.com/nmi-agro/fdm/commit/0f359adc81efdac957fadab687ac1d61c8ddfc05), [`6e1dcea`](https://github.com/nmi-agro/fdm/commit/6e1dceacdbbe2adf3daea171924bba8e26c3dcde), [`6b00be9`](https://github.com/nmi-agro/fdm/commit/6b00be9c0999b3510a3af86b64d2002ee66ecc1b), [`21ef50a`](https://github.com/nmi-agro/fdm/commit/21ef50aa3c9e2b59366b1d27183cf9306c8dbe33), [`2fb53de`](https://github.com/nmi-agro/fdm/commit/2fb53dee72bee18b6db11de2939699e2d567f336), [`2c9d6e9`](https://github.com/nmi-agro/fdm/commit/2c9d6e9fea5a2eabab44ca4bf67951825a3b6aa5), [`7e07507`](https://github.com/nmi-agro/fdm/commit/7e07507a30fa3876a969346e6cef8d310d318bdc), [`4463c5b`](https://github.com/nmi-agro/fdm/commit/4463c5b49b6c297ceb1ce9222aafa231dcdb01de), [`71dcf8a`](https://github.com/nmi-agro/fdm/commit/71dcf8a15801d4faf476c18bbc4f2eb6b488c823), [`ae7d3c9`](https://github.com/nmi-agro/fdm/commit/ae7d3c98be19fb2cd3abf8b5de37f0e5312fd557)]:
  - @nmi-agro/fdm-calculator@0.13.0
  - @nmi-agro/fdm-core@0.31.0
  - @nmi-agro/fdm-data@0.19.3
