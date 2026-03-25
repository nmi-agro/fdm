# Changelog fdm-app

## 0.28.7

### Patch Changes

- [#528](https://github.com/nmi-agro/fdm/pull/528) [`3442ae3`](https://github.com/nmi-agro/fdm/commit/3442ae3c92d8200b81b020ee7516bca4580c4056) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix to show the error page instead of blank page

- [#528](https://github.com/nmi-agro/fdm/pull/528) [`7202197`](https://github.com/nmi-agro/fdm/commit/72021973454613231e9fbc5096684e138579a31f) Thanks [@SvenVw](https://github.com/SvenVw)! - Ignore expected 405 Method Not Allowed errors caused by bots/crawlers making OPTIONS requests

- [#528](https://github.com/nmi-agro/fdm/pull/528) [`6cf0fc4`](https://github.com/nmi-agro/fdm/commit/6cf0fc41b61755d14aa8dedb345fadb7b01bf2e9) Thanks [@SvenVw](https://github.com/SvenVw)! - Add Sentry metric for how often the error page is shown

- Updated dependencies [[`534836a`](https://github.com/nmi-agro/fdm/commit/534836a7493201c77b5c7766c86290d7168e6f76), [`e9a3cd4`](https://github.com/nmi-agro/fdm/commit/e9a3cd4de585c2e05fc215ff0c5e758005c48f73)]:
  - @nmi-agro/fdm-calculator@0.12.2
  - @nmi-agro/fdm-core@0.30.1

## 0.28.6

### Patch Changes

- [#525](https://github.com/nmi-agro/fdm/pull/525) [`6876a82`](https://github.com/nmi-agro/fdm/commit/6876a82611b6ad1cbc67174e9e1f2c40b74e0eeb) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix to include instrument.server.mjs in docker image

## 0.28.5

### Patch Changes

- [#524](https://github.com/nmi-agro/fdm/pull/524) [`6bbe778`](https://github.com/nmi-agro/fdm/commit/6bbe77862a8945dcad114bbe34dc81d0dd1159d9) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix server-side errors not captured in Sentry and fix error page copy button

  Server-side exceptions were silently dropped from Sentry because `instrument.server.mjs` was never loaded at runtime — the `start` script was missing `NODE_OPTIONS='--import ./instrument.server.mjs'`. As a result, `Sentry.getClient()` always returned `null` server-side, making every `captureException()` call a no-op.
  - `package.json`: Add `NODE_OPTIONS='--import ./instrument.server.mjs'` to `start` and `start-dev` scripts
  - `entry.server.tsx`: Add fallback `import "../instrument.server.mjs"` at the top for environments where `NODE_OPTIONS` is not set
  - `instrument.server.mjs`: Add startup log confirming Sentry initialized (or warning when DSN is missing)
  - `root.tsx`: Remove redundant `Sentry.captureException()` for `RouteErrorResponse` in `ErrorBoundary` — server already captures these via `reportError()`; keep capture only for client-side `Error` instances
  - `entry.client.tsx`: Remove `/sentry-tunnel` route and `tunnel` config; remove `/Unexpected Server Error/` from `ignoreErrors`
  - `sentry-tunnel.tsx`: Delete the tunnel route (simplification — one less failure point)
  - `error.tsx`: Fix `copyStackTrace` to properly `await` the clipboard write; on failure, auto-select the error text and show a clear message that the browser blocked clipboard access

## 0.28.4

### Patch Changes

- [#522](https://github.com/nmi-agro/fdm/pull/522) [`931b2a6`](https://github.com/nmi-agro/fdm/commit/931b2a6c2067a9b8d8c1a502db32fe672ca1a0ea) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix error logging so server errors are actually captured in Sentry

  Server errors were silently dropped from Sentry in several scenarios, leaving only an uninformative client-side "Unexpected Server Error" event with no stack trace or error code
  - `reportError()` now always calls `Sentry.captureException()` when the SDK is initialized (guarded via `Sentry.getClient()`), removing the dependency on `clientConfig` which could silently evaluate to `null` server-side
  - `errorId` is now stored in Sentry **tags** (`error_id`) in addition to `extra`, making it searchable — users can report their error code and you can find the exact event with `error_id:XXXX-XXXX`
  - `console.error` is now always called in `reportError()`, regardless of whether Sentry is configured
  - `"Unexpected Server Error"` is added to `ignoreErrors` on the client — this React Router shadow event is always a duplicate of the real server-side error
  - `handleError` in `entry.server.tsx` now uses `reportError()` instead of raw `Sentry.captureException()`, so unhandled errors also get a trackable `errorId`
  - Streaming `onError` callbacks now call `reportError()` instead of `console.error()` only
  - `VITE_SENTRY_DSN`, `VITE_SENTRY_TRACE_SAMPLE_RATE`, and `VITE_SENTRY_PROFILE_SAMPLE_RATE` renamed to `PUBLIC_SENTRY_*` for consistency with the rest of the app
  - Sentry server-side initialization is now conditional on `PUBLIC_SENTRY_DSN` being set; the app starts normally without Sentry configured

## 0.28.3

### Patch Changes

- [#517](https://github.com/nmi-agro/fdm/pull/517) [`5eadcd9`](https://github.com/nmi-agro/fdm/commit/5eadcd98fa121021479ce3f8dca078c9bd4ae962) Thanks [@SvenVw](https://github.com/SvenVw)! - Increase `streamTimeout` from 30s to 90s to reduce timeout errors for large calculations

## 0.28.2

### Patch Changes

- [#511](https://github.com/nmi-agro/fdm/pull/511) [`604f161`](https://github.com/nmi-agro/fdm/commit/604f16166ac430a967cf5a5b8f7a74377d21b5ac) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix RVO shapefile upload failing when NAAM attribute is null; accept null NAAM and assign fallback name 'Naamloos perceel N'

- [#513](https://github.com/nmi-agro/fdm/pull/513) [`08719fb`](https://github.com/nmi-agro/fdm/commit/08719fbc145b69e313ac2264a3231fcba1a7d0a5) Thanks [@SvenVw](https://github.com/SvenVw)! - Add reverse proxy for Sentry

- [#512](https://github.com/nmi-agro/fdm/pull/512) [`38ddf3a`](https://github.com/nmi-agro/fdm/commit/38ddf3a6f9b82f1c6e991be4529292c28578d30a) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix: remove the `signal.aborted` check from inside the `for await` loop so FlatGeobuf always completes its HTTP exchange cleanly. The abort guard before `setData()` is kept, so stale data is still never rendered after a map pan.

  Additionally, append `?v={APP_VERSION}` to the FlatGeobuf file URL so that users who already have a corrupted browser cache get a fresh cache key on the next deploy.

## 0.28.1

### Patch Changes

- [#495](https://github.com/nmi-agro/fdm/pull/495) [`9d5050a`](https://github.com/nmi-agro/fdm/commit/9d5050aef5f70636be638d2f1a4027ccd22f4189) Thanks [@SvenVw](https://github.com/SvenVw)! - Do not show the NavigationProgress for pages with their own loaders, like uploading files

- [#495](https://github.com/nmi-agro/fdm/pull/495) [`9d5050a`](https://github.com/nmi-agro/fdm/commit/9d5050aef5f70636be638d2f1a4027ccd22f4189) Thanks [@SvenVw](https://github.com/SvenVw)! - Increase navigation progress time from 300 to 500ms

- [#495](https://github.com/nmi-agro/fdm/pull/495) [`9d5050a`](https://github.com/nmi-agro/fdm/commit/9d5050aef5f70636be638d2f1a4027ccd22f4189) Thanks [@SvenVw](https://github.com/SvenVw)! - Improve DatePickers and Forms to use contextual default dates based on the selected calendar year. Forms now default to domain-specific dates (e.g., March 1st for fertilizer and cultivation-specific harvest defaults in non-current years), and DatePickers now resolve partial text entries (like "15 april") to the active calendar year instead of the current real-world year.

- [#495](https://github.com/nmi-agro/fdm/pull/495) [`9d5050a`](https://github.com/nmi-agro/fdm/commit/9d5050aef5f70636be638d2f1a4027ccd22f4189) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix that link for going back for fertilizer application modification goes back to rotation

- [#495](https://github.com/nmi-agro/fdm/pull/495) [`9d5050a`](https://github.com/nmi-agro/fdm/commit/9d5050aef5f70636be638d2f1a4027ccd22f4189) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix that going to Fertilizers page does not reset the selected calendar year to current year

- [#495](https://github.com/nmi-agro/fdm/pull/495) [`9d5050a`](https://github.com/nmi-agro/fdm/commit/9d5050aef5f70636be638d2f1a4027ccd22f4189) Thanks [@SvenVw](https://github.com/SvenVw)! - At the Sentry metric for NavigationProgress include a tag for the page

- Updated dependencies [[`9d5050a`](https://github.com/nmi-agro/fdm/commit/9d5050aef5f70636be638d2f1a4027ccd22f4189)]:
  - @nmi-agro/fdm-calculator@0.12.1

## 0.28.0

### Minor Changes

- [#426](https://github.com/nmi-agro/fdm/pull/426) [`4b120a4`](https://github.com/nmi-agro/fdm/commit/4b120a454bf5af0acddc8491ab5892458aa2a1ea) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Users can now edit the details of their organizations and add members in dedicated, easy-to-find pages.

- [#449](https://github.com/nmi-agro/fdm/pull/449) [`e77460f`](https://github.com/nmi-agro/fdm/commit/e77460f3dfaa4c789d4a08912772d14584f64fae) Thanks [@SvenVw](https://github.com/SvenVw)! - Add grouping and improve ordering of soil parameters for a field

- [#470](https://github.com/nmi-agro/fdm/pull/470) [`ecd4d21`](https://github.com/nmi-agro/fdm/commit/ecd4d2184de555cbace8d031d0b63d121de9971f) Thanks [@SvenVw](https://github.com/SvenVw)! - Add the possibility for users to accept or reject an invitation to a farm, instead of having it automatically. This makes it also possible to invite non-registered users to get access to a farm after signing up.
  - Overview page shows pending farm invitations with accept/decline actions
  - Invitation email sent when a user is invited to a farm
  - Farm access settings page handles accept/decline invitation intents

- [#456](https://github.com/nmi-agro/fdm/pull/456) [`ec81834`](https://github.com/nmi-agro/fdm/commit/ec8183409633b7b0b6eb6c0225b89ac0baa7f2a5) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Users can edit the harvest date and parameters directly from the cell in the rotation table.

- [#449](https://github.com/nmi-agro/fdm/pull/449) [`d1b44c4`](https://github.com/nmi-agro/fdm/commit/d1b44c49500f9dcad1e9b94141837d5bdafa9738) Thanks [@SvenVw](https://github.com/SvenVw)! - In the list of soil analyses show also analyses from before the selected year

- [#450](https://github.com/nmi-agro/fdm/pull/450) [`cf58f14`](https://github.com/nmi-agro/fdm/commit/cf58f148871a107084f101c0e8cb270c0cd3aede) Thanks [@SvenVw](https://github.com/SvenVw)! - Improve farm create form by only showing derogation question before 2026, adding KvK number, grazing intention and organic certification

- [#449](https://github.com/nmi-agro/fdm/pull/449) [`ffc6279`](https://github.com/nmi-agro/fdm/commit/ffc6279ff4ab00e29bb6ec22ea7510428e3568bd) Thanks [@SvenVw](https://github.com/SvenVw)! - Make it at the new fields page more clear that soil parameters are estimates and multiple pdf's can be uploaded

- [#449](https://github.com/nmi-agro/fdm/pull/449) [`0ccf8f0`](https://github.com/nmi-agro/fdm/commit/0ccf8f05c7e55f38bec3355987cb84e5adf5be1b) Thanks [@SvenVw](https://github.com/SvenVw)! - Add the ability to upload multiple soil analyses as pdf, review them in a table and connect to a field

- [#475](https://github.com/nmi-agro/fdm/pull/475) [`b6f7cd5`](https://github.com/nmi-agro/fdm/commit/b6f7cd52502ed5fa1e5fd4241011f1e4066f0006) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Users can click the fertilizer badges on the rotation table to see a table of applications of this fertilizer onto the clicked cultivation or field. They can edit the applications directly from this table.

- [#465](https://github.com/nmi-agro/fdm/pull/465) [`4cf7ec0`](https://github.com/nmi-agro/fdm/commit/4cf7ec09278cee2e718ad330e6d6aabc53ce409e) Thanks [@SvenVw](https://github.com/SvenVw)! - Add a card to field details at Atlas with more information about carbon sequestration, including current state, potential maximal state and relatable figures of how much carbon can be stored

- [#488](https://github.com/nmi-agro/fdm/pull/488) [`fbbc0a3`](https://github.com/nmi-agro/fdm/commit/fbbc0a31f31bcbabb6c311a163e18100df67fd33) Thanks [@SvenVw](https://github.com/SvenVw)! - If a page load takes longer than 300 ms, show a loading spinner and blur the page to prevent double-clicking the navigation action.

- [#465](https://github.com/nmi-agro/fdm/pull/465) [`4041e97`](https://github.com/nmi-agro/fdm/commit/4041e97ec65bbfda79e6c6cc329797a8a320d134) Thanks [@SvenVw](https://github.com/SvenVw)! - Improve design of field details page in Atlas, to better show the information and make it more responsive on various screen sizes

- [#426](https://github.com/nmi-agro/fdm/pull/426) [`4b120a4`](https://github.com/nmi-agro/fdm/commit/4b120a454bf5af0acddc8491ab5892458aa2a1ea) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Users can now view the farms that their organization has access to in a searchable table

- [#466](https://github.com/nmi-agro/fdm/pull/466) [`f88fd50`](https://github.com/nmi-agro/fdm/commit/f88fd5051ddc29f902b4465476dfa2c9b3ce962b) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - While logging in or sending an organization invitation, if an email can't be sent due to an inactive recipient error from the Postmark API, the user will see a toast with a message that is specific to this error.

- [#477](https://github.com/nmi-agro/fdm/pull/477) [`4fe42b1`](https://github.com/nmi-agro/fdm/commit/4fe42b1b0345c20ccb4b6697174259dd3ccbef6b) Thanks [@SvenVw](https://github.com/SvenVw)! - In the access list of farms make it clear that if a user is invited they can enable managing invitations

- [#465](https://github.com/nmi-agro/fdm/pull/465) [`4041e97`](https://github.com/nmi-agro/fdm/commit/4041e97ec65bbfda79e6c6cc329797a8a320d134) Thanks [@SvenVw](https://github.com/SvenVw)! - Add floating button at field details page to go back easier to the map

- [#450](https://github.com/nmi-agro/fdm/pull/450) [`af6fabb`](https://github.com/nmi-agro/fdm/commit/af6fabb669654e3c9081b3a2b822b0070ef19a36) Thanks [@SvenVw](https://github.com/SvenVw)! - Add information box at first of farm create wizard to explain the steps in the farm create wizard

### Patch Changes

- [#457](https://github.com/nmi-agro/fdm/pull/457) [`f155e75`](https://github.com/nmi-agro/fdm/commit/f155e752f406efe48980d664a2a3471dc7b681b2) Thanks [@SvenVw](https://github.com/SvenVw)! - Enhanced the farm selection screen with a modernized UI, clearer feature breakdowns for new users, and a dedicated Atlas section for existing farms. Improved sidebar navigation by adding "muted" states for unavailable features and clarifying the distinction between the farm list and farm overview.

- [#482](https://github.com/nmi-agro/fdm/pull/482) [`ba7cf33`](https://github.com/nmi-agro/fdm/commit/ba7cf33f7577173cf2a8e348929332f8565b48cb) Thanks [@SvenVw](https://github.com/SvenVw)! - Show a toast with explanation when the user tries to update the role of the last owner of a farm instead of throwing an exception

- [#485](https://github.com/nmi-agro/fdm/pull/485) [`bf4448c`](https://github.com/nmi-agro/fdm/commit/bf4448c38a2b53e2b6d0bff93bb742f9972dccc3) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix AggregateError and improve Atlas stability by implementing AbortController for network requests and reducing elevation API calls from O(viewport pixels) to 9 requests per pan/zoom by sampling a 3×3 grid of points across the visible area

- [#473](https://github.com/nmi-agro/fdm/pull/473) [`86e3298`](https://github.com/nmi-agro/fdm/commit/86e3298f83fd2c22c2849c5d98342f6d395f1a0b) Thanks [@SvenVw](https://github.com/SvenVw)! - Standardize email templates with a shared layout, improved styling, and footers

- [#486](https://github.com/nmi-agro/fdm/pull/486) [`e1abff7`](https://github.com/nmi-agro/fdm/commit/e1abff76488227609de8c2efb4ac09111bc5c499) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix systemic double-click bug in actions by ensuring buttons and forms remain disabled during both the "submitting" and "loading" (revalidation) phases by checking for `state !== "idle"`.

- [#483](https://github.com/nmi-agro/fdm/pull/483) [`f9c6674`](https://github.com/nmi-agro/fdm/commit/f9c6674ad8c1b47499bcd0ff44ce807e5bfdde81) Thanks [@SvenVw](https://github.com/SvenVw)! - Fixes that version is passed to Sentry

- [#474](https://github.com/nmi-agro/fdm/pull/474) [`5579ab3`](https://github.com/nmi-agro/fdm/commit/5579ab3674d963e194aa8295b706266f591cbb45) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate organization from `SvenVw` to `nmi-agro`

- [#488](https://github.com/nmi-agro/fdm/pull/488) [`fbbc0a3`](https://github.com/nmi-agro/fdm/commit/fbbc0a31f31bcbabb6c311a163e18100df67fd33) Thanks [@SvenVw](https://github.com/SvenVw)! - If a page load takes longer than 300 ms, log the total duration to Sentry to identify potentially slow pages.

- [#486](https://github.com/nmi-agro/fdm/pull/486) [`e1abff7`](https://github.com/nmi-agro/fdm/commit/e1abff76488227609de8c2efb4ac09111bc5c499) Thanks [@SvenVw](https://github.com/SvenVw)! - Improve error handling robustness in `handleActionError` to correctly identify permission denied errors even when wrapped, preventing unnecessary 500 error pages

- [#452](https://github.com/nmi-agro/fdm/pull/452) [`bc0e278`](https://github.com/nmi-agro/fdm/commit/bc0e2783b95ca411be43c263a169d4efd70f9897) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate the shadcn/ui components to use the unified radix-ui package instead of the individual ones

- [#450](https://github.com/nmi-agro/fdm/pull/450) [`d0cc5e3`](https://github.com/nmi-agro/fdm/commit/d0cc5e39798f058781f3bafc424f71c8eaafe0c9) Thanks [@SvenVw](https://github.com/SvenVw)! - On overview page of farms always show the KvK number and make the text format consistent

- [#484](https://github.com/nmi-agro/fdm/pull/484) [`2e0b3d0`](https://github.com/nmi-agro/fdm/commit/2e0b3d0e87084c877600760199cbe7245243ec58) Thanks [@SvenVw](https://github.com/SvenVw)! - Increased PostHog proxy timeout to 60 seconds and improved reliability for large payloads by correctly handling content-length headers during streaming

- [#488](https://github.com/nmi-agro/fdm/pull/488) [`a1a30e7`](https://github.com/nmi-agro/fdm/commit/a1a30e75632c56d5e3b5e33f7ed361e23b2f6664) Thanks [@SvenVw](https://github.com/SvenVw)! - Suppress logging `BodyStreamBuffer was aborted` to Sentry, as this is caused by users navigating to another page while the current page is still loading.

- Updated dependencies [[`ecd4d21`](https://github.com/nmi-agro/fdm/commit/ecd4d2184de555cbace8d031d0b63d121de9971f), [`5579ab3`](https://github.com/nmi-agro/fdm/commit/5579ab3674d963e194aa8295b706266f591cbb45), [`4fe42b1`](https://github.com/nmi-agro/fdm/commit/4fe42b1b0345c20ccb4b6697174259dd3ccbef6b), [`1ac14fe`](https://github.com/nmi-agro/fdm/commit/1ac14fed4dca7a830f5d51c498976c0d17e53868), [`8dcc0ae`](https://github.com/nmi-agro/fdm/commit/8dcc0aeb951a12941737f1416961cea36c24c318), [`1df6896`](https://github.com/nmi-agro/fdm/commit/1df6896be4082d79ff817799beffa2dc6121b563)]:
  - @nmi-agro/fdm-core@0.30.0
  - @nmi-agro/fdm-calculator@0.12.0
  - @nmi-agro/fdm-data@0.19.2

## 0.27.4

### Patch Changes

- [#469](https://github.com/nmi-agro/fdm/pull/469) [`b9f30b6`](https://github.com/nmi-agro/fdm/commit/b9f30b65b9e3b9375e0e6f17c9ad3f1bbaaab7da) Thanks [@SvenVw](https://github.com/SvenVw)! - Make privacy policy available under '/privacy' instead of redirecting to external domain

## 0.27.3

### Patch Changes

- [#445](https://github.com/nmi-agro/fdm/pull/445) [`f30565a`](https://github.com/nmi-agro/fdm/commit/f30565ada2349775c159fa23ba58545159e9c15a) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix calculator version placeholder in `fdm-app` build. This ensures the calculation cache key correctly reflects the calculator version in production, where `fdm-app` consumes source files directly.

## 0.27.2

### Patch Changes

- [#448](https://github.com/nmi-agro/fdm/pull/448) [`5e5ebf4`](https://github.com/nmi-agro/fdm/commit/5e5ebf4bf169516d1c2fce9ef14c9a4a77bc3e12) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix FormDataParseError when uploading files by converting LazyFile to File in uploadHandlers.

## 0.27.1

### Patch Changes

- [#442](https://github.com/nmi-agro/fdm/pull/442) [`cc2f9c6`](https://github.com/nmi-agro/fdm/commit/cc2f9c6af3b08980c064ad70b0b03abbb545afa0) Thanks [@SvenVw](https://github.com/SvenVw)! - Fix forwarding headers to reverse proxy for posthog

## 0.27.0

### Minor Changes

- [#427](https://github.com/nmi-agro/fdm/pull/427) [`5566687`](https://github.com/nmi-agro/fdm/commit/556668727b17377ad77ddc090c50fdccdfe67c65) Thanks [@SvenVw](https://github.com/SvenVw)! - Integrated the BRO "Bodemkaart" (Soil Map) into the Atlas

- [#410](https://github.com/nmi-agro/fdm/pull/410) [`44ec6d8`](https://github.com/nmi-agro/fdm/commit/44ec6d8bd3afc5b7874c5111fab16033e756a9a1) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Users can now add multiple fields at once on the atlas also through the fields table.

- [#425](https://github.com/nmi-agro/fdm/pull/425) [`94fc2c5`](https://github.com/nmi-agro/fdm/commit/94fc2c562fa456b803e475c304b62ed5c9fd92cf) Thanks [@SvenVw](https://github.com/SvenVw)! - Adds that the user can download a pdf, "Bemestingsplan", for a farm that gives on farm-level an overview of norms, advices, used fertilizers and on field-level,the norms, advices, soil status and planned fertilizer applications.

- [#377](https://github.com/nmi-agro/fdm/pull/377) [`6bee78e`](https://github.com/nmi-agro/fdm/commit/6bee78e79d936d796c35d4d70a499bcdc6965af3) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Added expandable rows to the crop rotation table. When a cultivation row is expanded, fields with the cultivation appear on their own rows below, only showing data that is relevant to the cultivation type. Users can select fields and cultivation types in a mixed manner. The field selection will be passed to the harvest or fertilizer addition wizard, so the user no longer needs to deselect fields that they don't want if they have selected the correct fields on the table already.

- [#422](https://github.com/nmi-agro/fdm/pull/422) [`6839005`](https://github.com/nmi-agro/fdm/commit/683900597cebf1b7fb330caf0188bef597032486) Thanks [@SvenVw](https://github.com/SvenVw)! - Users can now indicate if a field is a buffer strip. Fields marked as buffer strips are excluded from nitrogen and organic matter balances at the farm level, and their nutrient advice and norms are automatically adjusted to zero. The UI now displays informative messages when calculations are skipped for these fields.

- [#430](https://github.com/nmi-agro/fdm/pull/430) [`661f3e2`](https://github.com/nmi-agro/fdm/commit/661f3e2d4a6bf242cc3574538de816912bca9b2f) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Improve the user experience when they come back to the field and rotation tables, by storing their filters in the session storage.

### Patch Changes

- [#418](https://github.com/nmi-agro/fdm/pull/418) [`5f3eec2`](https://github.com/nmi-agro/fdm/commit/5f3eec2ce1efc080717ee7dc69136938cadf9fff) Thanks [@SvenVw](https://github.com/SvenVw)! - Add "Copy to Clipboard" button to Cultivation History card to allow users to export data to Excel as TSV.

- [#405](https://github.com/nmi-agro/fdm/pull/405) [`cd223e2`](https://github.com/nmi-agro/fdm/commit/cd223e22d18996578bb4813da0e3695630d6d9c7) Thanks [@SvenVw](https://github.com/SvenVw)! - Added accessibility improvements to Cookie Banner and error pages. Replaced all instances of LoadingSpinner with the standardized shadcn Spinner component.

- [#414](https://github.com/nmi-agro/fdm/pull/414) [`316d3c7`](https://github.com/nmi-agro/fdm/commit/316d3c7c497fbe5fe31099b796b4e6efebe78e6b) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - While adding a harvest on the crop rotation table, the harvest date is now validated against the latest sowing date and the earliest cultivation ending date before submitting the form.

- [#433](https://github.com/nmi-agro/fdm/pull/433) [`e775778`](https://github.com/nmi-agro/fdm/commit/e775778c065b12658600492c86e070c40f94b6a4) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate to zod v4

- [#431](https://github.com/nmi-agro/fdm/pull/431) [`aa13654`](https://github.com/nmi-agro/fdm/commit/aa13654cb3919581fb9a6b4001310a323d4f4f6d) Thanks [@SvenVw](https://github.com/SvenVw)! - Significant UI/UX and mobile responsiveness improvements across the application:
  - Field Overview: Refactored to use a responsive Card layout and simplified labels for better mobile fit.
  - Header: Optimized for small screens with flexible height, truncated labels, and streamlined breadcrumbs.
  - Sidebar: Reduced width and internal spacing on medium screens to reclaim horizontal space for content.
  - Fertilizer Dashboard: Redesigned with a stacked layout for better readability on laptops and added robust text truncation.
  - Layout: Improved global padding and adjusted breakpoints (xl/2xl) to ensure a polished look across mobile, tablet, and desktop.

- [#403](https://github.com/nmi-agro/fdm/pull/403) [`36643d3`](https://github.com/nmi-agro/fdm/commit/36643d321c303d2b71b20aa51535167a49a9269e) Thanks [@SvenVw](https://github.com/SvenVw)! - Use Better-Auth functions for organizations instead of fdm-core functions

- Updated dependencies [[`4687738`](https://github.com/nmi-agro/fdm/commit/4687738e3b8ef35d071ae16b218d567a3cfbf3be), [`ae0468c`](https://github.com/nmi-agro/fdm/commit/ae0468c9b37f1326634bff24bd667ec5003d4bed), [`c316515`](https://github.com/nmi-agro/fdm/commit/c3165156c249931f56a97fa4a0b82493a5e25c9b), [`da3e50a`](https://github.com/nmi-agro/fdm/commit/da3e50a571483c576dd88abecd3e70ca0b9f22ba), [`bcd3a32`](https://github.com/nmi-agro/fdm/commit/bcd3a3289c9a13ffc36ea108e502661496164bf7), [`01d7174`](https://github.com/nmi-agro/fdm/commit/01d7174bef42f2fc8e71b4bb25eee045687e8c56), [`6f7f271`](https://github.com/nmi-agro/fdm/commit/6f7f27183f66bcc329720af5dcc17f250d74cbcf), [`4687738`](https://github.com/nmi-agro/fdm/commit/4687738e3b8ef35d071ae16b218d567a3cfbf3be), [`75553c4`](https://github.com/nmi-agro/fdm/commit/75553c41830c8519788a68560d9403192790d051), [`4687738`](https://github.com/nmi-agro/fdm/commit/4687738e3b8ef35d071ae16b218d567a3cfbf3be), [`6f7f271`](https://github.com/nmi-agro/fdm/commit/6f7f27183f66bcc329720af5dcc17f250d74cbcf)]:
  - @nmi-agro/fdm-calculator@0.11.0
  - @nmi-agro/fdm-core@0.29.0

## 0.26.7

### Patch Changes

- e5f322f: Fix incorrect norms in fertilizer dashboard by using the selected calendar year.

## 0.26.6

### Patch Changes

- e7a369b: Fix a crash in the fertilizer metrics dashboard when no active cultivation is present for a field. Added an empty state with a call to action to add a cultivation.
- 4a32710: Improve design of empty state at cultivations page of field
- Updated dependencies [bc23b79]
- Updated dependencies [3053340]
- Updated dependencies [005de6d]
  - @nmi-agro/fdm-calculator@0.10.1

## 0.26.5

### Patch Changes

- 5c2b843: Patch for CVE-2026-21884, CVE-2026-22029 and CVE-2026-22030

## 0.26.4

### Patch Changes

- e367ca6: Update dependencies of fdm-app to patch for CVE-2025-15284

## 0.26.3

### Patch Changes

- 7f69925: Synchronize DatePicker components with available calendar years by deriving boundaries from central calendar configuration, ensuring "next year" selection is supported.

## 0.26.2

### Patch Changes

- 2a30b7b: Fixed mobile elevation map stability by correcting the cache endpoint path, implementing robust `localStorage` error handling, and adding a "fallback-to-stale" strategy for offline resilience.

## 0.26.1

### Patch Changes

- 36b1b99: Fix TypeError when `updatePanel` attempts to access `map.getLayer(layer)` before the map is fully initialized
- 1274a32: Optimize Elevation Atlas stability and performance: implement chunked sampling concurrency, server-side AHN index caching, geometry simplification and WMS layer zoom constraints
- 067c0de: Fix AggregateError in Elevation Atlas by implementing chunked concurrency for sampling requests to avoid exceeding HTTP/1.1 connection limits

## 0.26.0

### Minor Changes

- 22f53dd: Update and expand the landing page. Add a "read more" section explaining what fdm-app can do and how it can be used. Also improve the mobile responsiveness
- b27b097: Enable to select the cultivation for the Nutrient Advice view at the Fertilizer Application Metrics
- c8a6e65: At Gebruiksruimte make 2026 also available
- d9f6711: Add implementation of the AHN4 via the elevation layer in Atlas
- 1885f8a: Implement OTP verification flow including a new verification page with typing animations, updated email templates, and improved accessibility for sign-in.
- bc6bf16: Add farm overview page at Nutrient Advice to easily select the field and cultivation
- b4ff19a: Enable to create a farm for next year
- 4796549: Make next year also available
- 61966db: Extended the nitrogen balance chart with breakdown into fixation, deposition, mineralization. Split removal into removal from harvests and crop residues. Added emission and supply breakdown for different fertilizer types.
- bc6bf16: Enable at Nutrient Advice to select the cultivation for which the nutrient advice is calculated and displayed

### Patch Changes

- 022a347: Cultivation ending date can now be cleared. If the cultivation can only be harvested once, any harvestings are deleted along with the cultivation ending date.
- 6095e65: Replace mapbox with maplibre
- a3cc042: Now, only first-time social provider logins redirect to the onboarding (/welcome) page. Other social provider logins redirect directly to the redirectTo search param value, or /farm by default.
- 99999e0: Add improvements and optimizations to the docker build process
- 06d5ff7: Setup a reverse proxy for posthog
- Updated dependencies [022a347]
- Updated dependencies [61966db]
- Updated dependencies [1885f8a]
- Updated dependencies [ba2c7dc]
- Updated dependencies [99a8797]
- Updated dependencies [2c5de99]
- Updated dependencies [6d28fd7]
- Updated dependencies [67612d7]
  - @nmi-agro/fdm-core@0.28.0
  - @nmi-agro/fdm-calculator@0.10.0
  - @nmi-agro/fdm-data@0.19.1

## 0.25.4

### Patch Changes

- ff45398: Fix rendering issue of button in magic link email for some versions of Outlook and include a fallback link

## 0.25.3

### Patch Changes

- 598a3b6: At RVO MijnPercelen shapefile upload store SECTORID as b_id_source for the field

## 0.25.2

### Patch Changes

- f443234: Fixes that saved fields of the farm are visible again with a colored outline

## 0.25.1

### Patch Changes

- c9a37ab: Patch for CVE-2025-55182

## 0.25.0

### Minor Changes

- e16b86d: Show sidebar item to be active when visiting the page of that item
- b572a3e: Adds new parameters to the `harvestableAnalyses` table to provide a more detailed analysis of harvested crops:
  - **`b_lu_yield_fresh`**: Mass of fresh harvested products (kg/ha). This parameter measures the total fresh weight of the harvested crop per hectare, providing a baseline for yield assessment.
  - **`b_lu_yield_bruto`**: Mass of fresh harvested products, including tare (kg/ha). This represents the gross weight of the harvest before cleaning, accounting for soil and other debris.
  - **`b_lu_tarra`**: Tare percentage of the fresh harvested product mass (%). This is the percentage of non-product material (e.g., soil, stones) in the gross harvest weight.
  - **`b_lu_dm`**: Dry matter content of the harvested products (g/kg).
  - **`b_lu_moist`**: Moisture content of the harvested products (%).
  - **`b_lu_uww`**: Underwater weight of the fresh harvested products (g/5kg). This measurement is often used to estimate the starch content and dry matter content of potatoes and other root crops.
  - **`b_lu_cp`**: Crude protein content (g CP/kg).
- a50bb0f: Show fertilizer icon in the fields table for fertilizers
- 43096b4: Add toggle to map controls to hide or show the field layers
- 67b08bf: At the field nitrogen balance show the nitrate emission
- ada7a6a: Add a rotation page that shows per cultivation the details in a table
- d8dcd23: Various UI elements are now hidden or grayed out if the current logged-in user doesn't have permission to perform the actions that they represent.
- 6f51ad5: In the sidebar, when a farm is selected, show the farm name and role that the user has.
- 63756c2: Add the organic matter balance as a new app
- 573930b: At the nitrogen balance show emissions with ammonia and nitrate separately in the chart and cards
- 88ebf8a: Use a new form design for harvests, that requests the specific yield parameters, which can be use to calculate dry matter yield and nitrogen content of harvestable products
- 391f85f: Improve design of the overview of harvests for a cultivation. Show now also the relevant harvest parameters for that cultivation
- f9811eb: In case a cultivation cannot be harvested, hide the 'Oogst toevoegen' button instead of disabling it

### Patch Changes

- 887ead3: Upgrade to Node.js v24
- 6e72706: Removed clutter from form-upload components by moving the drag-and-drop handlers into a new Dropzone component.
- 43096b4: Fixes the geocoder bar being collapsed on mobile
- 1feffff: The code for fertilizer management is made more maintainable by using only one route for all fertilizer application routes.
- a4e4e15: Fixes date parsing in "old-style" date-picker
- 9f8977c: Optimize Vite build configuration:
  - Removed inefficient manual chunk splitting.
  - Simplified Sentry plugin activation logic.
  - Removed unnecessary `global` polyfill.
  - Fixed `sentryReactRouter` argument passing.

- Updated dependencies [d8dcd23]
- Updated dependencies [7a8f5a9]
- Updated dependencies [ca76b7d]
- Updated dependencies [43d35b2]
- Updated dependencies [cd8a771]
- Updated dependencies [6f51ad5]
- Updated dependencies [0268ecd]
- Updated dependencies [dd3a6f1]
- Updated dependencies [b24d2d1]
- Updated dependencies [9283c86]
- Updated dependencies [21a4cf9]
- Updated dependencies [f51b412]
- Updated dependencies [3b5cd55]
- Updated dependencies [f51b412]
- Updated dependencies [b24d2d1]
- Updated dependencies [92fdf21]
  - @nmi-agro/fdm-core@0.27.0
  - @nmi-agro/fdm-calculator@0.9.0
  - @nmi-agro/fdm-data@0.19.0

## 0.24.2

### Patch Changes

- Updated dependencies [ed53b86]
  - @nmi-agro/fdm-data@0.18.1
  - @nmi-agro/fdm-core@0.26.1
  - @nmi-agro/fdm-calculator@0.8.0

## 0.24.1

### Patch Changes

- f50e3aa: Server-side upload limit is increased to 5MB for shapefiles and soil analyses, in order to match the value used for form validation.

## 0.24.0

### Minor Changes

- 9dfde4c: Replace Meststoftype with Mestcode (RVO) at fertilizer forms
- 5e711d7: Improve the design of the list of fertilizer applications by adding an icon for the type of fertilizer and better usage of spacing and aligning
- bf8b0ff: In the fertilizer table show the RVO mestcode (p_type_rvo) colored by p_type instead of only p_type
- 2c9aafa: Add new page at farm details to add whether the farm has an organic certification
- 06314a5: Fixes that user can drop files as well for Mijn Percelen shapefile upload and Soil Analysis pdf upload.
- b71bf41: Users can now edit previously created fertilizer applications, both for individual fields or a given cultivation type.
- 77c309d: In case a field has an error at the nitrogen balance calculation, the balance at farm level and other fields are still shown, but an error message for the specific field is shown
- c1ebe6d: Add new page at farm details to state whether the farmer has done grazing or intends it for a year
- d756cf4: The users can now drop files onto the entire shapefile upload area during farm creation, not just on top of the text and icons.
- d279d08: For cultivations default dates based on the cultivation catalogue date are used for b_lu_start and b_lu_end if available when adding a field with a cultivation
- 276f35a: Show to the farm norms page the filling of the norms as well
- 3eb4ec2: At the fertilizer applications page for a field show the metrics for norms, nitrogen balance and nutrient advice as well
- 73be0f3: Add page to show on field level the norm values and fillings. It shows also the contribution of each fertilizer application to the various norms

### Patch Changes

- 1a89d67: Submit "other" errors for loaders and actions to Sentry
- 8f8cc9f: At Nutrient Advice show progress bar for nutrients that have advice of 0
- beef80c: Submit calculation errors at nitrogen balance calculation to Sentry
- 8b854af: Move `getNutrientAdvice` to fdm-calculator and use the cached version of the function
- 8f8cc9f: At Nutrient Advice show doses with precision of 2 if dose is between 0 and 1 kg / ha instead of showing 0
- a2f8419: Fix parsing of `b_date` in the response for th soil analysis extraction
- da64906: Fix link in header of fertilizers
- 91d4103: Switch to use the cached version of the calculator functions for `norms` and `balance`
- Updated dependencies [97083dd]
- Updated dependencies [a74a6e8]
- Updated dependencies [a226f7e]
- Updated dependencies [77c309d]
- Updated dependencies [a00a331]
- Updated dependencies [726ae00]
- Updated dependencies [8f9d4ff]
- Updated dependencies [2f7b281]
- Updated dependencies [c939de9]
- Updated dependencies [b58cd07]
- Updated dependencies [77c309d]
- Updated dependencies [d6b8900]
- Updated dependencies [b58cd07]
- Updated dependencies [ac5d94f]
- Updated dependencies [91d4103]
- Updated dependencies [8b2bf8c]
- Updated dependencies [6bcb528]
- Updated dependencies [91d4103]
  - @nmi-agro/fdm-data@0.18.0
  - @nmi-agro/fdm-calculator@0.8.0
  - @nmi-agro/fdm-core@0.26.0

## 0.23.2

### Patch Changes

- 2ba569e: The atlas no longer redirects the users to an invalid route when they don't have any farms.

## 0.23.1

### Patch Changes

- Updated dependencies [ba3d4d3]
- Updated dependencies [dcf0577]
- Updated dependencies [e715493]
- Updated dependencies [e4ce36a]
- Updated dependencies [12565b2]
  - @nmi-agro/fdm-calculator@0.7.1
  - @nmi-agro/fdm-data@0.17.1
  - @nmi-agro/fdm-core@0.25.1

## 0.23.0

### Minor Changes

- 57b4fe8: Add a toggle to show all or only productive fields at various pages that show a list of fields
- c3e5388: In the farm create wizard, show the cultivations in the bouwplan sorted by descending total area (instead of a random order)
- 638ac47: Organization invitation emails now come with accept and reject buttons which will make accepting or rejecting the invitation easier for the invitee.
- 92e7b30: Adds a new farm dashboard page with an overview of the farm and links to apps, data pages, and quick actions.
- 47acfac: Add a new page to apply a fertilizer application to multiple fields at once.
- 4174369: While at the fertilizer application form users can navigate to the page to add a new custom fertilizer. After successful submission the user is directed back to the fertilizer application form.
- 26d4f93: The timestamp in the magic link email now shows the user's own timezone when it is able to be determined.
- f72e93b: Add feature to delete a farm at the farm settings
- 47acfac: Add a new page showing an advanced table for the fields of the farm, including searching on field name, cultivations, and fertilizers. It also includes multi‑selection of fields to add a new fertilizer application.

### Patch Changes

- 77eb67f: In norms, when a field has an error during calculation, show an error message on that field’s card; also show a general error for the whole page; still render the fields that were calculated successfully.
- 86470a9: While reviewing newly created fields or viewing individual fields on the map, the map now centers on the field when a new field is selected.
- Updated dependencies [7cfc412]
- Updated dependencies [85b964d]
- Updated dependencies [af57dd1]
- Updated dependencies [82bb999]
- Updated dependencies [29b0937]
- Updated dependencies [8333884]
- Updated dependencies [16270d6]
- Updated dependencies [e844f9d]
- Updated dependencies [aa7a1b1]
- Updated dependencies [fa5aab5]
- Updated dependencies [d25b70e]
- Updated dependencies [14c8a06]
- Updated dependencies [be7d733]
- Updated dependencies [a1ef995]
- Updated dependencies [8cc6e4a]
- Updated dependencies [5cf76d4]
- Updated dependencies [86e16c2]
  - @nmi-agro/fdm-calculator@0.7.0
  - @nmi-agro/fdm-core@0.25.0
  - @nmi-agro/fdm-data@0.17.0

## 0.22.4

### Patch Changes

- 5848723: Remove uploaded shapefile after uploading
- 65d2a3d: Fixes to keep files in the upload box when selecting another (new) shapefile to upload
- cd4cc8a: Fields are sorted by descending area instead of alphabetical name.
- Updated dependencies [787fa53]
- Updated dependencies [cd4cc8a]
  - @nmi-agro/fdm-core@0.24.2
  - @nmi-agro/fdm-calculator@0.6.1

## 0.22.3

### Patch Changes

- 8cb3c92: Ensure the selected field’s cultivation is preselected when adding a new field on the New Fields page
- bedd5a4: Increase streamTimeout from 10 seconds to 30 seconds to enable longer running calculations
- Updated dependencies [e964a18]
- Updated dependencies [0c29661]
  - @nmi-agro/fdm-core@0.24.1
  - @nmi-agro/fdm-calculator@0.6.0

## 0.22.2

### Patch Changes

- faa29b3: Fix issue with loading the variable for the colors of the field in production

## 0.22.1

### Patch Changes

- Fix deployment issue

## 0.22.0

### Minor Changes

- 8eef979: Replace environment variable FDM_PUBLIC_DATA with PUBLIC_FDM_DATASETS_URL
- f76e542: Redesign fields at Atlas to show all fields and redirect to details page when clicked
- d0b583e: Show available fields in different colors based on cultivation type.
- fbbf8b0: Add `CultivationDetailsCard` to enable the user, when applicable for this cultivation, to select a variety.
- e3be520: Redesigned the page for "whats-new" by introducing a new changelog component
- f62e218: Add a button at the fields page on the farm create wizard to go back to the atlas page to select more fields
- f62e218: On the farm create wizard atlas page show the already stored fields as well, next to the available fields and selected fields
- af9b222: Add at Atlas Fields that when a field is clicked, details about that field, like cultivation history and soil texture are shown on fields details page
- cb2b139: Atlas is now also available without selecting a farm first
- 714bb03: Add `b_lu_rest_oravib` as parameter to cultivationCatalogue. This boolean parameter specifies if the cultivation is classified as 'rustgewas'.
- d5edaf0: Atlas: show the available-fields dataset for the selected calendar year
- 5c51ccb: Redesign the landing page after signin with cards that show new farm and atlas. When first logged in show 2 detailed cards with the background information about the farm and atlas tool
- f62e218: Color of selected fields is changed from red to yellow
- d242f3a: Make nutrient balance, nutrient advice, and norms pages load quickly before any expensive calculations so they properly show their spinners.
- 6b21590: Add notification to sidebar in case a new entry is available at the "whats-new" page
- d0b583e: Selected fields now have an outline instead of a different fill color in the farm creation wizard atlas.
- f62e218: When additional fields are created through the wizard they are named with numbers starting from the number of previously created fields

### Patch Changes

- fb59ff3: Dismissing the add field dialog in the add field atlas screen no longer produces an error.
- c0cb40c: Switch the 2024 available fields layer from "draft" to "definitive".
- c246926: Migrate Sentry to `@sentry/react-router` (RRv7 integration with improved routing-aware tracing and profiling)
- 4faf86c: When using the header on a field’s cultivations page to switch fields, also update the information shown in the cultivation details card.
- a88f105: Fixes that map for adding a new field was not interactive when the farm did not have a field yet
- Updated dependencies [344e75c]
- Updated dependencies [34ce6df]
- Updated dependencies [140e957]
- Updated dependencies [5790000]
- Updated dependencies [34b6e57]
- Updated dependencies [12dbc4c]
- Updated dependencies [34ce6df]
  - @nmi-agro/fdm-core@0.24.0
  - @nmi-agro/fdm-data@0.16.0
  - @nmi-agro/fdm-calculator@0.6.0

## 0.21.0

### Minor Changes

- db525fc: Enable uploading a Mijn Percelen shapefile instead of selecting fields on the atlas page.
- 99aec54: At farm create wizard for Bouwplan improve list of cultivations and provide more information as number of fields and total area
- c3f1454: Replace the options for `b_acquiring_method` with the new options following RVO specification
- ce5fcdb: At field properties add a section to delete a field
- fcfc84e: Improved design of fertilizer application pages by combining various components into a single card
- b7d95e0: Add for pages with calculations (.e.g., nutrient advice, norms and balance) placeholders with skeletons so that user sees the page already and is notified that the content will arrive shortly
- 99aec54: At farm create wizard for Bouwplan split Gewassen en Bemesting in 2 seperate pages instead of tabs
- 5708973: Add new app `Gebruiksnormen` to show legal norms at farm and field level
- d5fb186: Allow selecting a non-current year in the farm-creation wizard
- 65fb0ed: Add an option in the farm-creation wizard to specify the start year of a farm’s derogation
- e6a9d4e: Add page to manage derogation for a farm
- 99aec54: Overhaul the pages with cultivation and harvests to enable users to quickly select a cultivation, get the details and list of harvest and enable to open dialogs to add new cultivations and harvests
- 0c367ea: Add delete field button at fields page in Farm Create Wizard

### Patch Changes

- db5e7fe: Update dependencies
- 94250d9: Fixes incorrect unit description of `b_lu_n_harvestable`
- ec3c5c8: Fix metadata of "New field" page
- Updated dependencies [52e0959]
- Updated dependencies
- Updated dependencies [0f8e4eb]
- Updated dependencies [db5e7fe]
- Updated dependencies [6821ee9]
- Updated dependencies
- Updated dependencies [b502367]
- Updated dependencies [b40cffa]
- Updated dependencies [cbf5340]
- Updated dependencies [51722cc]
- Updated dependencies [f19238b]
- Updated dependencies [2ac1471]
  - @nmi-agro/fdm-core@0.23.0
  - @nmi-agro/fdm-calculator@0.5.0
  - @nmi-agro/fdm-data@0.15.0

## 0.20.4

### Patch Changes

- f589317: Fix storing additional soil parameters when adding a new field (not in the farm create wizard)

## 0.20.3

### Patch Changes

- 4f25214: Fixes exception when adding a harvest in farm create wizard

## 0.20.2

### Patch Changes

- e8aceb2: Fix missing "continue" button on Bouwplan page in Farm Create Wizard

## 0.20.1

### Patch Changes

- 4e8c707: Fix showing emission values at nitrogen balance chart
- f942466: Fix saving form when parameter is of type Date, not filled in and optional
- Updated dependencies [ffd1b3e]
- Updated dependencies [7c36ecc]
- Updated dependencies [3e73281]
  - @nmi-agro/fdm-data@0.14.1
  - @nmi-agro/fdm-calculator@0.4.1
  - @nmi-agro/fdm-core@0.22.1

## 0.20.0

### Minor Changes

- b1301fa: Add nutrient advice as new application
- f548dea: Add the ability to upload a pdf with a soil analysis, extract the values and save it
- 3f79b0e: Display the application method for each fertilizer application in the list
- 32aefb9: Add to interactive maps a search bar as control to lookup addresses and navigate them to
- be6469f: Combine datepickers into a single component and include new features as dropdown selection of year and month and text input
- 36803f1: Add a feature to select an existing fertilizer as a template for new fertilizers
- 2fb2db3: Improve the design of the fertilizer form page by making it more intuitive and clear.
- 5f9e9e0: Add an application-method field to the fertilizer-application form
- c865f44: In the nitrogen balance, show the total amount of ammonia emitted and provide field-level details.
- 6a42aa0: For new farms use the `baat` catalogue for fertilizers instead of `srm`

### Patch Changes

- c962751: Replace the `p_type_*` boolean flags with the unified `p_type` field across all fertilizer functions
- 691af1d: Update and migrate to next version of radix-ui
- 14e57e6: Update to tailwind v4
- 14e57e6: Update to react 19
- Updated dependencies [ce5ffa8]
- Updated dependencies [b6721b4]
- Updated dependencies [955f854]
- Updated dependencies [093784b]
- Updated dependencies [e37b6f0]
- Updated dependencies [780e8c4]
- Updated dependencies [ac05d8b]
- Updated dependencies [7f95233]
- Updated dependencies [5d0a80b]
- Updated dependencies [a58b367]
- Updated dependencies [afe2a32]
- Updated dependencies [fbbdc57]
- Updated dependencies [e6c0fa3]
- Updated dependencies [2c6251c]
- Updated dependencies [75693e4]
- Updated dependencies [a898e30]
  - @nmi-agro/fdm-core@0.22.0
  - @nmi-agro/fdm-calculator@0.4.0
  - @nmi-agro/fdm-data@0.14.0

## 0.19.6

### Patch Changes

- f2b1fc6: Fixes redirects at harvest details page
- Updated dependencies [94a82f6]
  - @nmi-agro/fdm-calculator@0.3.3

## 0.19.5

### Patch Changes

- a3ede17: Redirect all subdomains, except .dev, to original hostname

## 0.19.4

### Patch Changes

- 59723e9: Make content parameters optional when adding a custom fertilizer
- 3bd7ca5: Fix exception in fertilizer application form when no fertilizer is selected
- 4c34442: Fix disabling of the update field form in the create farm wizard during submission
- e199f76: Fix visibility of custom fertilizers in the fertilizer list
- 3009a33: Fix exception in the update field form in the farm creation wizard

## 0.19.3

### Patch Changes

- db2f2cb: Make the ChevronDown icon in header less prominent
- e4f70cf: Make more clear that buttons in the sidebar with no action are not clickable
- 885588e: Show absolute values at balance chart
- efa12f6: Do not show dropdown menu if no options are provided
- 046fdd2: Fix dead link for `Bedrijf` at '/farm' page
- 40cf4b6: At nitrogen balance details for field show harvest date and link to harvest page instead of harvest id
- 7711209: Fix redirect after successful harvest form submission

## 0.19.2

### Patch Changes

- 284f17a: Fix hydration error

## 0.19.1

### Patch Changes

- a452ac8: Fix various validation issues at soil analysis form
- bc2b796: Remove the incorrect nitrogen limit value from fertilizer application cards
- 3f5fd9a: Clear value for p_app_amount on fertilizer application form after successful submission
- ad75270: Fix exception when clicking on a field to add a new field
- Updated dependencies [8cb4399]
  - @nmi-agro/fdm-core@0.21.1
  - @nmi-agro/fdm-calculator@0.3.2

## 0.19.0

### Minor Changes

- a963506: Redirect users with incomplete profiles to the welcome page
- 004c58d: Add option to sign in with magic-link
- 4db6f37: Redirect new users to welcome page (if no redirect is provided) to complete their profile

### Patch Changes

- aba0f81: Add tags to emails
- 050f170: Fix showing avatar image at dropdown menu
- c1ad4b7: Fix loading public environment variables on the server side by using the correct prefix
- Updated dependencies [004c58d]
- Updated dependencies [7b447f6]
- Updated dependencies [7b447f6]
- Updated dependencies [842aac4]
  - @nmi-agro/fdm-core@0.21.0
  - @nmi-agro/fdm-calculator@0.3.1

## 0.18.2

### Patch Changes

- 2d163bf: Public environmentals that are used client-side are now set at runtime instead of buildtime
- 7bde06a: Rename prefix of public environmentals from `VITE_` to `PUBLIC_`

## 0.18.1

### Patch Changes

- 8d36091: Fix button to update cultivation will not redirect to 404 page but update the values
- 497343c: Fix that max for `b_lu_yield` is 100000 instead of 100
- 03de714: Fix that values in cultivation form update when selecting a different cultivation at cultivation plan

## 0.18.0

### Minor Changes

- a07adde: Show a comparison of the nitrogen balance with the target level on both farm and field pages
- ceb72eb: Implement core organization management features, including creation, listing, user invitations, and invitation management.
- e870059: Add block to enable sharing of farm to other users and organizations
- 58c2a56: Add `a_nmin_cc` to nmin soil analysis
- 8303ad7: For the source of the soil analysis, users can now choose from a list of sources instead of a text field
- f1cb0bc: Rename Kaart to Atlas and move to apps
- ca0d61b: Add a platform sidebar that helps the user to navigate all the platform related things, like account management, settings, organizations etc.
- 2771859: Add new soil parameters to soil analysis: `a_n_rt`, `a_c_of`, `a_cn_fr` and `a_density_sa`
- b9ecbe6: Expand integration with NMI to include more soil parameters: `a_al_ox`, `a_ca_co`, `a_ca_co_po`, `a_caco3_if`, `a_cec_co`, `a_cn_fr`, `a_com_fr`, `a_cu_cc`, `a_fe_ox`, `a_k_cc`, `a_k_co`, `a_k_co_po`, `a_mg_cc`, `a_mg_co`, `a_mg_co_po`, `a_n_pmn`,`a_p_ox`, `a_p_rt`, `a_p_sg`, `a_p_wa`, `a_ph_cc`, `a_s_rt`, `a_sand_mi`, `a_silt_mi`, `a_zn_cc`
- ff08686: Add the ability to select a type of soil analyses so that a subset of parameters can be shown at the form
- ed226af: Redesign the page on which the farm can be selected by providing a card with some details for every farm
- 6b21513: Show a bar chart on the nitrogen balance pages for farms and fields to compare supply, removal, and emission

### Patch Changes

- 971e813: Use configurable link to open a new page with the privacy policy
- 92a1098: When another field of farm is selected in the page header, it does not redirect you anymore to the start page of farm or field, but reloads tthe current page with the new selected field or farm
- 63a4cea: Move what's new page to about section
- 13210e6: Limit that each harvest can have only 1 harvestable and not multiple
- 6dfba80: Redirect unauthenticated users to their originally requested page after sign-in.
- Updated dependencies [e260795]
- Updated dependencies [0dc93fd]
- Updated dependencies [5a3bf78]
- Updated dependencies [c44812f]
- Updated dependencies [cf399ca]
- Updated dependencies [249138c]
- Updated dependencies [119c328]
- Updated dependencies [f05e1cb]
- Updated dependencies [9a5be3b]
- Updated dependencies [6292cf3]
- Updated dependencies [f05e1cb]
- Updated dependencies [286abb9]
- Updated dependencies [bdf0cb0]
- Updated dependencies [343c580]
- Updated dependencies [ef8a2c6]
- Updated dependencies [119c328]
- Updated dependencies [e260795]
- Updated dependencies [ba3801c]
- Updated dependencies [13210e6]
- Updated dependencies [c122c66]
- Updated dependencies [18f195b]
- Updated dependencies [a550805]
- Updated dependencies [7e881c1]
- Updated dependencies [d4a7e02]
- Updated dependencies [e0a779c]
- Updated dependencies [c44812f]
- Updated dependencies [dd7bb7b]
- Updated dependencies [ec0494c]
- Updated dependencies [0a546d4]
- Updated dependencies [ec0494c]
- Updated dependencies [6676992]
- Updated dependencies [4027c9a]
  - @nmi-agro/fdm-core@0.20.0
  - @nmi-agro/fdm-calculator@0.3.0

## 0.17.2

### Patch Changes

- e569e34: Fix loading of `farm/create/$b_id_farm/$calendar/fields` page
- b2ae7ad: Change behavior so that hitting the enter button at `farm/create` submits the form instead of navigating back

## 0.17.1

### Patch Changes

- 516784b: Fixes client side configuration by providing at build stage
- Updated dependencies [eed1780]
  - @nmi-agro/fdm-core@0.19.0
  - @nmi-agro/fdm-calculator@0.2.6

## 0.17.0

### Minor Changes

- 05bc116: Add titles and descriptions to pages
- 694fff5: Replace placeholder with FDM logo
- 694fff5: Use FDM logo for favicon
- 901be37: Redesigned the soil component on the field page of the Create Farm Wizard
- b5afe8b: Add page to show the list of fertilizers available on the farm
- 800feaa: Add `Kalender` to sidebar. This enables users to filter assets and actions based on the selected year or to show all of them.
- 199cba4: Add a message at signin page that the app is still in development
- b5afe8b: Add page to show details of a fertilizer, and if applicable, to update the values
- 542f55b: When farm is created enable fertilizer catalogue with custom fertilizers for that specific farm
- 34113b1: Add page to add a field to a farm
- cc66860: Add ability to perform a new soil analysis in the Create Farm Wizard
- dedef47: After registration send the user a welcome email
- b5afe8b: Add page to add new fertilizer for a farm
- 8e17182: Make fdm-app configurable for various settings, including the name
- 901be37: Improve layout of the fields page in the Create Farm Wizard
- 33434c6: Add analytics by integrating posthog

### Patch Changes

- 5f81d42: Allow display of Microsoft profile picture
- b06b809: Do not build sourcemaps at production
- 7b86f47: Fix rendering harvest list page and harvest detail page at create farm wizard
- 7d8527c: Allow display of Google profile picture
- 0318a4c: Users are now automatically redirected to the sign-in page when encountering a 401 error.
- 4d049ce: Fixes unit of `b_lu_yield` to be same as in `fdm-core`, i.e. kg DS / ha
- 917b36b: Improve bundle by manually chunking
- d380f66: Refactored farm context into using a zustand store
- be9bf5b: Disable sidebar links during create farm wizard
- dedef47: Add email integration with Postmark, including:
  - New environment variables for Postmark configuration
  - Integration with Postmark API for sending transactional emails
  - Support for HTML email templates
- Updated dependencies [c240486]
- Updated dependencies [e9926cb]
- Updated dependencies [82f4767]
- Updated dependencies [a52796a]
- Updated dependencies [9ea6795]
- Updated dependencies [a259ff6]
- Updated dependencies [01081b3]
- Updated dependencies [d693cdb]
- Updated dependencies [0944ef1]
- Updated dependencies [175ea6a]
- Updated dependencies [9f4d818]
  - @nmi-agro/fdm-core@0.18.0
  - @nmi-agro/fdm-calculator@0.2.5

## 0.16.0

### Minor Changes

- 7ec422b: Improve the links in the sidebar. Activate them when the farm is selected
- df5b29d: Add mailto link at `Ondersteuning` in sidebar
- e093565: Deactivate the button to add a new field
- 9877b9c: Add "what's new" page
- bd84340: Deactivate links in sidebar to `Nutrientenbalans`, `OS Balans` and `BAAT`
- e36c466: Remove links in the sidebar to `Meststoffen`, `Gewassen` and `Stal & Dieren`
- d062979: Add page with account details

### Patch Changes

- 932c410: Fixes at the fields page in the create farm wizard the values in the form change when another field is selected
- d20d1db: Improve and standardize the handling of avatar initials
- a13b971: Fix CSP setting for requesting field geometries from Google Cloud Storage
- Updated dependencies [9bfd0a8]
  - @nmi-agro/fdm-core@0.17.0
  - @nmi-agro/fdm-calculator@0.2.4

## 0.15.0

### Minor Changes

- c399b8b: Add `docker-compose.yml` for instructions to run `fdm-app` together with a database
- c399b8b: Add docker file to build image for `fdm-app`
- a5f5c3b: Add cache control settings and setting security headers

### Patch Changes

- Updated dependencies [e134cfc]
  - @nmi-agro/fdm-core@0.16.0
  - @nmi-agro/fdm-calculator@0.2.3

## 0.14.0

### Minor Changes

- 89ce485: Show only cultivation and fertilizers from catalogues that are enabled

### Patch Changes

- 121edf9: Add that the `srm` and `brp` catalogues are enabled
- 2fd9dc8: Use the `syncCatalogues` function to replace `extendFertilizersCatalogue` and `extendCultivationsCatalogue` functions
- d7bbdf9: Remove dependency on `fdm-data`
- Updated dependencies [b601b5f]
- Updated dependencies [9b1f522]
- Updated dependencies [f056396]
- Updated dependencies [cdb1d02]
- Updated dependencies [9a6e329]
  - @nmi-agro/fdm-core@0.15.0
  - @nmi-agro/fdm-calculator@0.2.2

## 0.13.1

### Patch Changes

- 98e20ac: List other `fdm` packages as `dependencies` instead `peerDependencies` to prevent not needed major version bumps
- Updated dependencies [98e20ac]
  - @nmi-agro/fdm-calculator@0.2.1
  - @nmi-agro/fdm-data@0.10.3

## 0.13.0

### Minor Changes

- c5c3dd9: Do not show example values for advice and limit at fertilizer application cards
- 3759d58: Add a card at fertilizer applications with workable nitrogen

### Patch Changes

- 46b9f71: Rename `b_harvesting_date` to `b_lu_harvest_date`
- d9d2b6f: Fix displaying unit of `p_app_amount`
- 649d93b: Rename `b_terminating_date` to `b_lu_end`
- e67cf12: Rename `b_acquiring_date` to `b_start`
- e82a0eb: Improve layout of the fields page at the create farm wizard to show the map better
- 054da12: Fix saving fields details at create farm wizard by using correct format for b_area
- 877a7f1: Remame `b_discarding_date` to `b_end`
- 3e77a90: Fix exception at adding fertilizer applications in create farm wizard
- def1d0b: Rename `b_sowing_date` to `b_lu_start`
- Updated dependencies [4d1dbd9]
- Updated dependencies [4d1dbd9]
- Updated dependencies [0224544]
- Updated dependencies [0b28bd5]
- Updated dependencies [45eda20]
- Updated dependencies [1a295b0]
- Updated dependencies [6a01698]
- Updated dependencies [e312060]
- Updated dependencies [972bac8]
- Updated dependencies [7387530]
  - @nmi-agro/fdm-core@0.14.0
  - @nmi-agro/fdm-calculator@1.0.0
  - @nmi-agro/fdm-data@1.0.0

## 0.12.0

### Minor Changes

- 315125e: Implement the authorization functionalities of fdm-core

### Patch Changes

- 7f4835c: Switch to using auth from fdm-core instead of a separate implementation
- 8306249: Standardize error handling in actions
- 82238cc: Standardize handling errors at loaders
- Updated dependencies [9830186]
- Updated dependencies [06619e7]
- Updated dependencies [da00990]
  - @nmi-agro/fdm-core@0.13.0
  - @nmi-agro/fdm-calculator@1.0.0
  - @nmi-agro/fdm-data@1.0.0

## 0.11.2

### Patch Changes

- Patches for GHSA-vp58-j275-797x and GHSA-hjpm-7mrm-26w8

## 0.11.1

### Patch Changes

- 286adf6: Fix error handling at sign-in page

## 0.11.0

### Minor Changes

- e1fef45: Add Microsoft OAuth2 sign-in method alongside existing Google authentication
- 33b8b59: Show at fertilizer application form the nutrient doses
- e1fef45: At the sign-in page, use a card to present sign-in methods including Microsoft and Google.
- 0bbf9c2: Add redirect to first field at fields page in create farm wizard
- d61a487: Redirect to first cultivation at the transition from fields to cultivationplan at the create farm wizard
- 1eef110: Add a feedback form
- 1ebb30c: Add ErrorBoundary to catch errors and redirect user to error page
- 1eef110: Add telemetry to Sentry
- 1ebb30c: Add styled error pages to provide users an informative message about what happened

### Patch Changes

- 920f166: Drop use of `wkx`
- ac07a8b: Improve layout of fieds page with cards at create farm wizard
- Updated dependencies [475986f]
- Updated dependencies [5d2871e]
- Updated dependencies [644a159]
- Updated dependencies [2508042]
- Updated dependencies [e518d78]
- Updated dependencies [9e05058]
- Updated dependencies [d2a2ab7]
- Updated dependencies [1b435a3]
- Updated dependencies [488f898]
- Updated dependencies [ed82ff6]
- Updated dependencies [d2a2ab7]
- Updated dependencies [aede4a7]
- Updated dependencies [9e6f2d7]
- Updated dependencies [644a159]
  - @nmi-agro/fdm-calculator@1.0.0
  - @nmi-agro/fdm-core@0.12.0
  - @nmi-agro/fdm-data@1.0.0

## 0.10.1

### Patch Changes

- Patch for GHSA-9x4v-xfq5-m8x5

## 0.10.0

### Minor Changes

- 93dd8e7: Add `Atlas` for farm page to show maps at the farm level (currently only fields is supported)

### Patch Changes

- 93dd8e7: Refactored the Atlas components to make them more flexible and readable

## 0.9.1

### Patch Changes

- 638b34e: Fix adding a new cultivation to a field
- 15a52e1: Fix clicking in log out button
- Updated dependencies [bc52f62]
- Updated dependencies [9b53632]
  - @nmi-agro/fdm-core@0.11.3
  - @nmi-agro/fdm-data@0.9.0

## 0.9.0

### Minor Changes

- Add fields overview page of farm
- Add page with details of a field

### Patch Changes

- 72af577: Fixes build of `fdm-app` by targetting ES2022
- Updated dependencies [341b0a3]
- Updated dependencies [0d97679]
- Updated dependencies [f7d7a50]
- Updated dependencies [899b99c]
- Updated dependencies [f7d7a50]
- Updated dependencies [c584d5a]
- Updated dependencies [f7d7a50]
- Updated dependencies [073b92e]
  - @nmi-agro/fdm-core@0.11.0
  - @nmi-agro/fdm-data@1.0.0

## 0.8.2

### Patch Changes

- Replace ESLint with Biome and format the code accordingly
- Updated dependencies
  - @nmi-agro/fdm-core@0.10.2
  - @nmi-agro/fdm-data@0.8.2

## 0.8.1

### Patch Changes

- Use the same version for `vite`, `typescript` and `dotenvx` across packages and update those to the latest version
- Updated dependencies
  - @nmi-agro/fdm-core@0.10.1
  - @nmi-agro/fdm-data@0.8.1

## 0.8.0

### Minor Changes

- fe29385: Rename path `app` to `farm` and `app/addfarm` to `farm/create`
- fe29385: Add a page `farm` to select from list of farms

  Changes include:
  - Restructured routing: renamed paths from `app/addfarm` to `farm/create`
  - Updated farms table schema:
    - Added: business ID, address, and postal code fields
    - Removed: sector field
  - Added new `getFarms` function for farm management

- fe29385: Add farm settings page and restructure routes
  - Add new farm settings page for managing farm configurations
  - Restructure routes: rename 'app' to 'farm' and 'app/addfarm' to 'farm/create'
  - Add new farm fields: business ID, address, and postal code
  - Improve farm selection interface with time-based greetings

### Patch Changes

- Updated dependencies [520a074]
- Updated dependencies [2171b68]
- Updated dependencies [2171b68]
  - @nmi-agro/fdm-core@0.10.0
  - @nmi-agro/fdm-data@1.0.0

## 0.7.0

### Minor Changes

- a2a7fea: Add panels to the atlas-fields component with information about the fields selected and hovered
- a2a7fea: Refactor map page to atlas to improve extensibility
- a2a7fea: Load fields from external flatgeobuffer source instead of an API to improve performance

## 0.6.0

### Minor Changes

- Refactor design `fields` page in `addfarm` and enable to see soil status and update the properties of the field

### Patch Changes

- Updated dependencies [441decd]
- Updated dependencies [71cbba3]
- Updated dependencies [5d0e1f7]
- Updated dependencies [315710b]
  - @nmi-agro/fdm-core@0.9.0
  - @nmi-agro/fdm-data@1.0.0

## 0.5.0

### Minor Changes

- 47e2651: Switch to sign in method for authentication including social log in

### Patch Changes

- 83c589b: Upgrade `drizzle-orm` to v0.38.2 and `drizzle-kit` to v0.30.1
- Updated dependencies [83c589b]
- Updated dependencies [6a3e6db]
  - @nmi-agro/fdm-core@0.8.0
  - @nmi-agro/fdm-data@0.6.0

## 0.4.0

### Minor Changes

- bee0e62: Add `FertilizerApplicationsForm` to list, add and delete fertilizer applications
- 4112897: Remove selection of fertilizers for acquiring but select all fertilizers

### Patch Changes

- Updated dependencies [7af3fda]
- Updated dependencies [bc4e75f]
- Updated dependencies [a948c61]
- Updated dependencies [efa423d]
- Updated dependencies [b0c001e]
- Updated dependencies [6ef3d44]
- Updated dependencies [61da12f]
- Updated dependencies [5be0abc]
- Updated dependencies [4189f5d]
  - @nmi-agro/fdm-core@0.7.0
  - @nmi-agro/fdm-data@1.0.0

## 0.3.1

### Patch Changes

- 9a410b1: Migrated from Remix v2 to React Router v7

## 0.3.0

### Minor Changes

- Implement client-side form validation using Zod for the signup, add farm, and add fields forms.
- Add visual indicators when fields are loading on the map to enhance user experience.

## 0.2.0

### Minor Changes

- e1aa0ee: Rename an app to `Nutriëntenbalans`

### Patch Changes

- bfa7927: Increase width of sidebar on desktop to `18rem`
- 35c55e1: Add example configuration file as `.env.example`
- Updated dependencies [d39b097]
- Updated dependencies [35c55e1]
- Updated dependencies [6694029]
- Updated dependencies [c316d5c]
- Updated dependencies [b1dea77]
- Updated dependencies [d39b097]
- Updated dependencies [49aa60c]
  - @nmi-agro/fdm-data@1.0.0
  - @nmi-agro/fdm-core@0.6.0

## 0.1.0

A first prototype of an application for fdm with minimal functions
