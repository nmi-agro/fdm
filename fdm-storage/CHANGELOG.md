# @nmi-agro/fdm-storage

## 0.1.0

### Minor Changes

- [#916](https://github.com/nmi-agro/fdm/pull/916) [`971f138`](https://github.com/nmi-agro/fdm/commit/971f138a51fe4a3fa02b77d6c00930a81adf4fd1) Thanks [@SvenVw](https://github.com/SvenVw)! - New package with file storage for FDM: a `FileStorage` interface with an implementation on Google Cloud Storage (`createGcsStorage`) and one in memory for tests (`createMemoryStorage`), and `readAndValidateFileUpload`, which checks the type of an uploaded file from its contents.

- [#973](https://github.com/nmi-agro/fdm/pull/973) [`8ca24d1`](https://github.com/nmi-agro/fdm/commit/8ca24d1702ca08556173f8cd341dac837977120c) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Require Node.js 26 or higher (`engines.node` is now `>=26.0.0`) and build for the `node26` target.

### Patch Changes

- [#967](https://github.com/nmi-agro/fdm/pull/967) [`fd9d527`](https://github.com/nmi-agro/fdm/commit/fd9d527a438690728dc2331230a45ec181bef400) Thanks [@SvenVw](https://github.com/SvenVw)! - Update `@google-cloud/storage` to version 9. The client no longer exports `ApiError`, so not-found and transient-network errors are now recognised by their HTTP status instead. `isGcsNotFoundError` is exported for callers that need the same check.
