import { apiKeyClient } from "@better-auth/api-key/client"
import { genericOAuthClient, magicLinkClient, organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [organizationClient(), magicLinkClient(), apiKeyClient(), genericOAuthClient()],
})

export const { signIn, signOut, signUp, useSession } = authClient
