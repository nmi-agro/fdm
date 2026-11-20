---
"@nmi-agro/fdm-app": patch
---

Update `posthog-node` to version 6. The server-side PostHog client uses the renamed `beforeSend` option for the event sanitizer. The sanitizer now allows events of up to 1 MB (was 150 KB) and keeps the SDK identity properties (`$lib`, `$lib_version`, `$is_server`, `$geoip_disable`) when it has to strip an event.
