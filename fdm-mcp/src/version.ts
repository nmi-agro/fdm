import { createRequire } from "node:module"

/**
 * Version of the fdm-mcp package, reported to clients as the server version. Read from
 * `package.json`, which sits next to both `src` and `dist`.
 */
export const SERVER_VERSION: string = (
  createRequire(import.meta.url)("../package.json") as { version: string }
).version
