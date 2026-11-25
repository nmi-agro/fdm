---
"@nmi-agro/fdm-app": patch
---

Stop installing git in the Docker base image. No dependency is fetched from a git repository anymore, so git only made the image build larger and slower.
