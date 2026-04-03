# @nmi-agro/fdm-agents

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
