---
title: Melkvee
description: Het Melkvee-overzicht met koppels, beweiding en kengetallen. Leg je melkvee vast in koppels en registreer per dier levensnummer, koppel en afvoer.
section: Gegevens vastleggen
order: 8
inApp:
  - Melkvee
routes:
  - farm.$b_id_farm.$calendar.livestock._index.tsx
  - farm.$b_id_farm.$calendar.livestock.new.tsx
  - farm.$b_id_farm.$calendar.livestock.animal*
watch:
  - fdm-app/app/components/blocks/livestock/**
keywords:
  - veestapel
  - melkvee
  - koppel
  - jongvee
  - GVE
  - dieren registreren
related:
  - beweiding
  - background/beweiding
---

In {{appName}} leg je je melkvee vast in koppels: groepen dieren die samen worden gehouden en samen weiden, zoals de melkkoeien of het jongvee. Elke koppel hoort bij een diercategorie van RVO, en daarmee weet {{appName}} hoeveel grootvee-eenheden (GVE) een dier telt. Met je veestapel leg je daarna de [beweiding](/manual/beweiding) vast en zie je de veebezetting op je grasland.

## Je eerste koppel {#eerste-koppel}

Heeft je bedrijf nog geen dieren, dan zie je in het menu **Melkvee toevoegen**. Daar maak je je eerste koppel aan:

1. Kies de diercategorie, bijvoorbeeld melk- en kalfkoeien. Voorlopig kun je alleen diercategorieën van graasdieren kiezen: rundvee, schapen, geiten, paarden en pony's. {{appName}} vult een naam voor de koppel in, die je kunt aanpassen.
2. Vul het aantal dieren in; het veld begint leeg.
3. Kies bij **Aanwezig sinds** de dag waarop de dieren op het bedrijf en in de koppel kwamen. Vooraf staat 1 januari van het gekozen jaar ingevuld, omdat die dag vaak niet bekend is; laat die staan als je de datum niet weet. Een dag in de toekomst kan niet.
4. Klik op **Koppel aanmaken**.

{{appName}} maakt het aantal dieren aan zonder oormerk. Voor beweiding en veebezetting is het aantal genoeg; oormerk en levensnummer kun je later per dier aanvullen. Na het opslaan kom je op het Melkvee-overzicht.

## Het Melkvee-overzicht {#overzicht}

Vanaf dat moment staat **Melkvee** in het menu. Het opent het Melkvee-overzicht. Met het pijltje ernaast klap je de onderdelen **Beweidingskalender**, **Beweidingsplanner**, **Weidegang** en **Vee** uit; op een Melkvee-pagina staan ze al open.

Het overzicht heeft drie delen:

- _Kengetallen:_ het aantal dieren en de GVE, de weidedagen, de voortgang naar Weidemelk en het beweidingsplatform. Met **Weidegang** open je de [inzichten](/manual/beweiding#inzichten).
- _Beweiding:_ per perceel de afgelopen week en de komende week, in de kleuren van de [beweidingskalender](/manual/beweiding#kalender), met daaronder de geplande beweiding van deze week. Met **Beweidingskalender** open je de hele kalender.
- _Koppels:_ een kaart per koppel, met het aantal dieren, de GVE en of de koppel nu weidt.

Bovenaan voeg je direct iets toe: **Beweiding toevoegen** (kies een perceel), **Dier toevoegen** of **Koppel toevoegen**.

![Het Melkvee-overzicht met kengetallen, beweiding en koppels](screenshot:veestapel-overzicht)

## Koppels beheren {#koppels}

Je beheert je koppels op het Melkvee-overzicht en bovenaan de pagina [Vee](#dieren):

- _Aantal aanpassen:_ met de plus en min op de kaart. Met de plus voeg je dieren zonder oormerk toe: vul het aantal in en bij **Aanwezig sinds** de dag waarop ze in de koppel kwamen, vooraf vandaag, en klik op **Toevoegen**. Kies een eerdere dag als de dieren er al eerder waren; dan tellen ze vanaf die dag mee voor de GVE en de veebezetting. Met de min voer je een dier af; je bevestigt dat met **Afvoeren bevestigen**. Dieren zonder oormerk worden als eerste afgevoerd.
- _Nog een koppel:_ klik op **Koppel toevoegen**, bijvoorbeeld voor droogstaande koeien of jongvee. Ook hier kies je bij **Aanwezig sinds** sinds wanneer de dieren er zijn, vooraf 1 januari van het gekozen jaar.
- _Via het menu op de kaart:_ **Naam wijzigen**, **Dieren verplaatsen naar andere koppel** en **Koppel verwijderen**. Een koppel met dieren kun je pas verwijderen als je de dieren hebt afgevoerd of verplaatst.

Het aantal dieren in een koppel wordt niet apart opgeslagen: {{appName}} telt de dieren die op dat moment in de koppel zitten.

## Vee {#dieren}

Met **Al het vee bekijken** of **Vee** in het menu open je de pagina Vee. Bovenaan staan je koppels, met dezelfde kaarten als op het overzicht; zo beheer je de [koppels](#koppels) en de dieren op één plek. Met **Koppel toevoegen** maak je een nieuwe koppel. Met _Dieren bekijken_ op een kaart spring je naar de lijst met alleen de dieren van die koppel.

Daaronder staat de lijst van alle dieren, op werknummer. Je zoekt in alle kolommen, zoals werknummer, levensnummer, koppel en datum, en filtert op koppel. De kop van de lijst noemt de gekozen koppel en hoeveel van al je dieren de lijst toont, bijvoorbeeld _Dieren van Melkkoeien (60 van 80)_. Een dier zonder levensnummer heeft een streepje. Met **Dier toevoegen** voeg je één dier toe en wijs je het direct aan een koppel toe.

Klik op een dier om de details te openen. Daar:

- vul je levensnummer, werknummer, geboortedatum en geslacht aan en sla je ze op met **Wijzigingen opslaan**. Is het geslacht nog niet bekend, dan staat er _Onbekend_;
- verplaats je het dier naar een andere koppel met **Verplaats naar koppel**;
- leg je vast dat het dier het bedrijf verlaat, met datum en reden, met **Afvoer vastleggen**. De datum vul je zelf in; er staat niets vooraf ingevuld, en de knop werkt pas als je een datum hebt gekozen. Een afvoer in de toekomst houdt het dier tot die datum in zijn koppel, en de pagina toont dan wanneer het vertrek gepland is;
- zie je de beweidingshistorie van het dier en in welke koppels het heeft gelopen.

### Een dier verplaatsen {#verplaatsen}

Een dier volgt zijn levensloop. Je verplaatst het naar een andere koppel van dezelfde diercategorie, of naar de volgende levensfase van dezelfde diersoort: jongvee wordt een pink, en een pink gaat na het afkalven naar de melkkoeien. Terug naar een jongere leeftijdsgroep of naar een andere diersoort kan niet; een waterbuffel wordt dus nooit een melkkoe. Sommige diercategorieën tellen ook de jongen mee, zoals de pasgeboren lammeren bij de melkgeiten, of de lammeren tot ongeveer 4 maanden bij de schapen op het bedrijf waar ze geboren zijn. Die jongen kun je naar hun eigen categorie verplaatsen, ook al is dat een jongere leeftijdsgroep dan die van de moederdieren. Soms hangt de volgende fase af van het geslacht: een vaarskalf gaat naar het vrouwelijk jongvee, een stierkalf naar de fokstieren.

Bij **Doelkoppel** zie je daarom alleen de koppels waar het dier naartoe kan. Is het geslacht nog onbekend en kan maar één geslacht naar de gekozen koppel, dan krijgt het dier dat geslacht; dat staat onder de keuze. Hetzelfde geldt voor **Dieren verplaatsen naar andere koppel** op een koppelkaart: daar zie je alleen de koppels waar alle dieren van de koppel naartoe kunnen.

### Levensnummer en werknummer {#levensnummer}

Het werknummer is een deel van het levensnummer op het oormerk: de 4 cijfers voor het laatste cijfer. In NL 1234567 8901 2 is het werknummer dus 8901. Vul je bij een rund een Nederlands levensnummer in, dan vult {{appName}} het werknummer zelf in. Je kunt het daarna nog aanpassen. Een dier zonder levensnummer krijgt een werknummer vanaf 10001, en dat nummer vervangt {{appName}} zodra je het levensnummer invult.

{{appName}} controleert het levensnummer van een rund met een Nederlands oormerk: het heeft 9 of 12 cijfers, en het laatste cijfer is een controlecijfer dat moet kloppen bij de andere cijfers. Zo valt een tikfout direct op. Een levensnummer uit een ander land neemt {{appName}} over zoals je het invult.

Een werknummer en een levensnummer horen op je bedrijf bij één dier tegelijk. Is een dier afgevoerd, dan kan een ander dier het nummer weer krijgen.

De diercategorie van de koppel bepaalt welk geslacht een dier mag hebben. Een dier in de koppel melk- en kalfkoeien is bijvoorbeeld altijd vrouwelijk. Voeg je een dier zonder geslacht toe aan zo'n koppel, dan krijgt het dat geslacht vanzelf.

## GVE en veebezetting {#gve}

Elke diercategorie heeft een vast aantal GVE per dier, uit de diercategorieën van RVO: een melkkoe telt als 1 GVE, jongvee minder. De GVE van een koppel is het aantal dieren maal die factor. De veebezetting op al het grasland, bij **Veebezetting platform** op Weidegang, is de GVE van alle koppels gedeeld door de oppervlakte grasland van het bedrijf (zonder bufferstroken).

Hoe {{appName}} de veebezetting op het beweidingsplatform berekent, lees je in de [achtergrond bij beweiding](/manual/background/beweiding#veebezetting).
