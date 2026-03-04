import type { FdmAuth } from "@nmi-agro/fdm-core"

export type ExtendedUser = FdmAuth["$Infer"]["Session"]["user"]
