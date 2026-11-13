import type { MetaFunction } from "react-router"
import { BookOpenIcon, Info, KeyRound } from "lucide-react"
import { NavLink } from "react-router"
import type { HelpHandle } from "~/lib/manual/help-targets"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { McpClientGuides } from "~/components/blocks/mcp/mcp-client-guides"
import { CodeBlock } from "~/components/custom/copy-button"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { buttonVariants } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { clientConfig } from "~/lib/config"
import { getHelpHref } from "~/lib/manual/help-targets"
import { getMcpClientGuides, getMcpEndpoint } from "~/lib/mcp-clients"

export const handle: HelpHandle = { help: "ai-assistenten" }

export const meta: MetaFunction = () => {
  return [
    { title: `AI-assistenten - Instellingen | ${clientConfig.name}` },
    {
      name: "description",
      content: `Koppel Claude, Codex of een lokaal taalmodel aan ${clientConfig.name} met een API-sleutel.`,
    },
  ]
}

/** Opens the page "API-sleutels" with the dialog for a new key, and a way back to step 2 here. */
const CREATE_KEY_HREF = "/user/settings/api-keys?from=mcp"

/**
 * Explains how to connect an AI assistant to the MCP server of this deployment: first what the
 * user agrees to, then the three steps (API key, address, settings per assistant), and finally how
 * to try the connection, fix it and stop it. On large screens the steps take the wide column. The session is checked by the loader of the parent
 * layout `user.settings.tsx`.
 */
export default function UserSettingsMcpPage() {
  const endpoint = getMcpEndpoint(clientConfig.mcpUrl)
  const appName = clientConfig.name

  return (
    <>
      <FarmTitle
        title="AI-assistenten koppelen"
        description={`Koppel een AI-assistent zoals Claude aan ${appName}. De assistent kan dan je bedrijfsgegevens opzoeken, wijzigen en doorrekenen terwijl je met hem praat. Zo'n koppeling heet MCP (Model Context Protocol).`}
      />
      <div className="px-4 pb-8 md:px-8">
        {endpoint ? (
          // One column on small screens, in reading order: risks, steps, after connecting. On large
          // screens the steps take the wide column and the other two sit beside them.
          <div className="grid max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
            <section
              aria-labelledby="voordat-je-begint"
              className="bg-muted/50 space-y-3 rounded-xl border p-6 lg:col-start-2 lg:row-start-1"
            >
              <h3 id="voordat-je-begint" className="leading-none font-semibold tracking-tight">
                Voordat je begint
              </h3>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                <li>
                  <span className="font-medium">
                    De assistent kan gegevens wijzigen en verwijderen.
                  </span>{" "}
                  Of je dat eerst moet goedkeuren, hangt af van je assistent: zet goedkeuring voor
                  wijzigingen aan en lees elke wijziging na. Een verwijdering kun je niet ongedaan
                  maken.
                </li>
                <li>
                  <span className="font-medium">
                    Je gegevens gaan naar de aanbieder van de assistent,
                  </span>{" "}
                  zoals Anthropic of OpenAI. Deel geen gegevens van klanten zonder hun toestemming.
                </li>
                <li>
                  <span className="font-medium">Controleer adviezen.</span> De berekeningen komen
                  uit {appName}, maar de uitleg en conclusies van de assistent niet.
                </li>
              </ul>
            </section>

            <Card className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
              <CardHeader>
                <CardTitle>
                  <h3>Zo koppel je een assistent</h3>
                </CardTitle>
                <CardDescription>In drie stappen, met een eigen API-sleutel.</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="marker:text-muted-foreground list-decimal space-y-8 pl-5 marker:font-semibold">
                  <li className="space-y-3 pl-1">
                    <h4 className="font-medium">Maak een API-sleutel</h4>
                    <p className="text-muted-foreground text-sm">
                      Maak voor elke assistent een eigen sleutel. Dan kun je één koppeling stoppen
                      zonder de andere. Je ziet de sleutel maar één keer: kopieer hem en kom met de
                      knop in het venster terug naar deze pagina.
                    </p>
                    <NavLink
                      to={CREATE_KEY_HREF}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <KeyRound className="h-4 w-4" />
                      <span>Maak een API-sleutel</span>
                    </NavLink>
                  </li>
                  <li id="adres" className="scroll-mt-20 space-y-3 pl-1">
                    <h4 className="font-medium">Kopieer het adres van de koppeling</h4>
                    <CodeBlock code={endpoint} copyContext="adres van de koppeling" />
                  </li>
                  <li className="space-y-3 pl-1">
                    <h4 className="font-medium">Voeg de koppeling toe aan je assistent</h4>
                    <McpClientGuides guides={getMcpClientGuides({ appName, endpoint })} />
                  </li>
                </ol>
              </CardContent>
            </Card>

            <Card className="lg:col-start-2 lg:row-start-2">
              <CardHeader>
                <CardTitle>
                  <h3>Na het koppelen</h3>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm">
                <section className="space-y-2">
                  <h4 className="font-medium">Probeer het uit</h4>
                  <p className="text-muted-foreground">
                    Begin met deze vraag. Dan zie je meteen of de koppeling werkt en wat de
                    assistent mag:
                  </p>
                  <CodeBlock
                    code={`Welke bedrijven heb ik in ${appName}, en wat kun je voor me doen met deze koppeling?`}
                    copyContext="eerste vraag"
                  />
                  <p className="text-muted-foreground">Daarna bijvoorbeeld:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Welke percelen hebben dit jaar nog geen bemesting?</li>
                    <li>Wat was vorig jaar de stikstofbalans van mijn bedrijf?</li>
                  </ul>
                </section>
                <section className="space-y-2">
                  <h4 className="font-medium">Werkt het niet?</h4>
                  <p className="text-muted-foreground">
                    Bij foutmelding 401 ontbreekt de sleutel, is hij verkeerd overgenomen of is hij
                    ingetrokken. Kijk of de hele sleutel erin staat, zonder de punthaken van
                    &lt;sleutel&gt;. Lukt het niet, maak dan een nieuwe sleutel.
                  </p>
                </section>
                <section className="space-y-2">
                  <h4 className="font-medium">Koppeling stoppen</h4>
                  <p className="text-muted-foreground">
                    Trek de sleutel in op de pagina{" "}
                    <NavLink
                      to="/user/settings/api-keys"
                      className="text-foreground underline underline-offset-4"
                    >
                      API-sleutels
                    </NavLink>
                    . De assistent heeft daarna direct geen toegang meer.
                  </p>
                </section>
                <a
                  href={getHelpHref("ai-assistenten")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "link", className: "h-auto p-0" })}
                >
                  <BookOpenIcon className="h-4 w-4" />
                  <span>Lees meer in de handleiding</span>
                  <span className="sr-only">(opent in een nieuw tabblad)</span>
                </a>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Alert role="note" className="max-w-3xl">
            <Info className="h-4 w-4" />
            {/* A heading of its own instead of AlertTitle, whose h5 would skip levels below the h2 title. */}
            <h3 className="mb-1 leading-none font-medium tracking-tight">
              Niet beschikbaar op deze server
            </h3>
            <AlertDescription>
              Het koppelen van AI-assistenten is op deze server niet ingesteld. Vraag de beheerder
              van {appName} om het aan te zetten.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </>
  )
}
