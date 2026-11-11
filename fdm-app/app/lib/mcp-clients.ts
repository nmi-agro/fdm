import { normalizeOrigin } from "~/lib/manual/seo"

/**
 * Setup instructions for connecting AI assistants to the MCP server of this deployment, as shown
 * on the account page "AI-assistenten". The steps follow the manual chapter
 * "AI-assistenten koppelen (MCP)"; keep both in step.
 */

/** Stands in for the user's API key in every snippet: the app does not know the key after it is created. */
export const MCP_KEY_PLACEHOLDER = "<sleutel>"

/** Name of the HTTP header that carries the API key. */
export const MCP_KEY_HEADER = "X-API-Key"

/** A snippet the user copies into a terminal or a configuration file. */
export interface McpCodeSnippet {
  /** Shown above the snippet, for example the file it belongs in. */
  language: "bash" | "json"
  text: string
}

/** One way to connect, such as "Claude Code" within the tab "Claude Code en Codex". */
export interface McpGuideSection {
  title: string
  /** Text before the steps or the snippet. Text between backticks is shown as code. */
  intro?: string
  /** Numbered steps. Text between backticks is shown as code. */
  steps?: string[]
  code?: McpCodeSnippet
  /** A remark after the steps or the snippet, such as a warning. */
  note?: string
}

/** The instructions for one group of programs, shown as one tab. */
export interface McpClientGuide {
  id: "cli" | "openai-api" | "local" | "other"
  label: string
  sections: McpGuideSection[]
}

/** An assistant that cannot connect yet, with the reason. */
export interface McpUnsupportedClient {
  label: string
  reason: string
}

/** All setup instructions for the page, from the most common way to connect to the least common. */
export interface McpClientGuides {
  /** The way most users connect: a custom connector in claude.ai or Claude Desktop. */
  primary: McpGuideSection
  /** Assistants that people expect to work but cannot connect yet. */
  unsupported: McpUnsupportedClient[]
  /** Command-line tools, the OpenAI API and local models, one tab per group. */
  developer: McpClientGuide[]
}

/**
 * Returns the address of the MCP endpoint of this deployment.
 *
 * @param mcpUrl - The configured origin of the MCP server (`PUBLIC_FDM_MCP_URL`).
 * @returns For example `https://mcp.example.org/mcp`, or `undefined` when no MCP server is configured
 *   or the configured value is not a valid address.
 */
export function getMcpEndpoint(mcpUrl: string | undefined): string | undefined {
  const origin = normalizeOrigin(mcpUrl)
  return origin ? `${origin}/mcp` : undefined
}

/**
 * Turns the application name into a name for the connection in command-line tools, which do not
 * accept spaces: "MINAS2" becomes "minas2" and "My App" becomes "my-app". This is the same name
 * the MCP server reports about itself.
 *
 * @param appName - Public name of the application.
 * @returns The lowercase name, or `"fdm"` when nothing remains.
 */
export function getMcpServerName(appName: string): string {
  const name = appName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("-")
  return name || "fdm"
}

/**
 * Builds the setup instructions, with the real address of the MCP server and a placeholder for the
 * API key.
 *
 * @param options.appName - Public name of the application, used in texts and as connection name.
 * @param options.endpoint - Address of the MCP endpoint, from {@link getMcpEndpoint}.
 * @returns The main way to connect, the assistants that cannot connect yet, and the tabs for
 *   developers and local models in a fixed order.
 */
export function getMcpClientGuides({
  appName,
  endpoint,
}: {
  appName: string
  endpoint: string
}): McpClientGuides {
  const name = getMcpServerName(appName)
  const key = MCP_KEY_PLACEHOLDER
  return {
    primary: {
      title: "claude.ai en de app Claude Desktop",
      intro: "Doe dit op een computer, in de browser of in Claude Desktop.",
      steps: [
        'Ga naar "Customize" → "Connectors" en klik op "+ Add" → "Add custom connector".',
        `Vul bij de URL \`${endpoint}\` in.`,
        'Kies bij de authenticatie "No sign in".',
        `Voeg onder "Request headers" de header \`${MCP_KEY_HEADER}\` toe, met je sleutel als waarde.`,
        "Sla op en zet de connector aan in een gesprek.",
      ],
      note: "Gebruik je Claude Team of Enterprise? Voeg de connector dan niet toe voor de hele organisatie met je eigen sleutel: dan werkt iedereen in de organisatie met jouw gegevens en rechten. Laat iedereen de connector zelf toevoegen, met een eigen sleutel.",
    },
    unsupported: [
      {
        label: "ChatGPT op het web",
        reason: "ChatGPT vraagt om inloggen via OAuth; dat volgt later.",
      },
    ],
    developer: [
      {
        id: "cli",
        label: "Claude Code en Codex",
        sections: [
          {
            title: "Claude Code",
            code: {
              language: "bash",
              text: `claude mcp add --transport http ${name} ${endpoint} --header "${MCP_KEY_HEADER}: ${key}"`,
            },
          },
          {
            title: "Codex (CLI of IDE)",
            intro: "Zet je sleutel in de omgevingsvariabele `FDM_API_KEY` en voer uit:",
            code: {
              language: "bash",
              text: `codex mcp add ${name} --url ${endpoint} --bearer-token-env-var FDM_API_KEY`,
            },
          },
        ],
      },
      {
        id: "openai-api",
        label: "OpenAI API",
        sections: [
          {
            title: "Ontwikkelaars met de OpenAI API",
            intro: "Gebruik in de Responses API een hulpmiddel van het type `mcp`:",
            code: {
              language: "json",
              text: JSON.stringify(
                {
                  type: "mcp",
                  server_label: name,
                  server_url: endpoint,
                  headers: { Authorization: `Bearer ${key}` },
                },
                null,
                2,
              ),
            },
          },
        ],
      },
      {
        id: "local",
        label: "Lokale modellen",
        sections: [
          {
            title: "LM Studio",
            intro: "Voeg de koppeling toe aan `mcp.json`:",
            code: {
              language: "json",
              text: JSON.stringify(
                { mcpServers: { [name]: { url: endpoint, headers: { [MCP_KEY_HEADER]: key } } } },
                null,
                2,
              ),
            },
          },
          {
            title: "Open WebUI met Ollama",
            steps: [
              'Voeg in de beheerinstellingen een verbinding toe van het type "MCP (Streamable HTTP)".',
              `Vul bij de URL \`${endpoint}\` in.`,
              'Kies bij de authenticatie "Bearer" en vul je sleutel in.',
              "Kies een model dat hulpmiddelen kan gebruiken (tool calling).",
            ],
          },
        ],
      },
      {
        id: "other",
        label: "Andere programma's",
        sections: [
          {
            title: "Programma's die alleen stdio ondersteunen",
            intro: `Gebruik \`mcp-remote\` als tussenstap, met je sleutel in de omgevingsvariabele \`FDM_API_KEY\`. Alles gaat dan nog steeds via de koppeling van ${appName}; het programma krijgt geen toegang tot de database.`,
            code: {
              language: "bash",
              text: `npx mcp-remote ${endpoint} --header "${MCP_KEY_HEADER}:\${FDM_API_KEY}"`,
            },
          },
        ],
      },
    ],
  }
}
