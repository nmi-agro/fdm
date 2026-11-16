import type { ErrorLogOptions } from "@nmi-agro/fdm-api"

/** Log options for the error helpers of fdm-api: log lines of this service start with `[fdm-mcp]`. */
export const LOG_OPTIONS: ErrorLogOptions = { logPrefix: "fdm-mcp" }
