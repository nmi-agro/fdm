---
title: Koppelen met de API
description: Koppel je eigen software of dashboard aan {{appName}} met een API-sleutel, en vind de documentatie, rechten en limieten van de API.
section: Samenwerken en account
order: 3
inApp:
  - Account
  - API-sleutels
routes:
  - user.settings.api-keys.tsx
watch:
  - fdm-api/src/app.ts
  - fdm-api/src/auth.ts
  - fdm-api/src/rate-limit.ts
  - fdm-api/src/limits.ts
  - fdm-api/src/routes/**
keywords:
  - API
  - API-sleutel
  - koppeling
  - REST API
  - integratie
related:
  - account
  - samenwerken
  - ai-assistenten
---

Met de API van {{appName}} koppel je je eigen software aan je bedrijfsgegevens: een eigen dashboard, een adviessysteem of een koppeling met een ander pakket. Dit hoofdstuk is bedoeld voor technische gebruikers en ontwikkelaars. Gebruik je alleen de app, dan heb je de API niet nodig.

## Wat kun je met de API? {#mogelijkheden}

De API geeft je dezelfde gegevens en berekeningen als de app:

- bedrijven en percelen (met perceelsgrenzen), gewassen en oogsten;
- meststoffen, bemestingen en maatregelen;
- bodemanalyses, ook het uploaden en uitlezen van PDF-rapporten;
- bedrijfsinstellingen zoals biologische certificering, derogatie en beweiding;
- berekeningen zoals de stikstofbalans, de organische-stofbalans, de gebruiksruimte en het bemestingsadvies;
- het bemestingsplan als PDF.

## Een API-sleutel maken {#api-sleutels}

1. Klik op je naam onderaan de zijbalk, kies **Account** en ga naar **API-sleutels**.
2. Klik op **Nieuwe sleutel**.
3. Geef de sleutel bij **Naam** een herkenbare naam, bijvoorbeeld de naam van je dashboard, en klik op **Aanmaken**.
4. Klik op **Kopiëren** en bewaar de sleutel op een veilige plek. Je ziet hem maar één keer; daarna is hij niet meer op te vragen.

![De pagina API-sleutels in het account](screenshot:api-sleutels)

Behandel een sleutel als een wachtwoord: deel hem niet en zet hem niet in code die anderen kunnen zien. Gebruik je een sleutel niet meer, of vertrouw je het niet? Klik dan op **Sleutel intrekken** en bevestig met **Intrekken**. Koppelingen die die sleutel gebruiken, werken daarna direct niet meer.

## Inloggen met je sleutel {#authenticatie}

Stuur de sleutel mee in de header van elk verzoek, op een van deze twee manieren:

- `X-API-Key: fdm_…`
- `Authorization: Bearer fdm_…`

Gebruik er maar één tegelijk. Een sleutel heeft dezelfde rechten als jij: je ziet en wijzigt via de API precies de bedrijven die je ook in de app ziet en mag wijzigen. Een sleutel die alleen mag lezen bestaat (nog) niet. Wil je een koppeling beperken, maak dan een apart account met alleen de rol **Onderzoeker** voor de bedrijven die nodig zijn (zie [Samenwerken](/manual/samenwerken#rollen)).

## Limieten {#limieten}

Per sleutel geldt een maximaal aantal verzoeken per minuut:

| Soort verzoek                                              | Per minuut |
| ---------------------------------------------------------- | ---------- |
| Gegevens opvragen                                          | 120        |
| Gegevens wijzigen                                          | 120        |
| Berekeningen, zoals balansen en gebruiksruimte             | 10         |
| Diensten van NMI, zoals bodemschattingen en PDF's uitlezen | 10         |

Kom je boven een limiet, dan krijg je een foutmelding en probeer je het even later opnieuw.

Om misbruik te voorkomen gelden via de API ook deze grenzen:

- Een bedrijf kan via de API maximaal 500 percelen hebben. Bij een groter bedrijf werken overzichten en berekeningen van het hele bedrijf niet via de API. Gegevens van een los perceel kun je wel opvragen.
- Je kunt via de API maximaal 10 nieuwe bedrijven per 24 uur aanmaken, met al je sleutels samen.

In {{appName}} zelf gelden deze grenzen niet.

## Documentatie {#documentatie}

- [De API-documentatie]({{apiDocsUrl}}) beschrijft alle verzoeken en velden, en je kunt er verzoeken uitproberen. Je komt er ook via **API-documentatie** op de pagina **API-sleutels**.
- De [handleiding voor ontwikkelaars](https://nmi-agro.github.io/fdm/docs/rest-api/overview) legt uit hoe inloggen, rechten, paginering en foutmeldingen werken. Die is in het Engels.

{{appName}} is gebouwd op het open-source Farm Data Model ([nmi-agro/fdm](https://github.com/nmi-agro/fdm)). Vragen over de API stel je via **Ondersteuning**.
