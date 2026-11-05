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

Onder **Gebruiksruimte** zie je hoeveel je volgens de mestregels mag bemesten, en hoeveel je daarvan al hebt gebruikt. Dat zie je voor het hele bedrijf en per perceel. {{appName}} rekent de gebruiksruimte uit voor 2025 en 2026.

## Welke normen? {#normen}

| Norm                        | Eenheid | Toelichting                                                             |
| --------------------------- | ------- | ----------------------------------------------------------------------- |
| Stikstof, werkzaam          | kg N    | De stikstofgebruiksnorm, afhankelijk van gewas en regio                 |
| Fosfaat                     | kg P₂O₅ | Afhankelijk van grasland of bouwland en de fosfaattoestand van je bodem |
| Stikstof uit dierlijke mest | kg N    | De norm voor dierlijke mest, eventueel met derogatie (tot en met 2025)  |
| Renure                      | kg N    | Extra ruimte voor Renure-producten, vanaf 2026                          |

Per norm zie je de **Ruimte** (wat je mag), de **Opvulling** (wat je al hebt gebruikt) en een balkje met het percentage. Zo zie je in één oogopslag hoeveel ruimte er nog over is.

## Waar hangt het van af? {#afhankelijkheden}

{{appName}} bepaalt de normen per perceel op basis van:

- het hoofdgewas en eventuele vanggewassen of volgteelten;
- de regio (klei, veen, löss of zand) en of het perceel in een NV-gebied, grondwaterbeschermingsgebied of Natura 2000-gebied ligt;
- de fosfaattoestand uit je bodemanalyse (P-CaCl₂ en P-Al);
- of je bedrijf derogatie had (instelbaar onder **Instellingen** → **Derogatie**).

Op perceelniveau zie je per bemesting hoeveel die meetelt voor elke norm, inclusief de werkingscoëfficiënt die is gebruikt. Hoe de normen precies worden bepaald, lees je in [Gebruiksruimte](/manual/background/gebruiksruimte).

## Goed om te weten {#goed-om-te-weten}

Niet elke situatie uit de regelgeving zit in {{appName}}. Opbrengstafhankelijke stikstofdifferentiatie, fritesteelt en de forfaitaire bedrijfsnorm worden bijvoorbeeld (nog) niet ondersteund. De app laat op de pagina zien welke situaties niet worden meegenomen.

> De gebruiksruimte in {{appName}} is indicatief. Voor je officiële verantwoording gelden altijd de regels en publicaties van RVO; overleg bij twijfel met je adviseur.
