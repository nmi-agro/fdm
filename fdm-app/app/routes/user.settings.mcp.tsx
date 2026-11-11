import type { MetaFunction } from "react-router"
import { BookOpenIcon, KeyRound, TriangleAlert } from "lucide-react"
import { NavLink } from "react-router"
import type { HelpHandle } from "~/lib/manual/help-targets"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { McpClientGuides } from "~/components/blocks/mcp/mcp-client-guides"
import { McpEndpoint } from "~/components/blocks/mcp/mcp-endpoint"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { clientConfig } from "~/lib/config"
import { getHelpHref } from "~/lib/manual/help-targets"
import { getMcpClientGuides, getMcpEndpoint } from "~/lib/mcp-clients"

export const handle: HelpHandle = { help: "ai-assistenten" }

export const meta: MetaFunction = () => {
  return [
    { title: `AI-assistenten (MCP) - Instellingen | ${clientConfig.name}` },
    {
      name: "description",
      content: `Koppel een AI-assistent zoals Claude aan ${clientConfig.name} met een API-sleutel.`,
    },
  ]
}

/**
 * Explains how to connect an AI assistant to the MCP server of this deployment: the address to
 * copy, the API key to use and the settings per assistant. The session is checked by the loader of
 * the parent layout `user.settings.tsx`.
 */
export default function UserSettingsMcpPage() {
  const endpoint = getMcpEndpoint(clientConfig.mcpUrl)

  return (
    <>
      <FarmTitle
        title="AI-assistenten koppelen"
        description={`Met een API-sleutel kan een AI-assistent zoals Claude je bedrijfsgegevens in ${clientConfig.name} opzoeken, wijzigen en doorrekenen. Zo'n koppeling heet MCP (Model Context Protocol).`}
      />
      <div className="space-y-6 px-4 pb-8 md:px-8">
        {endpoint ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Zo koppel je een assistent</CardTitle>
                <CardDescription>
                  Je hebt een API-sleutel en het adres van de koppeling nodig.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-6">
                  <li className="space-y-3">
                    <p className="font-medium">1. Maak een API-sleutel</p>
                    <p className="text-muted-foreground text-sm">
                      Maak voor elke assistent een eigen sleutel aan. Dan kun je één koppeling
                      stoppen zonder de andere.
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <NavLink to="/user/settings/api-keys">
                        <KeyRound className="h-4 w-4" />
                        <span>Naar API-sleutels</span>
                      </NavLink>
                    </Button>
                  </li>
                  <li className="space-y-3">
                    <p className="font-medium">2. Kopieer het adres</p>
                    <McpEndpoint endpoint={endpoint} />
                  </li>
                  <li className="space-y-1">
                    <p className="font-medium">3. Voeg de koppeling toe aan je assistent</p>
                    <p className="text-muted-foreground text-sm">
                      Kies hieronder je assistent. Vervang &lt;sleutel&gt; door je API-sleutel.
                    </p>
                  </li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Instellingen per assistent</CardTitle>
                <CardDescription>
                  Knoppen en menu's van andere programma's staan tussen aanhalingstekens en kunnen
                  in jouw versie anders heten.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <McpClientGuides
                  guides={getMcpClientGuides({ appName: clientConfig.name, endpoint })}
                />
              </CardContent>
            </Card>

            <Alert>
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Let op</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-4">
                  <li>
                    De assistent kan gegevens wijzigen en verwijderen. Lees elke wijziging na
                    voordat je die goedkeurt; een verwijdering kun je niet ongedaan maken.
                  </li>
                  <li>
                    Je gegevens gaan naar de aanbieder van de assistent, zoals Anthropic of OpenAI.
                    Deel geen gegevens van klanten zonder hun toestemming.
                  </li>
                  <li>
                    Controleer adviezen. De berekeningen komen uit {clientConfig.name}, maar de
                    uitleg en conclusies van de assistent niet.
                  </li>
                  <li>
                    {clientConfig.name} houdt bij welke hulpmiddelen de assistent gebruikt en
                    waarom, maar niet welke gegevens hij opvraagt of meestuurt.
                  </li>
                </ul>
                <Button variant="link" className="mt-2 h-auto p-0" asChild>
                  <a href={getHelpHref("ai-assistenten")} target="_blank" rel="noopener">
                    <BookOpenIcon className="h-4 w-4" />
                    <span>Lees meer in de handleiding</span>
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <Alert>
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Niet beschikbaar</AlertTitle>
            <AlertDescription>
              Het koppelen van AI-assistenten is op deze server niet beschikbaar.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </>
  )
}
