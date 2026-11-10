---
title: AI-assistenten koppelen (MCP)
description: Koppel Claude, ChatGPT Codex of een lokaal taalmodel aan {{appName}}, zodat je assistent je bedrijfsgegevens kan opzoeken, wijzigen en doorrekenen.
section: Samenwerken en account
order: 4
inApp:
  - Account
  - API-sleutels
routes:
  - user.settings.api-keys.tsx
watch:
  - fdm-mcp/src/
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
updated: 2026-11-10
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

## Let op {#let-op}

- De assistent kan gegevens wijzigen en verwijderen. De meeste assistenten vragen je om toestemming voordat ze iets wijzigen. Lees elke wijziging na voordat je die goedkeurt. Een verwijdering kun je niet ongedaan maken.
- Je gegevens gaan naar de aanbieder van de assistent, zoals Anthropic of OpenAI. Deel geen gegevens van klanten zonder hun toestemming, en kijk na wat je organisatie hierover heeft afgesproken.
- Controleer adviezen. Een assistent kan zich vergissen of berekeningen verkeerd uitleggen. De berekeningen zelf komen uit {{appName}}, maar de uitleg en conclusies van de assistent niet.
- Minder krachtige modellen maken vaker fouten. Ze kiezen vaker het verkeerde hulpmiddel of vullen gegevens verkeerd in. Dat geldt voor online assistenten en voor modellen die je zelf draait: kies een model dat goed overweg kan met hulpmiddelen (tool calling).
- Gebruik wordt bijgehouden. {{appName}} houdt bij welke hulpmiddelen de assistent gebruikt, hoe lang dat duurt en of het lukt, en wat de assistent opgeeft als reden. De gegevens die de assistent opvraagt of meestuurt, worden daarbij niet bewaard.
- Via de API en de assistent gelden [limieten](/manual/api#limieten), zoals maximaal 500 percelen per bedrijf.

## Stap 1: maak een API-sleutel {#api-sleutel}

Maak voor elke assistent een eigen sleutel aan. Dan kun je één koppeling stoppen zonder de andere.

1. Klik op je naam onderaan de zijbalk, kies Account en ga naar API-sleutels.
2. Klik op Nieuwe sleutel, geef de sleutel een naam zoals "Claude" en klik op Aanmaken.
3. Klik op Kopiëren en bewaar de sleutel op een veilige plek.

![De pagina API-sleutels in het account](screenshot:api-sleutels)

Wil je een koppeling stoppen? Klik dan bij de sleutel op Sleutel intrekken. De assistent heeft daarna direct geen toegang meer.

Het adres van de koppeling is: `{{mcpUrl}}/mcp`

## Claude {#claude}

### claude.ai en de app Claude Desktop

1. Ga naar "Customize" → "Connectors" en klik op "+ Add" → "Add custom connector".
2. Vul bij de URL `{{mcpUrl}}/mcp` in.
3. Kies bij de authenticatie "No sign in".
4. Voeg onder "Request headers" de header `X-API-Key` toe, met je sleutel als waarde.
5. Sla op en zet de connector aan in een gesprek.

Gebruik je Claude Team of Enterprise? Voeg de connector dan niet toe voor de hele organisatie met je eigen sleutel: dan werkt iedereen in de organisatie met jouw gegevens en rechten. Laat iedereen de connector zelf toevoegen, met een eigen sleutel.

### Claude Code

```bash
claude mcp add --transport http {{appName}} {{mcpUrl}}/mcp --header "X-API-Key: <sleutel>"
```

## OpenAI {#openai}

### Codex (CLI of IDE)

Zet je sleutel in de omgevingsvariabele `FDM_API_KEY` en voer uit:

```bash
codex mcp add {{appName}} --url {{mcpUrl}}/mcp --bearer-token-env-var FDM_API_KEY
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
    "{{appName}}": {
      "url": "{{mcpUrl}}/mcp",
      "headers": { "X-API-Key": "<sleutel>" }
    }
  }
}
```

### Open WebUI met Ollama

Voeg in de beheerinstellingen een verbinding toe van het type "MCP (Streamable HTTP)", met URL `{{mcpUrl}}/mcp`, authenticatie "Bearer" en je sleutel. Kies een model dat hulpmiddelen kan gebruiken (tool calling).

### Programma's die alleen stdio ondersteunen

Gebruik `mcp-remote` als tussenstap. Alles gaat dan nog steeds via de koppeling van {{appName}}; het programma krijgt geen toegang tot de database.

```bash
npx mcp-remote {{mcpUrl}}/mcp --header "X-API-Key:${FDM_API_KEY}"
```

## Problemen oplossen {#problemen}

- Foutmelding 401: de sleutel ontbreekt, is verkeerd overgenomen of is ingetrokken. Maak zo nodig een nieuwe sleutel.
- Foutmelding 429 of "Rate limit exceeded": de assistent doet te veel verzoeken achter elkaar. Wacht even; de melding zegt hoeveel seconden. Zie [Limieten](/manual/api#limieten).
- Nieuwe hulpmiddelen verschijnen niet: vernieuw de lijst met hulpmiddelen in je assistent, of verwijder de koppeling en voeg hem opnieuw toe.
- De assistent kiest het verkeerde hulpmiddel: noem in je vraag het bedrijf of perceel bij naam, of kies een krachtiger model.
