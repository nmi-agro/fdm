---
"@nmi-agro/fdm-app": patch
---

Improve sign-in page accessibility, copy, and visual quality

- Add visible label, `type="email"`, and `autoComplete` to email field (WCAG AA)
- Fix Dutch typos and mixed formal/informal address (`je` → `u/uw`)
- Add trust line under sign-in card with links to NMI and GitHub
- Replace identical centered feature cards with horizontal staggered layout
- Align shadows to flat-by-default design principle
- Fix 4-column grid overflow on 14" laptops
- Respect `prefers-reduced-motion` on all scroll and enter animations
