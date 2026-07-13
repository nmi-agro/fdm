---
"@nmi-agro/fdm-app": patch
---

Improved the sign-in verification flow (`signin/check-your-email`, `signin/verify`, `welcome`):

- Added a resend-code action with masked destination email and a cooldown, so the "request a new code" error copy has an actual button behind it.
- Fixed the OTP field's accessibility: `aria-invalid` now reaches the rendered input, the error region no longer renders when empty, and focus moves back to the code field on a failed verification.
- Auto-submit after a completed code no longer fires if the user edits the code during the reveal delay, and a manual submit click cancels the pending auto-submit.
- Refactored `welcome.tsx` to reuse the shared `AuthLayout`/`AuthCard` components instead of duplicating the auth shell, and replaced its deprecated `Form`/`FormField` usage with the `Field` component pattern already used elsewhere (e.g. `Controller` + `Field`/`FieldLabel`/`FieldError`).
- Gave the welcome screen a more concrete "what's next" description instead of a generic profile-completion message.
