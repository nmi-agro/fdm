---
title: Zo werkt {{appName}}
description: Wat {{appName}} doet, voor wie het is en hoe je je weg vindt via de kalender, de zijbalk en het bedrijfsdashboard.
section: Aan de slag
order: 1
routes:
  - farm.tsx
  - farm.$b_id_farm.tsx
  - farm.$b_id_farm._index.tsx
watch:
  - fdm-app/app/components/blocks/sidebar/**
  - fdm-app/app/components/blocks/farm/**
keywords:
  - bedrijfsregistratie
  - stikstofbalans
  - gebruiksruimte
  - bemestingsadvies
related:
  - aan-de-slag
  - bedrijf-aanmaken
---

Met {{appName}} leg je de gegevens van een bedrijf één keer vast en krijg je er direct allerlei inzichten voor terug: van stikstofbalans en gebruiksruimte tot bemestingsadvies en bodemkwaliteit.

Het idee is simpel. Jij vult in wat je weet: welke percelen je hebt, wat erop groeit, wat je hebt geoogst, welke mest je hebt uitgereden en wat de bodemanalyse zegt. {{appName}} rekent de rest uit. Je hoeft dus nooit zelf een totaal of een balans uit te rekenen en in te typen. Hoe meer je invult, hoe completer het plaatje wordt.

## Van jouw gegevens naar inzicht

| Wat je invult       | Wat je ervoor terugkrijgt                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Percelen            | [Stikstofbalans en organische-stofbalans](/manual/balansen)                                   |
| Gewassen en oogsten | [Gebruiksruimte](/manual/gebruiksruimte) volgens de mestregels                                |
| Bemestingen         | [Bemestingsadvies](/manual/bemestingsadvies) per perceel en nutriënt                          |
| Bodemanalyses       | [Bodemkwaliteit](/manual/bodemkwaliteit) volgens BLN3                                         |
| Maatregelen         | Een [bemestingsplan](/manual/bemestingsplan) als PDF, en kaarten in de [Atlas](/manual/atlas) |

Alle uitkomsten rekenen met dezelfde gegevens. Vul je één keer een bemesting in, dan zie je die terug in de balans, de gebruiksruimte, het advies en het bemestingsplan. Je hoeft niet eens op te slaan om dat te zien: terwijl je een bemesting invult, laat {{appName}} [direct het effect zien](/manual/bemesting#effect) op de gebruiksruimte, het bemestingsadvies en de stikstofbalans.

## Voor wie is {{appName}}? {#voor-wie}

| Wie                         | Waar {{appName}} je bij helpt                                                                                                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teler                       | Je bedrijf bijhouden door het seizoen heen: percelen, bouwplan, bemestingen en oogsten. Zien hoeveel gebruiksruimte je nog over hebt, of je bemesting aansluit bij het advies en hoe je bodem ervoor staat. |
| Adviseur                    | Meerdere bedrijven beheren, terugkijken op het afgelopen seizoen en het plan voor volgend jaar maken. Percelen en jaren met elkaar vergelijken en een bemestingsplan als PDF meegeven aan je klant.         |
| Beleidsmaker of onderzoeker | Via een organisatie een overzicht krijgen over meerdere bedrijven: balansen, bodemkwaliteit (BLN3) en genomen maatregelen. Met de rol Onderzoeker kijk je mee zonder iets te wijzigen.                      |

## Wat {{appName}} niet doet {#wat-het-niet-doet}

{{appName}} is een hulpmiddel om je bedrijf te begrijpen en te plannen. Het is geen officiële aangifte: voor je verantwoording aan RVO gelden altijd de regels en publicaties van RVO. Niet elke situatie uit de mestregels zit erin, en sommige uitkomsten zijn schattingen als je nog geen eigen metingen hebt ingevuld. Waar dat zo is, zegt de app het.

## Je weg vinden {#je-weg-vinden}

Alles begint bij twee keuzes: welk bedrijf je bekijkt en welk jaar. Daarna vind je alles via de zijbalk aan de linkerkant.

### De kalender: kies eerst je jaar {#kalender}

Bovenin de zijbalk staat **Kalender**. Hier kies je het jaar waar je naar kijkt, van 2020 tot en met volgend jaar, of **Alle jaren**. Bijna elke pagina laat de gegevens van dat jaar zien: het bouwplan, de bemestingen, de balansen en de gebruiksruimte. Zie je niet wat je verwacht? Kijk dan eerst even of het juiste jaar is gekozen.

Handig om te weten: het jaar staat ook in het webadres. Stuur je een link naar een collega, dan ziet die precies hetzelfde jaar.

### De zijbalk {#zijbalk}

| Groep       | Wat je er vindt                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bedrijf     | **Mijn bedrijven**, **Kalender**, **Percelen**, **Bouwplan**, **Tijdlijn**, **Maatregelen**, **Meststoffen** en de perceelkiezer **Kies een perceel** |
| Apps        | **Atlas**, **Balans** (Stikstof en Organische stof), **Bemestingsadvies**, **Gebruiksruimte** en **Indicatoren**                                      |
| Labs        | **Mineralisatie** en **Gerrit**: nieuwe, experimentele functies                                                                                       |
| Organisatie | **Mijn organisaties** en, als je een organisatie kiest, de overzichten over meerdere bedrijven                                                        |
| Onderaan    | **Handleiding**, **Ondersteuning**, de melding **Wat is er nieuw?** en het menu onder je naam (Account, Cookies, Organisaties, Uitloggen)             |

Is een onderdeel grijs? Dan heb je nog geen bedrijf gekozen. Klik erop en kies een bedrijf in het venster **Kies een bedrijf**.

De perceelkiezer onthoudt welke percelen je net hebt bekeken (**Onlangs bezocht**). Zo spring je snel heen en weer tussen een paar percelen.

Op veel pagina's staat rechtsboven een vraagteken. Daarmee open je het deel van deze handleiding dat over die pagina gaat.

### Het bedrijfsdashboard {#bedrijfsdashboard}

Klik je op een bedrijf, dan kom je op het dashboard. Dit is je startpunt:

- Onder **Apps** staan kaarten naar Atlas, Stikstofbalans, OS Balans, Bemestingsadvies, Gebruiksruimte en Bemestingsplan.
- Onder **Acties** vind je de dingen die je vaak doet als je gegevens wilt toevoegen, zoals **Nieuwe percelen**, **Ophalen bij RVO**, **RVO Shapefile uploaden** en **Upload bodemanalyses**.

Op een laptop of grotere monitor werkt {{appName}} het prettigst. Op je telefoon kun je ook veel, maar sommige onderdelen, zoals de kaarten en de tijdlijn, zijn daar beperkter.

## Over deze handleiding

Knoppen en menu's staan in deze handleiding zoals je ze in de app ziet, bijvoorbeeld **Bouwplan**. {{appName}} wordt nog volop doorontwikkeld, dus een label kan af en toe net anders heten. Onder **Wat is er nieuw?** in de app lees je wat er is veranderd.

Wil je weten hoe een uitkomst wordt berekend? Onder [Achtergrond](/manual/background) lees je wat er achter de stikstofbalans, de gebruiksruimte, het bemestingsadvies en de bodemkwaliteit zit.

{{appName}} is gebouwd op het open-source Farm Data Model ([nmi-agro/fdm](https://github.com/nmi-agro/fdm)). Daardoor zijn de berekeningen transparant en te controleren.
