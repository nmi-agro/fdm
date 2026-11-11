import { CodeBlock } from "~/components/custom/copy-button"
import { MCP_KEY_HEADER } from "~/lib/mcp-clients"

/**
 * The address of the MCP server with a copy button, and the header that carries the API key.
 * Shown on the account page "AI-assistenten (MCP)".
 */
export function McpEndpoint({ endpoint }: { endpoint: string }) {
  return (
    <dl className="space-y-3">
      <div className="space-y-1.5">
        <dt className="text-sm font-medium">Adres van de koppeling</dt>
        <dd>
          <CodeBlock code={endpoint} copyLabel="Kopieer het adres van de koppeling" />
        </dd>
      </div>
      <div className="space-y-1.5">
        <dt className="text-sm font-medium">Header</dt>
        <dd className="text-muted-foreground text-sm">
          <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs">
            {MCP_KEY_HEADER}
          </code>
          <span>
            {
              ' met je API-sleutel als waarde. Vraagt een assistent om een "Bearer token", vul daar dan je sleutel in.'
            }
          </span>
        </dd>
      </div>
    </dl>
  )
}
