---
"@nmi-agro/fdm-calculator": patch
---

Fixed the 2025 and 2026 nitrogen usage norm (stikstofgebruiksnorm) for `Bladgewassen overig` (`nl_2791`, `nl_2792`) and `Kruiden` (`nl_2743`, `nl_2744`), which previously threw an error. The norm input now includes the harvests of each cultivation in the norm year: with more than one harvest the _meermalige oogst_ norm applies, otherwise the _eenmalige oogst_ norm.
