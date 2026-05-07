export interface ApiPrincipalContext {
    userId: string
    apiKeyId: string
    keyName: string | null
    channel: "api"
    effectivePrincipalId: string
}

export type ApiEnv = {
    Variables: {
        principal: ApiPrincipalContext
    }
}
