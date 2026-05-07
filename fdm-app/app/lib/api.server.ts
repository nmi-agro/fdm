import { createFdmApi } from "@nmi-agro/fdm-api"
import { fdm } from "~/lib/fdm.server"
import { auth } from "~/lib/auth.server"
import { serverConfig } from "~/lib/config.server"

export const app = createFdmApi(fdm, auth, {
    appName: serverConfig.name,
    appUrl: serverConfig.url,
})

