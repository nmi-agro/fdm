---
title: Een bedrijf aanmaken
description: Zet stap voor stap een bedrijf op, haal je percelen op via RVO en eHerkenning, een shapefile of de kaart, en upload je bodemanalyses.
section: Aan de slag
order: 3
inApp:
  - Mijn bedrijven
  - Nieuw bedrijf
routes:
  - farm.create.*
  - farm.$b_id_farm.$calendar.rvo.tsx
  - farm.$b_id_farm.$calendar.upload.tsx
  - farm.$b_id_farm.$calendar.field.new.*
  - farm.$b_id_farm.settings*
watch:
  - fdm-app/app/components/blocks/header/create-farm.tsx
  - fdm-app/app/components/blocks/rvo/**
  - fdm-app/app/components/blocks/fields-new/**
  - fdm-app/app/components/blocks/mijnpercelen/**
  - fdm-core/src/field.ts
keywords:
  - bedrijf aanmaken
  - percelen importeren
  - RVO eHerkenning
  - shapefile Mijn Percelen
  - BRP percelen kaart
  - bodemanalyses PDF
related:
  - aan-de-slag
  - bodem
  - bouwplan
  - samenwerken
---

Een bedrijf zet je op met een wizard van vijf stappen: bedrijfsgegevens, percelen, perceelseigenschappen en bodem, bouwplan en toegang. Je hoeft niet alles in één keer af te maken. Alles wat je in de wizard invult, kun je later aanvullen of aanpassen.

## Wat heb je nodig? {#voorbereiding}

Om te beginnen heb je alleen de naam van je bedrijf nodig en het jaar waarmee je wilt starten. Heb je je KvK-nummer bij de hand, dan vult {{appName}} je bedrijfsgegevens voor je in.

Voor je percelen kies je in stap 2 een van deze drie manieren:

- [Ophalen bij RVO](#rvo): je hebt je KvK-nummer en eHerkenning nodig, van het bedrijf zelf of van je eigen organisatie met een machtiging bij RVO. Zo neem je je registratie bij RVO in één keer compleet over.
- [Een shapefile uploaden](#shapefile): je hebt een shapefile van je percelen uit mijn.rvo.nl nodig. Handig als je geen eHerkenning bij de hand hebt.
- [Aanklikken op de kaart](#kaart): je hoeft alleen te weten waar je percelen liggen. Handig om snel te beginnen of als je maar een paar percelen hebt.

Heb je labrapporten van je bodemanalyses als PDF? Houd die ook bij de hand: in stap 3 upload je ze in één keer voor al je percelen.

## Stap 1: Bedrijfsgegevens {#stappen}

Klik op **Mijn bedrijven** op **Nieuw bedrijf** (of **Bedrijf aanmaken** als je nog geen bedrijven hebt).

![De eerste stap van een nieuw bedrijf: het KvK-nummer invullen](screenshot:bedrijf-aanmaken-gegevens)

1. Vul het **KvK-nummer** in. Zie je de knop **Ophalen uit KvK**, klik er dan op: {{appName}} vult de naam en het adres in uit het Handelsregister. Controleer ze en pas ze zo nodig aan. Liever zelf invullen? Kies "Sla deze stap over en vul de gegevens zelf in".
2. Controleer de **Bedrijfsnaam** en vul eventueel **Adres** en **Postcode** in.
3. Kies het **Kalenderjaar**: het jaar waarmee je begint met invoeren.
4. Geef onder Instellingen aan wat voor je bedrijf geldt: derogatie (alleen voor jaren vóór 2026), een voornemen tot weiden en of het bedrijf biologisch gecertificeerd is. Bij biologisch vul je eventueel het **SKAL-nummer** en **TRACES-nummer** in.
5. Klik op **Volgende**.

![De bedrijfsgegevens, opgehaald uit het KvK Handelsregister (een testbedrijf)](screenshot:bedrijf-aanmaken-kvk-opgehaald)

## Stap 2: Percelen toevoegen {#percelen-importeren}

Je kiest hoe je de percelen van je bedrijf binnenhaalt. Bij alle drie de manieren krijgen je percelen een hoofdgewas, en vult {{appName}} de bodemgegevens alvast in met een schatting, zodat je direct verder kunt.

### Importeren vanuit RVO met eHerkenning {#rvo}

Met deze manier haal je je percelen op zoals ze bij RVO geregistreerd staan, met gewas, ingangsdatum en bufferstroken. De functie is nog in ontwikkeling.

1. Klik op **Importeren vanuit RVO**.
2. Kies met welke eHerkenning je inlogt: die van het bedrijf zelf, of die van je eigen organisatie als je een machtiging hebt.
3. Klik op **Verbinden met RVO** en log in met eHerkenning.
4. Je komt terug in {{appName}} met een overzicht van je percelen. Controleer het (zie [de vergelijking controleren](#vergelijking)) en klik op **Opslaan en verder**.

Heeft het bedrijf nog geen KvK-nummer, dan zie je eerst **KvK-nummer toevoegen**. Ververs de pagina niet tijdens de import: dan wordt de verbinding verbroken en moet je opnieuw inloggen. Zie je deze manier niet, dan is de koppeling met RVO in deze omgeving niet beschikbaar; gebruik dan de shapefile.

### RVO-shapefile uploaden {#shapefile}

Heb je geen eHerkenning bij de hand, download dan een shapefile uit mijn.rvo.nl:

1. Log in op mijn.rvo.nl.
2. Ga via "Registratie en meldingen doorgeven" naar "Percelen registreren".
3. Klik onder "Mijn percelen" op "Registreren en wijzigen" en ga naar "Wijzigen".
4. Klik op de datum en kies het jaar en de peildatum.
5. Klik op het pijltje naar beneden en kies "Shape". De download start.

Upload de shapefile daarna in {{appName}}:

1. Klik op **Bestand uploaden**.
2. Controleer het kalenderjaar bovenaan. Klopt het niet, kies dan een ander jaar.
3. Sleep de vier bestanden in het vak: .shp, .shx, .dbf en .prj. Ze zijn alle vier nodig, en elk bestand mag maximaal 5 MB zijn.
4. Klik op **Uploaden**, controleer de percelen en klik op **Opslaan en verder**.

![Het uploaden van een RVO-shapefile bij een nieuw bedrijf](screenshot:bedrijf-aanmaken-shapefile)

Een shapefile zegt niet welke percelen bufferstroken zijn. {{appName}} schat dat aan de hand van de vorm en de naam van het perceel. Controleer de kolom **Bufferstrook** dus even voordat je opslaat.

### Selecteren op de kaart {#kaart}

Op de kaart klik je je percelen aan uit de Basisregistratie Gewaspercelen (BRP). Je hebt niets nodig.

1. Klik op **Naar de kaart**.
2. Zoek je bedrijf op met **Zoek naar een locatie...** en zoom in. Pas als je ver genoeg bent ingezoomd, kun je percelen selecteren.
3. Klik de percelen aan die bij je bedrijf horen. Nog een keer klikken haalt een perceel weer weg.
4. Klik op **Sla geselecteerde percelen op**.

![Percelen selecteren op de kaart bij een nieuw bedrijf](screenshot:bedrijf-aanmaken-kaart)

De percelen krijgen de namen "Perceel 1", "Perceel 2" enzovoort; die pas je in de volgende stap aan. Het hoofdgewas komt uit de BRP van het gekozen jaar.

### De vergelijking met RVO controleren {#vergelijking}

Na een import via RVO of een shapefile zie je per perceel een status. Elke regel volgt standaard RVO; per regel kies je zo nodig iets anders:

| Status                | Wat betekent het?                             | Je kunt kiezen uit                                   |
| --------------------- | --------------------------------------------- | ---------------------------------------------------- |
| **Alleen bij RVO**    | Het perceel staat nog niet in {{appName}}     | **Toevoegen** of **Negeren**                         |
| **Verschil**          | De gegevens bij RVO wijken af                 | **Gebruik RVO** of de gegevens in {{appName}} houden |
| **Niet meer bij RVO** | Het perceel staat niet meer in je registratie | **Afsluiten** of **Behouden**                        |
| Alleen in {{appName}} | Het perceel staat niet bij RVO                | **Verwijderen** of **Behouden**                      |
| **Gelijk**            | Niets te doen                                 |                                                      |

Wil je een naam, gewas of bufferstrook zelf aanpassen, zet dan **Waarden zelf aanpassen** aan.

## Stap 3: Percelen en bodem controleren {#percelen-controleren}

Je ziet links al je percelen en bovenaan hoeveel er al een bodemanalyse hebben, bijvoorbeeld "8 van 12 met bodemanalyse". Een groen vinkje betekent dat er een gemeten analyse is; een oranje icoon dat de bodemgegevens geschat zijn of ontbreken.

1. Klik een perceel aan. Pas waar nodig de **Naam** aan, controleer het **Hoofdgewas** en vink **Bufferstrook** aan als het een bufferstrook is. Klik op **Bijwerken**.
2. Kijk naar de kaart **Bodem**. Staat er **Schatting**, dan rekent {{appName}} nog met geschatte waarden.
3. Heb je labrapporten? Klik dan op **Bodemanalyses uploaden (pdf)** en upload ze voor alle percelen tegelijk. {{appName}} leest ze uit en koppelt ze zelf aan de juiste percelen; zie [Bodemanalyses in één keer uploaden](/manual/bodem#bodemanalyses-uploaden). Een enkele analyse typ je over met **Handmatig invullen**.
4. Klik op **Doorgaan**.

![Stap 3: de percelen en hun bodemgegevens controleren](screenshot:bedrijf-aanmaken-percelen)

Eigen bodemanalyses maken de berekeningen een stuk nauwkeuriger. Je kunt ze ook later nog toevoegen.

## Stap 4: Bouwplan {#bouwplan}

Je ziet je gewassen op een rij. Vul zaaidata, oogsten en bemestingen in voor alle percelen met hetzelfde gewas tegelijk (zie [Bouwplan](/manual/bouwplan)). Klik op **Doorgaan**.

![Stap 4: het bouwplan van het nieuwe bedrijf](screenshot:bedrijf-aanmaken-bouwplan)

## Stap 5: Toegang instellen {#toegang}

Wil je een adviseur of collega laten meekijken? Nodig ze hier alvast uit (zie [Samenwerken](/manual/samenwerken)). Dit is optioneel. Klik op **Voltooien** en je bedrijf staat klaar.

![Stap 5: anderen toegang geven tot het nieuwe bedrijf](screenshot:bedrijf-aanmaken-toegang)

## Later percelen toevoegen {#percelen-toevoegen}

Komt er een perceel bij, of heb je je registratie bij RVO aangepast? Op het bedrijfsdashboard vind je onder **Acties**:

- **Ophalen bij RVO**: percelen opnieuw ophalen met eHerkenning.
- **RVO Shapefile uploaden**: een nieuwe shapefile uploaden.
- **Nieuwe percelen**: percelen aanklikken op de kaart.
- **Upload bodemanalyses**: labrapporten voor meerdere percelen tegelijk uploaden.

Bij RVO en de shapefile vergelijkt {{appName}} wat er al in de app staat met wat RVO heeft, met dezelfde [statussen](#vergelijking). Klik daarna op **Wijzigingen toepassen** en bevestig met **Bevestigen**. Verwijder je percelen, dan heet die knop **Bevestigen en verwijderen**.

> Let op: een perceel dat alleen in {{appName}} staat, staat standaard op **Verwijderen**. Kijk de lijst dus goed na voordat je bevestigt.

## Bedrijfsinstellingen {#bedrijfsinstellingen}

Via **Instellingen** op de bedrijfspagina pas je de bedrijfsgegevens aan. Eigenaren en adviseurs kunnen hier wijzigen; onderzoekers kunnen alleen kijken.

| Tabblad             | Wat stel je in?                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gegevens**        | Bedrijfsnaam, KvK-nummer, adres en postcode.                                                                                                              |
| **Derogatie**       | Vanaf 2026 bestaat derogatie niet meer. Voor 2020 tot en met 2025 zet je hem per jaar aan of uit; dat telt mee in de gebruiksruimte van die jaren.        |
| **Bio-certificaat** | Start- en einddatum, TRACES- en SKAL-nummer van je biologische certificaat.                                                                               |
| **Beweiding**       | Per jaar of je weidt of van plan bent te weiden. Dit telt mee in de berekeningen.                                                                         |
| **Toegang**         | Wie mag er meekijken of meewerken (zie [Samenwerken](/manual/samenwerken)).                                                                               |
| **Verwijderen**     | Het hele bedrijf verwijderen, inclusief alle percelen, gewassen, bemestingen, bodemanalyses en oogsten. Alleen de eigenaar kan dit, en het is definitief. |

![De instellingen van een bedrijf, op het tabblad met de bedrijfsgegevens](screenshot:bedrijfsinstellingen)
