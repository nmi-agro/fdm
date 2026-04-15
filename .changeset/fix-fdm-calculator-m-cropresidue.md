---
"@nmi-agro/fdm-calculator": patch
---

Fix a bug in organic matter supply calculation where `undefined` crop residues yielded zero supply; it now correctly calculates supply for residues that are not explicitly removed.
