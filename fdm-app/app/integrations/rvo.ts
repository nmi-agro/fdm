import { serverConfig } from "../lib/config.server"

export function getRvoCredentials(): RvoCredentials | undefined {
    // Check if RVO is configured
    const rvoConfigured =
        serverConfig.integrations.rvo.clientId !== "undefined" &&
        serverConfig.integrations.rvo.clientId !== "" &&
        serverConfig.integrations.rvo.clientSecret !== "undefined" &&
        serverConfig.integrations.rvo.clientSecret !== ""
    if (!rvoConfigured) {
        return undefined
    }

    return {
        clientId: serverConfig.integrations.rvo.clientId,
        clientSecret: serverConfig.integrations.rvo.clientSecret,
        redirectUri: serverConfig.integrations.rvo.redirectUri,
        clientName: serverConfig.integrations.rvo.clientName,
    }
}

type RvoCredentials = {
    clientId: string
    clientSecret: string
    redirectUri: string
    clientName: string
}
