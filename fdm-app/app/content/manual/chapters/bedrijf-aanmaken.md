---
title: Een bedrijf aanmaken
description: Zet in vijf stappen een bedrijf op, haal je percelen op bij RVO, via een shapefile of op de kaart, en beheer de bedrijfsinstellingen.
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
  - fdm-app/app/components/blocks/rvo/**
  - fdm-app/app/components/blocks/fields-new/**
  - fdm-app/app/components/blocks/mijnpercelen/**
keywords:
  - bedrijf toevoegen
  - percelen importeren
  - RVO
  - shapefile
  - eHerkenning
related:
  - aan-de-slag
  - percelen
  - samenwerken
---

Een nieuw bedrijf zet je op in vijf stappen. Geen zorgen als je nog niet alles bij de hand hebt: alles wat je in deze wizard invult, kun je later nog aanvullen of aanpassen.

## De vijf stappen {#stappen}

Klik op **Mijn bedrijven** op **Nieuw bedrijf** (of **Bedrijf aanmaken**).

1. **Algemene gegevens**. Vul de **Bedrijfsnaam** in en kies het **Kalenderjaar** waarmee je wilt beginnen. Het **KvK-nummer** is optioneel, maar vul het gerust meteen in: je hebt het nodig om percelen bij RVO op te halen. Onder Instellingen geef je aan of het bedrijf derogatie heeft (alleen voor jaren vóór 2026), of je van plan bent te weiden en of het bedrijf biologisch gecertificeerd is. Klik op **Volgende**.
2. **Percelen importeren**. Kies hoe je je percelen binnenhaalt. Er zijn [drie manieren](#percelen-importeren).
3. **Percelen**. Loop je percelen langs. Pas waar nodig de **Naam** aan, controleer het **Hoofdgewas** en vink **Bufferstrook** aan als het een bufferstrook is. Klik per perceel op **Bijwerken**. Hier voeg je ook direct bodemanalyses toe (zie [Bodem](/manual/bodem)).
4. **Bouwplan**. Je ziet je gewassen op een rij. Vul hier zaaidata, oogsten en bemestingen aan, voor meerdere percelen tegelijk (zie [Bouwplan](/manual/bouwplan)). Klik op **Doorgaan**.
5. **Toegang instellen (Optioneel)**. Wil je een adviseur of collega laten meekijken? Nodig ze hier alvast uit. Klik op **Voltooien** en je bedrijf staat klaar.

Tijdens stap 3 zie je per perceel een groen vinkje als er een gemeten bodemanalyse is, en een oranje icoon als de bodemgegevens geschat zijn of ontbreken. Bovenaan zie je hoeveel percelen al een analyse hebben, bijvoorbeeld "8 van 12 met bodemanalyse".

## Drie manieren om percelen te importeren {#percelen-importeren}

| Manier                    | Wat heb je nodig?                                                                       | Hoe werkt het?                                                                                                                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Importeren vanuit RVO** | Een KvK-nummer en eHerkenning met een machtiging voor dat KvK-nummer                    | Klik op **Verbinden met RVO** en log in met eHerkenning. Je krijgt een overzicht van je percelen zoals ze bij RVO staan. Klik op **Opslaan en verder**. Let op: ververs de pagina niet tijdens de import, anders moet je opnieuw inloggen. Deze functie is nog experimenteel. |
| **Upload Shapefile**      | De shapefile van je percelen uit mijn.rvo.nl: vier bestanden (.shp, .shx, .dbf en .prj) | Klik op **Bestand uploaden**, sleep de vier bestanden in het vak en klik op **Uploaden**. Controleer de percelen en klik op **Opslaan en verder**. Een shapefile weet niet welke percelen bufferstrook zijn; dat vink je zelf aan.                                            |
| **Selecteer op de kaart** | Niets                                                                                   | Klik op **Naar de kaart**, zoek je bedrijf op en zoom in tot je de percelen ziet. Klik de percelen aan die bij je bedrijf horen en klik op **Sla geselecteerde percelen op**. Het hoofdgewas komt uit de Basisregistratie Gewaspercelen (BRP).                                |

Een shapefile download je uit mijn.rvo.nl via Registratie en meldingen doorgeven → Percelen registreren → Registreren en wijzigen → Wijzigen. Kies het jaar en de peildatum, klik op het downloadpijltje en kies Shape.

Na het importeren zie je een tabel met per perceel een status, zoals **Alleen bij RVO**, **Niet meer bij RVO**, **Verschil** of **Gelijk**. Per perceel kies je wat je wilt doen, bijvoorbeeld **Toevoegen** of **Negeren**.

## Later percelen toevoegen {#percelen-toevoegen}

Komt er een perceel bij? Op het bedrijfsdashboard vind je **Nieuwe percelen** (via de kaart), **RVO Shapefile uploaden** en **Ophalen bij RVO**. In de percelentabel staat ook **Nieuw perceel**.

Bij RVO en de shapefile vergelijkt {{appName}} wat er al in de app staat met wat RVO heeft. Per verschil kies je: toevoegen of negeren, verwijderen of behouden, afsluiten of behouden, of de gegevens van RVO of van {{appName}} aanhouden. Klik daarna op **Wijzigingen toepassen**.

> Let op: bij **Ophalen bij RVO** staat een perceel dat alleen in {{appName}} staat standaard op **Verwijderen**. Kijk de lijst dus even goed na voordat je op Wijzigingen toepassen klikt.

## Bedrijfsinstellingen {#bedrijfsinstellingen}

Via **Instellingen** op de bedrijfspagina pas je de bedrijfsgegevens aan. Eigenaren en adviseurs kunnen hier wijzigen; onderzoekers kunnen alleen kijken.

| Tabblad             | Wat stel je in?                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gegevens**        | Bedrijfsnaam, KvK-nummer, adres en postcode.                                                                                                              |
| **Derogatie**       | Per jaar aan of uit, voor 2020 tot en met 2025. Vanaf 2026 bestaat derogatie niet meer. Dit telt mee in de gebruiksruimte.                                |
| **Bio-certificaat** | Start- en einddatum, TRACES- en SKAL-nummer van je biologische certificaat.                                                                               |
| **Beweiding**       | Per jaar of je weidt of van plan bent te weiden. Dit telt mee in de berekeningen.                                                                         |
| **Toegang**         | Wie mag er meekijken of meewerken (zie [Samenwerken](/manual/samenwerken)).                                                                               |
| **Verwijderen**     | Het hele bedrijf verwijderen, inclusief alle percelen, gewassen, bemestingen, bodemanalyses en oogsten. Alleen de eigenaar kan dit, en het is definitief. |
