---
title: Bodemanalyse
description: Welke waarden uit je bodemanalyse waarvoor worden gebruikt, hoe de actuele waarde per parameter wordt bepaald en wat geschat of berekend betekent.
section: Bodem
order: 2
inApp:
  - Percelen
  - Bodem
lastReviewed: 2026-11-05
routes: []
watch:
  - fdm-calculator/src/balance/shared/soil.ts
  - fdm-calculator/src/balance/nitrogen/input.ts
  - fdm-calculator/src/bln3/input.ts
  - fdm-calculator/src/conversions/**
  - fdm-calculator/src/estimates/**
  - fdm-calculator/src/other/current-soil-data.ts
  - fdm-calculator/src/other/nlv-supply.ts
keywords:
  - bodemanalyse interpreteren
  - bodemanalyse waarden
  - P-Al en P-CaCl2
  - BodemSchat
  - bemonstering per zone
related:
  - bodem
  - background/mineralisatie
  - background/bln3-bodemkwaliteit
  - background/gebruiksruimte
---

Een bodemanalyse vertelt je wat er in je bodem zit: organische stof, de voorraad aan nutriënten, de zuurgraad en de samenstelling van de grond. Bijna elke berekening in {{appName}} gebruikt die gegevens, van de stikstofbalans tot de fosfaatgebruiksnorm. Hoe beter en actueler je bodemgegevens, hoe betrouwbaarder de uitkomsten.

## Welke waarden worden waarvoor gebruikt? {#gebruik}

| Waarde                                               | Waar wordt hij gebruikt?                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| OS (organische stof)                                 | Stikstofbalans, organische-stofbalans, bemestingsadvies, BLN3, Dyna, NLV   |
| C-organisch, C/N-ratio, N-totale bodemvoorraad       | Stikstofbalans, mineralisatie (MINIP), NLV, BLN3, Dyna                     |
| Dichtheid                                            | Stikstofbalans, afbraak in de organische-stofbalans, mineralisatie (MINIP) |
| P-Al en P-plantbeschikbaar (P-CaCl₂)                 | Fosfaatgebruiksnorm, bemestingsadvies, BLN3                                |
| Bodemtype en GWT (grondwatertrap)                    | Doel en nitraatuitspoeling in de stikstofbalans, BLN3, Dyna                |
| Klei, silt en zand                                   | BLN3, Dyna, NLV                                                            |
| Zuurgraad (pH)                                       | Bemestingsadvies, BLN3, Dyna                                               |
| Kalium, magnesium, calcium, zwavel en spoorelementen | Bemestingsadvies, deels BLN3                                               |
| N-voorraad (Nmin)                                    | Bemestingsadvies, Dyna                                                     |

Het bemestingsadvies gebruikt alle bodemwaarden die voor een perceel bekend zijn. Meer over elk resultaat lees je op de achtergrondpagina's [Stikstofbalans](/manual/background/stikstofbalans), [Gebruiksruimte](/manual/background/gebruiksruimte) en [BLN3-bodemkwaliteit](/manual/background/bln3-bodemkwaliteit).

## Gemeten, geschat of berekend {#herkomst}

Een waarde kan op drie manieren in {{appName}} komen:

- Gemeten: uit een analyse van een laboratorium, die je hebt geüpload of ingevoerd.
- Geschat: uit NMI BodemSchat. Die schat bodemwaarden op basis van de locatie van je perceel. Zo kun je direct rekenen, maar een schatting houdt geen rekening met hoe jij je perceel de afgelopen jaren hebt beheerd.
- Berekend: afgeleid uit andere waarden.

Voor de BLN3-scores geldt: is er een labwaarde voor een parameter, dan wordt die gebruikt; alleen als die ontbreekt, valt {{appName}} terug op de schatting.

### Welke waarden worden berekend? {#berekende-waarden}

Ontbreekt een waarde die een berekening nodig heeft, dan leidt {{appName}} die waar mogelijk af:

- organische koolstof uit organische stof, of andersom;
- de C/N-ratio uit organische koolstof en totaal stikstof;
- de dichtheid uit organische stof en het bodemtype;
- het stikstofleverend vermogen (NLV) uit organische stof, klei en de C/N-ratio (zie [Mineralisatie](/manual/background/mineralisatie#nlv)).

Dat zijn vuistregels. Een gemeten waarde is altijd beter.

## De actuele waarde per parameter {#actuele-waarde}

Je hebt vaak meerdere analyses van een perceel, van verschillende jaren en soms voor verschillende delen van het perceel. Voor de bodempagina, het bemestingsadvies, de gebruiksnormen, de stikstofbalans, de organische-stofbalans en Dyna bepaalt {{appName}} daarom per parameter apart welke waarde actueel is:

1. De meest recente analyse met een waarde voor die parameter beslist.
2. Geldt die analyse voor het hele perceel, dan wordt die waarde gebruikt.
3. Is die analyse voor een zone van het perceel, dan worden de zone-analyses gecombineerd die tot een maand eerder zijn genomen. Oudere analyses tellen voor deze parameter niet meer mee.
4. Overlappen zones, dan telt de nieuwste zone voor het overlappende deel.
5. Tussen zones wordt voor getallen het oppervlaktegewogen gemiddelde genomen. Voor bodemtype en grondwatertrap telt de waarde met de grootste oppervlakte.

Bedekken de zones samen minder dan 95% van het perceel, dan krijg je een waarschuwing: de waarde geldt dan alleen voor het bemonsterde deel.

Omdat dit per parameter gebeurt, vervangt een nieuwe analyse alleen de waarden die erin staan. Laat je bijvoorbeeld alleen Nmin meten, dan blijven je waarden voor fosfaat, kalium en organische stof gewoon staan.

De balansen kijken naar alle analyses tot en met het einde van de periode die je in de kalender hebt gekozen. Een analyse van vóór die periode telt dus ook mee; een analyse van na die periode niet.

BLN3 gebruikt een eenvoudiger regel: per parameter de meest recente waarde tot en met het gekozen jaar, zonder zones te combineren.

## Nmin: stikstof in de bodem op dit moment {#nmin}

Nmin is de hoeveelheid minerale stikstof (nitraat en ammonium) die op het moment van bemonsteren in de bodem zit, in kg N/ha. Anders dan de meeste bodemwaarden verandert die van week tot week. Het bemestingsadvies en Dyna gebruiken Nmin per laag: 0 tot 30 cm en 30 tot 60 cm. Daarom is het belangrijk dat je bij het invoeren de juiste bemonsterde laag invult.

## Beperkingen {#beperkingen}

- Een analyse geldt voor de laag die is bemonsterd. Vergelijk waarden uit verschillende diepten niet zomaar met elkaar.
- Het uitlezen van labrapporten gaat automatisch en kan fouten bevatten. Controleer de uitgelezen waarden.
- Schattingen en berekende waarden zijn gemiddelden. Op jouw perceel kan het anders zijn.

## Wat kun je doen? {#wat-kun-je-doen}

- Voeg al je labanalyses toe, ook oudere. Dan ziet {{appName}} welke waarde het nieuwst is en kun je ontwikkelingen volgen.
- Kijk bij elk perceel welke waarden geschat zijn, en laat vooral organische stof, P-Al, P-plantbeschikbaar en totaal stikstof meten.
- Bemonster grote of wisselende percelen per zone, en neem dan het hele perceel mee.
- Laat Nmin meten als je je stikstofbemesting nauwkeurig wilt afstemmen.

Hoe je bodemanalyses toevoegt en uploadt, lees je in [Bodem](/manual/bodem#bodemanalyses-uploaden).
