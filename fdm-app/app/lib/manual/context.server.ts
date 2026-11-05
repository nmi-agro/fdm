import { serverConfig } from "~/lib/config.server"
import type { ManualTokens } from "./content.server"
import type { ManualSeoContext } from "./meta"
import { normalizeOrigin } from "./seo"

/**
 * Returns the deployment settings the manual needs: the token values that replace `{{appName}}`
 * and `{{appUrl}}`, and the SEO context for metadata.
 */
export function getManualContext(): { tokens: ManualTokens; seo: ManualSeoContext } {
  const origin = normalizeOrigin(serverConfig.url)
  const appName = serverConfig.name && serverConfig.name !== "undefined" ? serverConfig.name : "FDM"
  return {
    tokens: { appName, appUrl: origin || "/" },
    seo: { origin, appName, indexing: serverConfig.seo_indexing },
  }
}
