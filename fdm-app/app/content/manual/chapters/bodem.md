---
title: Bodem
description: Voeg bodemanalyses toe of upload je labrapporten in één keer, zie wat gemeten en wat geschat is, en leg een BodemConditieScore vast.
section: Gegevens vastleggen
order: 3
inApp:
  - Percelen
  - Bodem
routes:
  - farm.$b_id_farm.$calendar.field.$b_id.soil*
  - farm.$b_id_farm.$calendar.field.$b_id.bcs*
  - farm.$b_id_farm.soil-analysis.bulk.tsx
watch:
  - fdm-app/app/components/blocks/soil/**
  - fdm-app/app/components/blocks/soil-visual/**
keywords:
  - bodemanalyse
  - labrapport uploaden
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

## Alle analyses van het bedrijf in één keer uploaden {#bodemanalyses-uploaden}

Heb je een stapel PDF's van het lab voor verschillende percelen? Upload ze dan in één keer via de bedrijfspagina. {{appName}} leest de rapporten uit en zoekt zelf uit welk rapport bij welk perceel hoort.

1. Ga naar het bedrijfsdashboard en klik onder **Acties** op **Upload bodemanalyses**.
2. Sleep alle PDF-bestanden in het uploadvak (maximaal 5 MB per bestand) en klik op de knop om ze uit te lezen, bijvoorbeeld "12 PDF's uitlezen".
3. Je komt bij de stap **Controleren en koppelen**. {{appName}} koppelt elk rapport eerst aan een perceel op basis van de locatie van het monsterpunt, en anders op basis van de perceelnaam.
4. Controleer per rapport het perceel en de datum. Klopt iets niet, kies dan het goede perceel of vul de datum in. Rapporten zonder perceel of datum worden overgeslagen.
5. Klik op de knop om op te slaan, bijvoorbeeld "12 analyses opslaan".

Dit werkt ook tijdens het aanmaken van een nieuw bedrijf, via **Bodemanalyses uploaden (pdf)** in de stap Percelen.

{{appName}} kan rapporten lezen van onder meer Eurofins Agro, HLB, ALNN, Altic, Dumea, Fertilab, Koch, Roba, SoilTech en Laboratorium Zeeuws-Vlaanderen. Kijk de uitgelezen waarden altijd even na.

## Een analyse voor één perceel toevoegen {#analyse-toevoegen}

Ga op de perceelpagina naar **Bodem** en klik op **Bodemanalyse toevoegen**. Heb je een PDF van het lab voor dit perceel? Upload die dan meteen op deze pagina. Geen PDF, of een lab dat nog niet wordt ondersteund? Kies onder **Zelf invoeren** het formulier dat bij je analyse past:

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
