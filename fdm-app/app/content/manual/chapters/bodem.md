---
title: Bodem
description: Upload je labrapporten in één keer en laat ze automatisch aan je percelen koppelen, of voeg één analyse toe. Plus de BodemConditieScore.
section: Gegevens vastleggen
order: 3
inApp:
  - Percelen
  - Bodem
routes:
  - farm.$b_id_farm.$calendar.field.$b_id.soil*
  - farm.$b_id_farm.$calendar.field.$b_id.bcs*
  - farm.$b_id_farm.soil-analysis.bulk.tsx
  - farm.create.$b_id_farm.$calendar.fields_.$b_id.soil-analysis.bulk.tsx
watch:
  - fdm-app/app/components/blocks/soil/**
  - fdm-app/app/components/blocks/soil-visual/**
  - fdm-calculator/src/soilreader/**
keywords:
  - bodemanalyse
  - labrapport uploaden
  - bodemanalyses PDF koppelen
  - BodemSchat
  - BodemConditieScore
  - Nmin
related:
  - background/bodemanalyse
  - bodemkwaliteit
---

Een goede bodemanalyse is de basis voor bijna elke berekening in {{appName}}: de balansen, het bemestingsadvies, de fosfaatnorm en de bodemindicatoren. Heb je labrapporten als PDF? Dan hoef je meestal niets over te typen.

## Gemeten of geschat? {#gemeten-of-geschat}

Als je percelen importeert, vult {{appName}} vaak al bodemwaarden in met een schatting van NMI BodemSchat. Daarmee kun je direct aan de slag, maar een echte labanalyse is altijd nauwkeuriger. Bij elke analyse zie je waar hij vandaan komt:

- **Gemeten door** een laboratorium: een echte analyse.
- **Geschat met NMI BodemSchat**: een schatting.
- **Berekend**: afgeleid uit andere waarden.

Heb je labanalyses? Voeg ze dan zeker toe, zodat de berekeningen op jouw eigen meetwaarden draaien. In [Bodemanalyse](/manual/background/bodemanalyse) lees je welke waarden waarvoor worden gebruikt.

## Alle analyses in één keer uploaden {#bodemanalyses-uploaden}

Heb je een stapel PDF-rapporten van het lab, voor verschillende percelen? Upload ze dan in één keer. {{appName}} leest de rapporten uit en zoekt zelf uit welk rapport bij welk perceel hoort. Een rapport mag meerdere percelen bevatten. Er wordt niets opgeslagen voordat jij de resultaten hebt gecontroleerd.

Je begint op een van deze plekken:

- op het bedrijfsdashboard onder **Acties**: **Upload bodemanalyses**;
- tijdens het aanmaken van een bedrijf, in de stap Percelen: **Bodemanalyses uploaden (pdf)**;
- op de bodempagina van een perceel, bij "Rapporten voor meerdere percelen?": **Meerdere PDF's uploaden**.

Het uploaden gaat in vier stappen:

1. **PDF's kiezen**. Sleep de rapporten in het vak of klik om ze te kiezen. Alleen PDF, maximaal 5 MB per bestand. Klik daarna op de knop om ze uit te lezen, bijvoorbeeld "12 PDF's uitlezen".
2. **Uitlezen**. {{appName}} leest de rapporten één voor één uit. Je ziet hoeveel er klaar zijn en hoeveel niet lukten.
3. **Controleren en koppelen**. Je krijgt een lijst met per analyse de status, het rapport, de datum en het gekoppelde perceel. Loop vooral de regels langs onder **Aandacht nodig** (zie hieronder).
4. **Opslaan**. Klik op de knop om op te slaan, bijvoorbeeld "12 analyses opslaan". Regels die nog aandacht nodig hebben, worden overgeslagen.

### Hoe koppelt {{appName}} een rapport aan een perceel? {#koppelen}

1. Op locatie: staat het monsterpunt op het rapport binnen een perceel, dan wordt de analyse aan dat perceel gekoppeld. Dat is de betrouwbaarste koppeling.
2. Op naam: lukt dat niet, dan zoekt {{appName}} een perceel met precies dezelfde naam als op het rapport.

Bij elke regel zie je hoe de koppeling tot stand kwam, bijvoorbeeld "Gekoppeld op locatie" of "Gekoppeld op naam". Wijzen de locatie en de naam naar verschillende percelen, dan wint de locatie en krijg je een waarschuwing. Klopt de koppeling niet, kies dan het goede perceel met **Kies een perceel**.

Tip: geef je percelen in {{appName}} dezelfde namen als bij het lab. Dan lukt de koppeling op naam ook als er geen monsterpunt op het rapport staat.

### Rapporten die aandacht nodig hebben {#aandacht}

Met de filters **Aandacht nodig**, **Klaar**, **Opgeslagen** en **Alles** loop je de lijst snel door.

- **Geen perceel gekoppeld**: kies zelf het perceel. Tot dan wordt de analyse niet opgeslagen.
- **Datum ontbreekt**: vul de datum in. Staan er meer analyses zonder datum in hetzelfde rapport, dan kun je die datum voor allemaal tegelijk invullen.
- Dubbele analyse: een analyse met hetzelfde perceel, dezelfde datum en diepte als een andere regel of als een analyse die al in {{appName}} staat. Een analyse die al bestaat, staat standaard uitgevinkt.
- **Mislukt**: probeer het opnieuw met **Opnieuw**. Lukt het nog steeds niet, controleer dan of het rapport van een ondersteund lab komt.

Met **Bekijken** open je de analyse naast het originele PDF-rapport. Zo controleer je de uitgelezen waarden en pas je ze aan voordat je opslaat.

{{appName}} kan rapporten lezen van Eurofins Agro, HLB, ALNN, Altic, Dumea, Fertilab, Koch, Roba, SoilTech en Laboratorium Zeeuws-Vlaanderen. Kijk de uitgelezen waarden altijd even na.

## Een analyse voor één perceel toevoegen {#analyse-toevoegen}

Ga op de perceelpagina naar **Bodem** en klik op **Bodemanalyse toevoegen**. Heb je een PDF van het lab voor dit perceel? Sleep die in het vak en klik op **PDF uitlezen**. Je ziet dan de uitgelezen waarden; controleer ze en sla de analyse op. Geen PDF, of een lab dat nog niet wordt ondersteund? Kies onder **Zelf invoeren** het formulier dat bij je analyse past:

| Keuze                      | Wanneer gebruik je dit?                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Standaard bodemanalyse** | Je typt een standaard bodemanalyse over, met onder meer P-Al, P-plantbeschikbaar, kalium, pH, organische stof en textuur. |
| **Nmin-bemonstering**      | Je hebt een Nmin-meting: nitraat-N en ammonium-N, of de N-voorraad in kg N/ha.                                            |
| **Analyse voor derogatie** | Je hebt een analyse voor de derogatie. Vanaf 2026 staat deze onder **Meer opties**.                                       |
| **Alle bodemparameters**   | Je wilt andere of extra parameters invullen. Deze staat onder **Meer opties**.                                            |

Bij handmatig invoeren zijn **Laboratorium**, **Datum** en **Bemonsterde laag (onderkant)** verplicht. De rest vul je in voor zover je het weet.

Op de pagina **Bodem** zie je voor elke parameter de meest recente waarde, en rechts de lijst met al je analyses. Daar kun je een analyse bekijken, aanpassen, verwijderen of de oorspronkelijke PDF downloaden.

## BodemConditieScore {#bodemconditiescore}

Met de BodemConditieScore (BCS) beoordeel je de bodem in het veld, met een spade en je ogen. {{appName}} leidt je er stap voor stap doorheen.

1. Ga op de perceelpagina naar **BodemConditieScore** en klik op **Nieuwe meting toevoegen**.
2. Vul de datum in en maak eventueel foto's, ook direct met de camera van je telefoon.
3. Beoordeel negen kenmerken, één per stap. Bij elk kenmerk staat wat je beoordeelt, hoe je dat doet en een fototip.
   - Gewasbedekking, beworteling, verdichting ondergrond, regenwormen, bodemstructuur en gekleurde vlekken: **Slecht**, **Matig** of **Goed**.
   - Plasvorming, scheuren en spoorvorming: **Geen**, **Enig** of **Veel**.
4. Controleer de score en klik op **Bevestigen en opslaan**.

Je hoeft niet alles in te vullen; één kenmerk is genoeg om op te slaan. Bij een foto kun je een notitie of tekening plaatsen, bijvoorbeeld om een verdichte laag aan te wijzen. Achteraf aanpassen kan met **Bewerken**. De BCS wordt ook gebruikt bij de berekening van de [bodemindicatoren](/manual/bodemkwaliteit).
