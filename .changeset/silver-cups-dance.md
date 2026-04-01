---
"@nmi-agro/fdm-agents": minor
---

Add `fdm-agents` package — a framework for strategic decision support using Agentic AI. Ships the first agent, **Gerrit**, an expert Dutch agronomist that generates agronomically sound and legally compliant fertilizer application plans.

Key features:
- **Reasoner-Verifier Architecture:** LLM handles reasoning and narrative; all norm calculations and compliance checks are delegated to deterministic `fdm-calculator` tools — the LLM never does arithmetic itself.
- **Multi-Strategy Support:** Organic farming, derogation (no mineral phosphate), fill-manure-space, NH₃ emission reduction, nitrogen balance target, and rotation-level (bouwplan) consistency.
- **RVO Compliance:** Verifies plans against Dutch RVO legal norms at the farm aggregate level while evaluating agronomic needs at the field level.
- **Soil-Aware Context:** Injects key field metadata (soil type, groundwater class, SOM) into the planning prompt for field-specific recommendations.
- **Security Hardened:** Sanitizes user-supplied `additionalContext` against prompt-injection (strips code blocks, HTML tags, and known override phrases; hard-capped at 1000 characters). API keys and NMI credentials are strictly server-side and never transmitted to the LLM.
