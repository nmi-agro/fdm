---
title: AI-assistenten koppelen (MCP)
description: Koppel Claude, ChatGPT Codex of een lokaal taalmodel aan {{appName}}, zodat je assistent je bedrijfsgegevens kan opzoeken, wijzigen en doorrekenen.
section: Samenwerken en account
order: 4
inApp:
  - Account
  - AI-assistenten
routes:
  - user.settings.api-keys.tsx
  - user.settings.mcp.tsx
watch:
  - fdm-mcp/src/**
keywords:
  - MCP
  - AI-assistent
  - Claude
  - Codex
  - ChatGPT
  - LM Studio
  - Open WebUI
  - taalmodel
related:
  - api
  - samenwerken
updated: 2026-11-12
---

Met het Model Context Protocol (MCP) koppel je een AI-assistent aan {{appName}}. Je assistent kan dan je bedrijfsgegevens opzoeken, wijzigen en doorrekenen terwijl je met hem praat. Vraag bijvoorbeeld "Welke percelen hebben dit jaar nog geen bemesting?" of "Wat is de stikstofbalans van mijn bedrijf over 2025?".

Deze koppeling werkt met assistenten als Claude, OpenAI Codex en taalmodellen die je zelf draait in LM Studio of Open WebUI. Ze gebruikt een API-sleutel, net als de [API](/manual/api).

## Wat kan een assistent? {#mogelijkheden}

Een assistent ziet en wijzigt precies wat jij in {{appName}} mag zien en wijzigen:

- Opzoeken: bedrijven, percelen, gewassen, oogsten, meststoffen, bemestingen, bodemanalyses, maatregelen en bedrijfsinstellingen.
- Wijzigen: gegevens toevoegen en aanpassen, bijvoorbeeld een bemesting of een gewas.
- Verwijderen: gegevens verwijderen, zoals een perceel of een bodemanalyse.
- Berekenen: de stikstofbalans, de organische-stofbalans, de gebruiksruimte, het bemestingsadvies en de bodemkwaliteit.

Codes van gewassen, meststoffen en maatregelen zoekt de assistent zelf op in de catalogi.

Bestanden kan de assistent (nog) niet doorgeven aan {{appName}}. Een labrapport (PDF) of een shapefile van RVO importeren doe je daarom in {{appName}} zelf. Geef je de assistent wel een labrapport, dan kan hij de waarden overnemen en als bodemanalyse opslaan. Controleer die waarden dan goed voordat je de wijziging goedkeurt.

## Let op {#let-op}

- De assistent kan gegevens wijzigen en verwijderen. Of je een wijziging eerst moet goedkeuren, hangt af van je assistent en zijn instellingen: {{appName}} vraagt zelf niet om goedkeuring. Zet goedkeuring voor wijzigingen aan en lees elke wijziging na voordat je die goedkeurt. Een verwijdering kun je niet ongedaan maken.
- De assistent hoort geen gegevens te schatten of te verzinnen, zoals een perceelsgrens of een hoeveelheid, maar te vragen wat ontbreekt. Stelt hij toch een geschatte waarde voor, keur die dan niet zomaar goed.
- Je gegevens gaan naar de aanbieder van de assistent, zoals Anthropic of OpenAI. Deel geen gegevens van klanten zonder hun toestemming, en kijk na wat je organisatie hierover heeft afgesproken.
- Controleer adviezen. Een assistent kan zich vergissen of berekeningen verkeerd uitleggen. De berekeningen zelf komen uit {{appName}}, maar de uitleg en conclusies van de assistent niet.
- Minder krachtige modellen maken vaker fouten. Ze kiezen vaker het verkeerde hulpmiddel of vullen gegevens verkeerd in. Dat geldt voor online assistenten en voor modellen die je zelf draait: kies een model dat goed overweg kan met hulpmiddelen (tool calling).
- Via de API en de assistent gelden [limieten](/manual/api#limieten), zoals maximaal 500 percelen per bedrijf.

## Stap 1: maak een API-sleutel {#api-sleutel}

Maak voor elke assistent een eigen sleutel aan. Dan kun je één koppeling stoppen zonder de andere.

1. Klik op je naam onderaan de zijbalk, kies Account en ga naar API-sleutels.
2. Klik op Nieuwe sleutel, geef de sleutel een naam zoals "Claude" en klik op Aanmaken.
3. Klik op Kopiëren en bewaar de sleutel op een veilige plek. Je ziet de sleutel maar één keer.

Begin je op de pagina **AI-assistenten**? Klik dan bij stap 1 op **Maak een API-sleutel**. Het venster voor een nieuwe sleutel opent direct, en na het kopiëren brengt **Terug naar AI-assistenten koppelen** je naar het adres van de koppeling.

![De pagina API-sleutels in het account](screenshot:api-sleutels)

Wil je een koppeling stoppen? Klik dan bij de sleutel op Sleutel intrekken. De assistent heeft daarna direct geen toegang meer.

Het adres van de koppeling is: `{{mcpUrl}}/mcp`

Het adres en de instellingen per assistent, klaar om te kopiëren, vind je ook in {{appName}}: kies **Account** en ga naar **AI-assistenten**, of klik op de pagina **API-sleutels** op **AI-assistenten koppelen**. De instellingen voor Claude Code, Codex, de OpenAI API en lokale modellen staan daar onder **Voor ontwikkelaars en lokale modellen**.

## Claude {#claude}

### claude.ai en de app Claude Desktop

Doe dit op een computer, in de browser of in Claude Desktop.

1. Ga naar "Customize" → "Connectors" en klik op "+ Add" → "Add custom connector".
2. Vul bij de URL `{{mcpUrl}}/mcp` in.
3. Kies bij de authenticatie "No sign in".
4. Voeg onder "Request headers" de header `X-API-Key` toe, met je sleutel als waarde.
5. Sla op en zet de connector aan in een gesprek.

Gebruik je Claude Team of Enterprise? Dan kan alleen de beheerder van je organisatie een connector toevoegen, en die stuurt voor iedereen dezelfde sleutel mee. Iedereen werkt dan met de gegevens en rechten van één persoon, dus doe dat niet. Koppel in plaats daarvan met een eigen sleutel via Claude Desktop met een configuratiebestand (zie [Programma's die alleen stdio ondersteunen](#stdio)) of via [Claude Code](#claude-code).

### Claude Code {#claude-code}

Zet je sleutel in de omgevingsvariabele `FDM_API_KEY` en voer uit:

```bash
claude mcp add --transport http {{mcpServerName}} {{mcpUrl}}/mcp --header 'X-API-Key: ${FDM_API_KEY}'
```

Het commando slaat alleen de naam van de variabele op, niet de sleutel. Zet `FDM_API_KEY` daarom vast in je omgeving, bijvoorbeeld in je shellprofiel, zodat Claude Code de sleutel ook vindt als je het later of vanuit je editor start.

## OpenAI {#openai}

### Codex (CLI of IDE)

Zet je sleutel in de omgevingsvariabele `FDM_API_KEY` en voer uit:

```bash
codex mcp add {{mcpServerName}} --url {{mcpUrl}}/mcp --bearer-token-env-var FDM_API_KEY
```

Ook dit commando slaat alleen de naam van de variabele op. Zet `FDM_API_KEY` vast in je omgeving, zodat Codex de sleutel ook vindt als je het later of vanuit je editor start.

### Laat Claude Code of Codex het instellen {#zelf-instellen}

Zet je sleutel in de omgevingsvariabele `FDM_API_KEY` en geef je assistent deze opdracht. De opdracht bevat je sleutel niet. Plak je sleutel ook nooit in een gesprek: dan gaat hij naar de aanbieder van de assistent.

```text
Stel de MCP-koppeling met {{appName}} voor me in.

- Adres: {{mcpUrl}}/mcp (Streamable HTTP)
- Naam van de koppeling: {{mcpServerName}}
- De API-sleutel staat in de omgevingsvariabele FDM_API_KEY. Vraag me niet om de sleutel en zet hem niet letterlijk in een commando of bestand: verwijs naar de variabele.

1. Kijk of FDM_API_KEY gezet is. Zo niet: leg uit hoe ik hem vast instel voor mijn besturingssysteem en shell, en stop dan.
2. Voeg de koppeling toe:
   - Claude Code: claude mcp add --transport http {{mcpServerName}} {{mcpUrl}}/mcp --header 'X-API-Key: ${FDM_API_KEY}'
   - Codex: codex mcp add {{mcpServerName}} --url {{mcpUrl}}/mcp --bearer-token-env-var FDM_API_KEY
3. Kijk met "claude mcp list" of "codex mcp list" of de koppeling werkt. Bij foutmelding 401 is de sleutel verkeerd of ingetrokken.
4. Zeg dat ik een nieuwe sessie moet starten, zodat de hulpmiddelen geladen worden.
```

### Ontwikkelaars met de OpenAI API

Gebruik in de Responses API een hulpmiddel van het type `mcp` met `server_url` `{{mcpUrl}}/mcp` en de header `Authorization: Bearer <sleutel>`.

### ChatGPT op het web

Dit kan nog niet. ChatGPT vraagt om inloggen via OAuth; dat volgt later.

## Lokale taalmodellen {#lokaal}

### LM Studio

Voeg de koppeling toe aan `mcp.json`:

```json
{
  "mcpServers": {
    "{{mcpServerName}}": {
      "url": "{{mcpUrl}}/mcp",
      "headers": { "X-API-Key": "<sleutel>" }
    }
  }
}
```

### Open WebUI met Ollama

Voeg in de beheerinstellingen een verbinding toe van het type "MCP (Streamable HTTP)", met URL `{{mcpUrl}}/mcp`, authenticatie "Bearer" en je sleutel. Kies een model dat hulpmiddelen kan gebruiken (tool calling).

### Programma's die alleen stdio ondersteunen {#stdio}

Gebruik `mcp-remote` als tussenstap. Zet dit in het configuratiebestand van je programma, zoals `claude_desktop_config.json` van Claude Desktop, en pas het zo nodig aan. Alles gaat dan nog steeds via de koppeling van {{appName}}; het programma krijgt geen toegang tot de database.

```json
{
  "mcpServers": {
    "{{mcpServerName}}": {
      "command": "npx",
      "args": ["mcp-remote", "{{mcpUrl}}/mcp", "--header", "X-API-Key:${FDM_API_KEY}"],
      "env": { "FDM_API_KEY": "<sleutel>" }
    }
  }
}
```

`mcp-remote` vult de sleutel zelf in vanuit `env`. Zo staat hij niet in de opdrachtregel die andere programma's op je computer kunnen zien. Het configuratiebestand bevat je sleutel wel: deel het niet.

## Probeer het uit {#proberen}

Begin met deze vraag. Dan zie je meteen of de koppeling werkt en wat de assistent mag:

> Welke bedrijven heb ik in {{appName}}, en wat kun je voor me doen met deze koppeling?

## Problemen oplossen {#problemen}

- Foutmelding 401: de sleutel ontbreekt, is verkeerd overgenomen of is ingetrokken. Kijk of de hele sleutel erin staat, zonder de punthaken van `<sleutel>`. Maak zo nodig een nieuwe sleutel.
- De assistent wil dat je inlogt, toont een knop zoals "Authenticate" of meldt "Dynamic Client Registration" of "OAuth": de sleutel ontbreekt. {{appName}} ondersteunt inloggen via OAuth nog niet. Voeg de header `X-API-Key` met je sleutel toe aan de koppeling, zoals hierboven per assistent beschreven.
- Foutmelding 429 of "Rate limit exceeded": de assistent doet te veel verzoeken achter elkaar. Wacht even; de melding zegt hoeveel seconden. Zie [Limieten](/manual/api#limieten).
- Nieuwe hulpmiddelen verschijnen niet: vernieuw de lijst met hulpmiddelen in je assistent, of verwijder de koppeling en voeg hem opnieuw toe.
- De assistent kiest het verkeerde hulpmiddel: noem in je vraag het bedrijf of perceel bij naam, of kies een krachtiger model.
