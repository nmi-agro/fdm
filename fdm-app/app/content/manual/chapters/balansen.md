---
title: Balansen
description: Bekijk de stikstofbalans en de organische-stofbalans van je bedrijf en per perceel, en zie welke gegevens ervoor nodig zijn.
section: Resultaten
order: 1
inApp:
  - Balans
  - Stikstof
routes:
  - farm.$b_id_farm.$calendar.balance*
  - organization.$slug.$calendar.balance*
watch:
  - fdm-app/app/components/blocks/balance/**
  - fdm-calculator/src/balance/**
keywords:
  - stikstofbalans
  - organische stof
  - stikstofoverschot
  - doelsturing
  - nitraatuitspoeling
related:
  - background/stikstofbalans
  - background/organische-stofbalans
  - bodem
---

De balansen laten zien wat er op je bedrijf binnenkomt en weer afgaat. {{appName}} heeft er twee: voor stikstof en voor organische stof. Je vindt ze onder **Balans** in de zijbalk, voor het hele bedrijf en per perceel.

## Stikstofbalans {#stikstofbalans}

De stikstofbalans zet de aanvoer af tegen de afvoer en de emissie, in kg N per hectare.

![De stikstofbalans van een bedrijf, met aanvoer, afvoer en emissie](screenshot:balans-stikstof)

| Post    | Wat valt eronder?                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Aanvoer | Kunstmest, dierlijke mest, compost, overige meststoffen, binding door vlinderbloemigen (fixatie), depositie uit de lucht en mineralisatie uit de bodem |
| Afvoer  | Wat je oogst en wat je aan gewasresten afvoert                                                                                                         |
| Emissie | Ammoniakemissie uit mest en gewasresten                                                                                                                |

Bovenaan zie je het overschot naast een doel. Dat doel hangt af van je landgebruik (grasland of bouwland), je grondsoort en je grondwatertrap. Ligt je overschot onder het doel, dan zit je goed. Ligt het erboven, dan is er een risico op verliezen naar het milieu. Daarnaast toont {{appName}} de verwachte nitraatuitspoeling.

Onder **Percelen** zie je per perceel de balans tegenover het doel, zodat je snel ziet welke percelen eruit springen. Op de pagina van een perceel klap je onder **Posten** elke post open, tot op de afzonderlijke bemesting of oogst. Zo zie je precies waar een overschot vandaan komt.

Hoe de posten en het doel worden bepaald, lees je in [Stikstofbalans](/manual/background/stikstofbalans).

## Organische-stofbalans {#organische-stofbalans}

De organische-stofbalans laat zien of het organischestofgehalte van je bodem op peil blijft. De aanvoer komt uit bemesting (mest, compost), gewassen en gewasresten. Daar staat de afbraak in de bodem tegenover. Is de balans positief, dan bouw je organische stof op; is hij negatief, dan neemt het gehalte af.

![De organische-stofbalans van een bedrijf](screenshot:balans-organische-stof)

Meer over de berekening lees je in [Organische-stofbalans](/manual/background/organische-stofbalans).

## Wat heb je nodig? {#benodigde-gegevens}

Voor een goede balans heeft {{appName}} per perceel nodig:

- een bodemanalyse met totaal stikstof, bodemtype en organische stof;
- de gewassen met zaai- en oogstdata;
- de oogsten met opbrengst;
- de bemestingen.

Ontbreekt er iets, dan zegt de app dat. Bufferstroken tellen niet mee in de balans.

## Voor organisaties {#organisaties}

Werk je in een organisatie, bijvoorbeeld als adviesbureau of beleidsmaker? Dan kun je de balansen ook bekijken over alle bedrijven van de organisatie samen. Met **Wijzig selectie** kies je welke bedrijven meetellen. Je ziet per bedrijf hoe het afwijkt van het gemiddelde.
