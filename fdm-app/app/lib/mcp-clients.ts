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
  language: "bash" | "json" | "text"
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
  /** A remark after the steps or the snippet, such as a warning. Text between backticks is shown as code. */
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

/** Name of the environment variable that holds the API key in the snippets that read it from there. */
export const MCP_KEY_ENV_VAR = "FDM_API_KEY"

/**
 * Returns the configured origin of the MCP server, without a trailing slash.
 *
 * @param mcpUrl - The configured origin of the MCP server (`PUBLIC_FDM_MCP_URL`).
 * @returns For example `https://mcp.example.org`, or `undefined` when no MCP server is configured
 *   or the configured value is not an `http` or `https` address.
 */
export function getMcpOrigin(mcpUrl: string | undefined): string | undefined {
  const origin = normalizeOrigin(mcpUrl)
  if (!origin) return undefined
  try {
    const { protocol } = new URL(origin)
    return protocol === "http:" || protocol === "https:" ? origin : undefined
  } catch {
    return undefined
  }
}

/**
 * Returns the address of the MCP endpoint of this deployment.
 *
 * @param mcpUrl - The configured origin of the MCP server (`PUBLIC_FDM_MCP_URL`).
 * @returns For example `https://mcp.example.org/mcp`, or `undefined` when no MCP server is configured
 *   or the configured value is not an `http` or `https` address.
 */
export function getMcpEndpoint(mcpUrl: string | undefined): string | undefined {
  const origin = getMcpOrigin(mcpUrl)
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
 * Explains that a command stores only the name of the environment variable, so the variable must
 * be set wherever the program runs.
 *
 * @param program - The program that reads the variable, such as "Codex".
 * @returns The note.
 */
function envVarNote(program: string): string {
  return `Het commando slaat alleen de naam van de variabele op. Zet \`${MCP_KEY_ENV_VAR}\` daarom vast in je omgeving, bijvoorbeeld in je shellprofiel, zodat ${program} de sleutel ook vindt als je het later of vanuit je editor start.`
}

/**
 * Builds a request that lets Claude Code or Codex add the connection itself. It refers to the
 * environment variable instead of the key, so the key never enters the conversation.
 *
 * @returns The request, in Dutch, ready to paste into the assistant.
 */
function buildSetupPrompt({
  appName,
  endpoint,
  name,
  claudeCommand,
  codexCommand,
}: {
  appName: string
  endpoint: string
  name: string
  claudeCommand: string
  codexCommand: string
}): string {
  return [
    `Stel de MCP-koppeling met ${appName} voor me in.`,
    "",
    `- Adres: ${endpoint} (Streamable HTTP)`,
    `- Naam van de koppeling: ${name}`,
    `- De API-sleutel staat in de omgevingsvariabele ${MCP_KEY_ENV_VAR}. Vraag me niet om de sleutel en zet hem niet letterlijk in een commando of bestand: verwijs naar de variabele.`,
    "",
    `1. Kijk of ${MCP_KEY_ENV_VAR} gezet is. Zo niet: leg uit hoe ik hem vast instel voor mijn besturingssysteem en shell, en stop dan.`,
    "2. Voeg de koppeling toe:",
    `   - Claude Code: ${claudeCommand}`,
    `   - Codex: ${codexCommand}`,
    '3. Kijk met "claude mcp list" of "codex mcp list" of de koppeling werkt. Bij foutmelding 401 is de sleutel verkeerd of ingetrokken.',
    "4. Zeg dat ik een nieuwe sessie moet starten, zodat de hulpmiddelen geladen worden.",
  ].join("\n")
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
  // Single quotes keep the variable out of the shell, so the key itself is not stored in the
  // configuration or the shell history; Claude Code reads it when it starts.
  const claudeCommand = `claude mcp add --transport http ${name} ${endpoint} --header '${MCP_KEY_HEADER}: \${${MCP_KEY_ENV_VAR}}'`
  const codexCommand = `codex mcp add ${name} --url ${endpoint} --bearer-token-env-var ${MCP_KEY_ENV_VAR}`
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
      note: 'Gebruik je Claude Team of Enterprise? Dan kan alleen de beheerder van je organisatie een connector toevoegen, en die stuurt voor iedereen dezelfde sleutel mee. Iedereen werkt dan met de gegevens en rechten van één persoon, dus doe dat niet. Koppel in plaats daarvan met een eigen sleutel via Claude Desktop met een configuratiebestand (zie "Andere programma\'s" onder "Voor ontwikkelaars en lokale modellen") of via Claude Code.',
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
            intro: `Zet je sleutel in de omgevingsvariabele \`${MCP_KEY_ENV_VAR}\` en voer uit:`,
            code: { language: "bash", text: claudeCommand },
            note: envVarNote("Claude Code"),
          },
          {
            title: "Codex (CLI of IDE)",
            intro: `Zet je sleutel in de omgevingsvariabele \`${MCP_KEY_ENV_VAR}\` en voer uit:`,
            code: { language: "bash", text: codexCommand },
            note: envVarNote("Codex"),
          },
          {
            title: "Of laat je assistent het instellen",
            intro: `Zet je sleutel in \`${MCP_KEY_ENV_VAR}\`, kopieer deze opdracht en geef hem aan Claude Code of Codex:`,
            code: {
              language: "text",
              text: buildSetupPrompt({ appName, endpoint, name, claudeCommand, codexCommand }),
            },
            note: "De opdracht bevat je sleutel niet. Plak je sleutel ook nooit in een gesprek: dan gaat hij naar de aanbieder van de assistent.",
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
            intro: `Gebruik \`mcp-remote\` als tussenstap. Zet dit in het configuratiebestand van je programma, zoals \`claude_desktop_config.json\` van Claude Desktop, en pas het zo nodig aan. Alles gaat dan nog steeds via de koppeling van ${appName}; het programma krijgt geen toegang tot de database.`,
            code: {
              language: "json",
              text: JSON.stringify(
                {
                  mcpServers: {
                    [name]: {
                      command: "npx",
                      args: [
                        "mcp-remote",
                        endpoint,
                        "--header",
                        `${MCP_KEY_HEADER}:\${${MCP_KEY_ENV_VAR}}`,
                      ],
                      env: { [MCP_KEY_ENV_VAR]: key },
                    },
                  },
                },
                null,
                2,
              ),
            },
            note: `mcp-remote vult de sleutel zelf in vanuit \`env\`. Zo staat hij niet in de opdrachtregel die andere programma's op je computer kunnen zien.`,
          },
        ],
      },
    ],
  }
}
