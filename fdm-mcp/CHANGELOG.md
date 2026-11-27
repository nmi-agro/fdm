# @nmi-agro/fdm-mcp

## 0.1.2

### Patch Changes

- [#993](https://github.com/nmi-agro/fdm/pull/993) [`6eb7c85`](https://github.com/nmi-agro/fdm/commit/6eb7c8545ae9573ad0a6124797e7c1caef47e972) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix the PostHog MCP analytics. The server reads `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST`, with `PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST` still accepted as fallbacks (an empty value counts as unset, and `docker-compose.yml` passes both names to the container); without a host the analytics go to the EU region (`https://eu.i.posthog.com`). `@posthog/mcp` and `posthog-node` are pinned to exact versions (1.6.0 and 6.0.4), so tool calls keep reporting the model and conversation that an assistant passes with them.
- Updated dependencies [[`54cc506`](https://github.com/nmi-agro/fdm/commit/54cc506cc94c368b7d79510ea3a6753a83cbc0fb)]:
  - @nmi-agro/fdm-core@0.41.0
  - @nmi-agro/fdm-api@0.5.1

## 0.1.1

### Patch Changes

- [#988](https://github.com/nmi-agro/fdm/pull/988) [`5b6d4bb`](https://github.com/nmi-agro/fdm/commit/5b6d4bb24257b4b67f132113f929f18cdbd110e5) Thanks [@SvenVw](https://github.com/SvenVw)! - The `get_fertilization_norms` tool accepts `year` 2027 (provisional norms, with the 2026 rules). Without `year` it uses the current calendar year instead of always 2026. The tool description and the server instructions now tell the model to pass the year the user asks about, to ask when the year is unclear, and to say which year the norms are for.
- Updated dependencies [[`33b59b0`](https://github.com/nmi-agro/fdm/commit/33b59b0c7e3b61cc061fe69eb9f5369be0e8d072)]:
  - @nmi-agro/fdm-api@0.5.0

## 0.1.0

### Minor Changes

- [#937](https://github.com/nmi-agro/fdm/pull/937) [`c85ca11`](https://github.com/nmi-agro/fdm/commit/c85ca1110a131eefb35e9c3d1b130bfb4f441666) Thanks [@SvenVw](https://github.com/SvenVw)! - New package: a Model Context Protocol (MCP) server for AI assistants, run as its own service. It serves stateless Streamable HTTP at `/mcp`, authenticates with the same API keys as the REST API (`X-API-Key` or `Authorization: Bearer`, with a `WWW-Authenticate` challenge on 401), records changes in the audit log with channel `mcp`, and shares the per-key rate limits of the REST API. A client that tries OAuth sign-in, which the server does not support yet, gets a message that tells the user to connect with an API key. It checks the API key before it reads a request body, counts every non-tool message of a batch in the general rate limit, and waits for running requests on shutdown. Tools run the fdm-api operations, with annotations (updates and deletes are marked destructive), output schemas, cursor paging and errors the model can act on. It also offers resource templates for farms and fields, server instructions (including not to estimate or make up data, to confirm values the user did not give before saving them, and never to invent field boundaries), and optional PostHog MCP analytics that never send tool arguments, results or error messages (the assistant's stated intent is sent as free text). It offers about 65 tools for farms, farm groups, fields, cultivations, harvests, fertilizers and their applications, soil analyses and soil data, measures, organic certifications, derogations, grazing intentions, catalogue search and calculations (nitrogen and organic matter balances, fertilization norms, doses, nutrient advice and soil quality indicators). Related operations share one tool with a scope argument, for example a field or a farm. Every REST operation is covered by a tool or listed as a deliberate exclusion with a reason, and a test enforces this.

- The `calculate_nitrogen_balance` tool now returns the direct nitrous oxide (N₂O) emission of the nitrogen balance, `emission.nitrous_oxide` in kg N/ha with its CO₂-equivalent. Its description says that the N₂O emission is part of the balance and the nitrate leaching is not.

### Patch Changes

- [#976](https://github.com/nmi-agro/fdm/pull/976) [`d9e06e8`](https://github.com/nmi-agro/fdm/commit/d9e06e82607e4fbfedf5cc64049b728de3bfe736) Thanks [@SvenVw](https://github.com/SvenVw)! - Stop installing git in the Docker base image. No dependency is fetched from a git repository anymore, so git only made the image build larger and slower. The Docker image builds again: `pnpm deploy` stopped because the build scripts of the bundled fdm-api were not allowed.

  An empty `SENTRY_RELEASE` now counts as unset, so Sentry events use the package version instead of an empty release.

- [#973](https://github.com/nmi-agro/fdm/pull/973) [`8ca24d1`](https://github.com/nmi-agro/fdm/commit/8ca24d1702ca08556173f8cd341dac837977120c) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Run on Node.js 26: the Docker image now uses `node:26-alpine`, `engines.node` is `>=26.0.0` and the build targets `node26`.

- [#967](https://github.com/nmi-agro/fdm/pull/967) [`08fe4a4`](https://github.com/nmi-agro/fdm/commit/08fe4a48a82db4d4c77001412d6380335aa60636) Thanks [@SvenVw](https://github.com/SvenVw)! - Update `posthog-node` to version 6. Analytics events are now sent to the PostHog capture v1 endpoints, so a reverse proxy in front of PostHog must forward `/i/v1/analytics/events` and `/i/v1/ai/events`.
- Updated dependencies [[`79bac8e`](https://github.com/nmi-agro/fdm/commit/79bac8e7cf053a81b3632c0b6d9c56b24a0f75c8), [`971f138`](https://github.com/nmi-agro/fdm/commit/971f138a51fe4a3fa02b77d6c00930a81adf4fd1), [`971f138`](https://github.com/nmi-agro/fdm/commit/971f138a51fe4a3fa02b77d6c00930a81adf4fd1), [`97d64f0`](https://github.com/nmi-agro/fdm/commit/97d64f08103a4e5978ecb3305e76651c36cc3018), [`e954d38`](https://github.com/nmi-agro/fdm/commit/e954d388808119903d92e5210b60df7cec6ab0bb), [`2b531e7`](https://github.com/nmi-agro/fdm/commit/2b531e7314856701cf8b4117da44a3e21d562636), [`d9e06e8`](https://github.com/nmi-agro/fdm/commit/d9e06e82607e4fbfedf5cc64049b728de3bfe736), [`767bdbf`](https://github.com/nmi-agro/fdm/commit/767bdbf19ab1084c29bb2aed2be8a7f46b9ab77d), [`9a8d4e0`](https://github.com/nmi-agro/fdm/commit/9a8d4e0fa0af4567ecb0fbed6d270ebb178a9941), [`104576e`](https://github.com/nmi-agro/fdm/commit/104576e826ff758b74250b3edb132204b557c6c5), [`104576e`](https://github.com/nmi-agro/fdm/commit/104576e826ff758b74250b3edb132204b557c6c5), [`0d3b76d`](https://github.com/nmi-agro/fdm/commit/0d3b76d810ffb925beac26311dc075936f0c9f7f), [`865695a`](https://github.com/nmi-agro/fdm/commit/865695a5b240ccd3806ecb91276653cbc75610df), [`e1d8e0c`](https://github.com/nmi-agro/fdm/commit/e1d8e0cda1ce0a21932f68a33dd3a0449d35bff2), [`8ca24d1`](https://github.com/nmi-agro/fdm/commit/8ca24d1702ca08556173f8cd341dac837977120c), [`8ca24d1`](https://github.com/nmi-agro/fdm/commit/8ca24d1702ca08556173f8cd341dac837977120c), [`9c3e86f`](https://github.com/nmi-agro/fdm/commit/9c3e86f0cdbdec414278eaaf1c40a5be010ca6cd), [`06b5af6`](https://github.com/nmi-agro/fdm/commit/06b5af679259944b36df57734bb4a8e18ef0aa5d), [`905679c`](https://github.com/nmi-agro/fdm/commit/905679cc6e8b474c3252d53113f05d45c06a7e99), [`905679c`](https://github.com/nmi-agro/fdm/commit/905679cc6e8b474c3252d53113f05d45c06a7e99), [`2c9cc22`](https://github.com/nmi-agro/fdm/commit/2c9cc22ce8043d60dc8bd8c36d569bef18af52af)]:
  - @nmi-agro/fdm-api@0.4.0
  - @nmi-agro/fdm-core@0.40.0
