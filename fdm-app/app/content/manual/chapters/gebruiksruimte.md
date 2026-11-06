---
title: Gebruiksruimte
description: Zie hoeveel stikstof en fosfaat je volgens de mestregels mag gebruiken, hoeveel je al hebt gebruikt en waar de normen van afhangen.
section: Resultaten
order: 2
inApp:
  - Gebruiksruimte
routes:
  - farm.$b_id_farm.$calendar.norms*
watch:
  - fdm-app/app/components/blocks/norms/**
  - fdm-calculator/src/norms/**
keywords:
  - gebruiksnormen
  - mestruimte
  - stikstofgebruiksnorm
  - fosfaatgebruiksnorm
  - dierlijke mest
  - derogatie
related:
  - background/gebruiksruimte
  - bemesting
---

Onder **Gebruiksruimte** zie je hoeveel je volgens de mestregels mag bemesten, en hoeveel je daarvan al hebt gebruikt. Dat zie je voor het hele bedrijf en per perceel. {{appName}} rekent met de regels van 2026, en voor 2025 nog met de regels van dat jaar.

> De gebruiksnormen in {{appName}} zijn indicatief en alleen bedoeld ter informatie. Raadpleeg voor de definitieve normen en je verantwoording altijd de officiële publicaties van RVO en je adviseur.

## Welke normen? {#normen}

| Norm                        | Eenheid | Toelichting                                                             |
| --------------------------- | ------- | ----------------------------------------------------------------------- |
| Stikstof, werkzaam          | kg N    | De stikstofgebruiksnorm, afhankelijk van gewas en regio                 |
| Fosfaat                     | kg P₂O₅ | Afhankelijk van grasland of bouwland en de fosfaattoestand van je bodem |
| Stikstof uit dierlijke mest | kg N    | De norm voor dierlijke mest: 170 kg N/ha voor alle bedrijven            |
| Renure                      | kg N    | Extra ruimte voor Renure-producten: 80 kg N/ha bovenop dierlijke mest   |

![De gebruiksruimte van een bedrijf per norm](screenshot:gebruiksruimte-bedrijf)

Per norm zie je de **Ruimte** (wat je mag), de **Opvulling** (wat je al hebt gebruikt) en een balkje met het percentage. Zo zie je in één oogopslag hoeveel ruimte er nog over is.

## Waar hangt het van af? {#afhankelijkheden}

{{appName}} bepaalt de normen per perceel op basis van:

- het hoofdgewas en eventuele vanggewassen of volgteelten;
- de regio (klei, veen, löss of zand) en of het perceel in een NV-gebied, grondwaterbeschermingsgebied of Natura 2000-gebied ligt;
- de fosfaattoestand uit je bodemanalyse (P-CaCl₂ en P-Al);
- of je grasland beweidt of alleen maait.

![De gebruiksruimte van één perceel, met de onderbouwing per norm](screenshot:gebruiksruimte-perceel)

Voor 2025 telt ook mee of je bedrijf derogatie had (instelbaar onder **Instellingen** → **Derogatie**).

Op perceelniveau zie je per bemesting hoeveel die meetelt voor elke norm, inclusief de werkingscoëfficiënt die is gebruikt. Hoe de normen precies worden bepaald, lees je in [Gebruiksruimte](/manual/background/gebruiksruimte).

## Niet-ondersteunde situaties {#niet-ondersteund}

Niet elke situatie uit de regelgeving zit in {{appName}}. Onder de gebruiksruimte in de app staat bij **Niet-ondersteunde situaties** welke dat zijn, bijvoorbeeld opbrengstafhankelijke stikstofdifferentiatie, fritesaardappelen op klei en de forfaitaire bedrijfsnorm. De volledige lijst, met uitleg, vind je in [Gebruiksruimte: niet-ondersteunde situaties](/manual/background/gebruiksruimte#niet-ondersteund). Valt je bedrijf daaronder, bereken die norm dan zelf of met je adviseur.
