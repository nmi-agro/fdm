---
title: Atlas
description: Bekijk je eigen percelen en die van heel Nederland op de kaart, met gewashistorie, bodemkaart, hoogtekaart en bodemkwaliteit.
section: Gegevens vastleggen
order: 6
inApp:
  - Atlas
routes:
  - farm.$b_id_farm.$calendar.atlas*
  - atlas.ahn-index.*
watch:
  - fdm-app/app/components/blocks/atlas/**
  - fdm-app/app/components/blocks/atlas-fields/**
keywords:
  - kaart
  - gewashistorie
  - BRP
  - bodemkaart
  - AHN hoogtekaart
related:
  - bodem
  - bodemkwaliteit
---

De Atlas is de kaartomgeving van {{appName}}. Je bekijkt er je eigen percelen, maar ook die van heel Nederland, met informatie over gewashistorie, bodem, hoogte en bodemkwaliteit. Een deel van de Atlas werkt zelfs zonder eigen bedrijf, dus ook handig als je een perceel wilt bekijken voordat je het pacht of koopt.

## De Atlas openen {#atlas-openen}

Klik in de zijbalk op **Atlas** en kies een kaartlaag. Op een kaart wissel je van laag via **Kies een andere kaart**. De bediening is op elke kaart hetzelfde:

- **Zoek naar een locatie...**: zoek op adres of plaatsnaam.
- **Toon percelen** / **Verberg percelen**: zet de perceelgrenzen aan of uit.
- **Terug naar percelen**: zoom terug naar de percelen van je eigen bedrijf.
- **Kies kaartstijl**: wissel tussen bijvoorbeeld satelliet en topografische kaart.

![De Atlas met de percelen van het demobedrijf, omlijnd, op de gewaspercelen uit het BRP](screenshot:atlas-gewaspercelen)

## De kaartlagen {#kaartlagen}

| Kaartlaag         | Wat zie je?                                                                                                       | Bedrijf nodig? |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | -------------- |
| **Gewaspercelen** | Alle percelen uit de Basisregistratie Gewaspercelen (BRP) van het gekozen jaar, met je eigen percelen gemarkeerd. | Nee            |
| **Bodemkaart**    | De Bodemkaart van Nederland (BRO).                                                                                | Nee            |
| **Hoogtekaart**   | De hoogte van het maaiveld volgens AHN4, in meters ten opzichte van NAP.                                          | Nee            |
| **Bodemanalyses** | Je eigen percelen, gekleurd naar de waarde van een bodemparameter die je kiest.                                   | Ja             |
| **Indicatoren**   | De BLN3-bodemkwaliteitsscores van je percelen.                                                                    | Ja             |

## Gewaspercelen: alles over één perceel {#gewaspercelen}

Zoom in tot je de perceelgrenzen ziet (de kaart zegt het als je nog verder moet inzoomen) en klik op een perceel. Je krijgt dan een detailpagina met:

- **Perceeldetails**: oppervlakte, grondsoortregio, en of het perceel in een NV-gebied, grondwaterbeschermingsgebied of Natura 2000-gebied ligt.
- **Gewashistorie**: welke gewassen er de afgelopen jaren volgens het BRP stonden. Op een kleiner scherm kijk je met **Meer jaren tonen** verder terug. Rustgewassen krijgen een label. Met **Kopieer naar klembord** plak je de historie zo in een spreadsheet.
- **Textuur**: het geschatte aandeel klei, silt en zand.
- **Grondwater**: de grondwatertrap en de gemiddeld hoogste en laagste grondwaterstand.
- **Koolstofvastlegging**: hoeveel koolstof de bodem nu bevat, hoeveel er maximaal in zou kunnen, en wat dat zou opleveren aan waterberging en stikstoflevering.

Deze gegevens zijn schattingen van NMI op basis van landelijke bestanden, geen metingen op het perceel zelf.

## Bodemkaart en Hoogtekaart {#bodemkaart-hoogtekaart}

Op de **Bodemkaart** klik je op een vlak om te zien welke bodem daar ligt, met de bodemcode en een korte beschrijving. Deze kaart werkt het best met de satellietondergrond.

De **Hoogtekaart** laat met kleuren zien waar het hoger en lager ligt. De kleurschaal past zich aan het stuk kaart aan dat je bekijkt, zodat je ook kleine hoogteverschillen binnen een perceel ziet. Beweeg met je muis over de kaart om de precieze hoogte te zien. Zoom ver genoeg in voor het meeste detail.

![De Hoogtekaart rond de percelen van het demobedrijf](screenshot:atlas-hoogtekaart)

## Bodemanalyses op de kaart {#bodemanalyses-op-de-kaart}

Kies een parameter, bijvoorbeeld organische stof, pH of P-Al. Je percelen kleuren dan van laag naar hoog. Zo zie je in één oogopslag welke percelen achterblijven. Percelen zonder analyse staan als **Geen data** in de legenda. Klik op een perceel en daarna op **Bekijk analyse** om de analyse zelf te openen.

![De bodemanalyses op de kaart, per zone gekleurd naar het organischestofgehalte](screenshot:atlas-bodemanalyses)

## Indicatoren op de kaart {#indicatoren-op-de-kaart}

Kies een score, zoals de gemiddelde score of de chemische, fysische of biologische bodemkwaliteit. Je percelen kleuren naar hun score. Via **Meer details** spring je naar de indicatorpagina van dat perceel (zie [Bodemkwaliteit](/manual/bodemkwaliteit)).
