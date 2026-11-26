---
title: Mineralisatie
description: Wat stikstofmineralisatie is, hoeveel stikstof je bodem zelf levert en hoe de vaste waarden, het MINIP-model en het Dyna-model dit berekenen.
section: Bodem
order: 1
inApp:
  - Labs
  - Mineralisatie
lastReviewed: 2026-11-05
routes: []
watch:
  - fdm-calculator/src/mineralization/**
  - fdm-calculator/src/shared/minip.ts
  - fdm-calculator/src/other/nlv-supply.ts
  - fdm-calculator/src/balance/nitrogen/supply/mineralization.ts
keywords:
  - stikstofmineralisatie berekenen
  - stikstofleverend vermogen
  - NLV
  - bodem stikstoflevering
  - Dyna stikstofmodel
related:
  - labs
  - background/stikstofbalans
  - background/bodemanalyse
  - balansen
---

Mineralisatie is het proces waarbij het bodemleven organische stof afbreekt en de stikstof daaruit vrijkomt als ammonium en nitraat, die het gewas kan opnemen. Op veel percelen dekt die levering een flink deel van wat het gewas nodig heeft. Als je weet hoeveel je bodem zelf levert, kun je je bemesting daarop afstemmen en voorkom je dat stikstof ongebruikt uitspoelt.

## Wat bepaalt de mineralisatie? {#wat-bepaalt-het}

Hoeveel stikstof vrijkomt, hangt vooral af van:

- de hoeveelheid organische stof in de bodem en hoe makkelijk die afbreekt;
- de C/N-ratio: hoe lager, hoe meer stikstof er per kilo afgebroken koolstof vrijkomt;
- temperatuur en vocht: in een warme, vochtige periode gaat het sneller dan in de winter;
- recente aanvoer van organisch materiaal, zoals mest, gewasresten en een gescheurde graszode.

Mineralisatie is moeilijk precies te meten. Elke berekening is daarom een schatting met een modelaanpak. {{appName}} gebruikt drie aanpakken, elk voor een ander doel.

## Vaste waarden in de stikstofbalans {#vaste-waarden}

De standaard [stikstofbalans](/manual/background/stikstofbalans) rekent met een vaste jaarwaarde per grondsoort en landgebruik:

| Grondsoort      | Landgebruik          | Mineralisatie (kg N/ha per jaar) |
| --------------- | -------------------- | -------------------------------- |
| Veen            | Grasland             | 160                              |
| Veen            | Bouwland             | 20                               |
| Dalgrond        | Grasland of bouwland | 20                               |
| Overige gronden | Grasland of bouwland | 0                                |

Op klei, löss en de meeste zandgronden telt de balans dus geen mineralisatie als aanvoer. Dat betekent niet dat daar geen stikstof vrijkomt; het is een vereenvoudiging. Wil je de levering uit je eigen bodem zien, gebruik dan de balans met werkzame stikstof of Dyna.

## Het MINIP-model {#minip}

MINIP is een rekenmodel dat de afbraak van organische stof beschrijft op basis van de hoeveelheid koolstof in de bodem, de C/N-ratio, de ouderdom van de organische stof en de temperatuur. Hoe ouder de organische stof, hoe langzamer de afbraak. {{appName}} gebruikt MINIP op twee plekken.

### In de balans met werkzame stikstof {#minip-balans}

Kies je in de stikstofbalans voor werkzame stikstof, dan wordt de mineralisatie per perceel met MINIP berekend uit organische koolstof, de C/N-ratio en de dichtheid uit je bodemanalyse. Het model rekent voor de bovenste 20 cm, over tien jaar bij een gemiddelde temperatuur van 10,6 °C, en gebruikt het gemiddelde per jaar.

### Het stikstofleverend vermogen (NLV) {#nlv}

Het stikstofleverend vermogen is de stikstof die de bodem in het groeiseizoen levert. Staat er geen gemeten NLV in je bodemanalyse, dan berekent {{appName}} het uit organische stof, klei en de C/N-ratio. Het rekent daarbij voor de bovenste 30 cm, over een groeiseizoen van vijf maanden bij 14,1 °C. Bij je bodemgegevens staat de waarde dan als berekend.

## Het Dyna-model in Labs {#dyna}

Onder Labs vind je de pagina Mineralisatie. Die gebruikt Dyna, een model van NMI dat dag voor dag de stikstof in een perceel volgt: wat er vrijkomt uit bodem, meststoffen, gewasresten en groenbemesters, wat het gewas opneemt en wat er als nitraat uitspoelt. Dyna rekent met het gemeten weer tot vandaag, de weersverwachting voor de komende dagen en langjarige klimaatgegevens daarna.

### Welke gegevens gebruikt Dyna? {#dyna-invoer}

- De locatie van het perceel.
- Het hoofdgewas en de gewassen die daarna komen, zoals groenbemesters en vanggewassen, met zaai- en einddatum.
- Een gemeten of geplande oogst van het hoofdgewas, met opbrengst en stikstofgehalte. Zonder oogst kan Dyna niet rekenen, behalve bij gewassen die niet worden geoogst.
- De bemestingen in het jaar, met hoeveelheid, datum, toedieningsmethode en samenstelling van de meststof.
- Bodemgegevens: organische stof, klei, silt, totaal stikstof, pH, bodemtype, de grondwaterstanden (GHG en GLG) en, als je die hebt, Nmin in 0 tot 30 en 30 tot 60 cm. Ontbreekt er een waarde, dan schat het model die zelf.

### Wat laat Dyna zien? {#dyna-uitkomst}

Per dag zie je de opgetelde hoeveelheid vrijgekomen stikstof, de opname door het gewas en de uitspoeling. Het verschil tussen vrijgekomen stikstof en opname is de stikstof die op dat moment nog beschikbaar is. Daarnaast toont {{appName}} signalen, zoals een verwacht tekort, veel regen rond een geplande bemesting of oogst, veel uitspoeling of veel stikstof die bij de oogst achterblijft. De drempels voor deze signalen zijn voorlopig: ongeveer 20 kg N/ha beschikbaar als grens voor een tekort, 30 kg N/ha voor veel uitspoeling, 50 kg N/ha bij de oogst als overschot en 10 mm regen binnen twee dagen rond een bemesting of oogst. Ze moeten nog agronomisch worden gevalideerd.

## Hoe lees je de uitkomst? {#uitkomst-lezen}

De drie aanpakken geven verschillende getallen, omdat ze iets anders beschrijven. De vaste waarden in de balans zijn een eenvoudige standaard per grondsoort en landgebruik. MINIP geeft een schatting van de jaarlijkse levering uit je eigen bodemanalyse. Dyna laat het verloop binnen een seizoen zien en is vooral bedoeld om je bemesting te plannen en bij te sturen. Gebruik de getallen als richting, niet als exacte voorspelling.

## Beperkingen {#beperkingen}

- Alle aanpakken zijn modellen. Het werkelijke weer, grondbewerking, structuur en bodemleven kunnen de mineralisatie flink beïnvloeden.
- MINIP en Dyna zijn zo goed als je bodemgegevens. Geschatte waarden maken de uitkomst minder zeker.
- Mineralisatie in Labs is nog in ontwikkeling. Berekeningen en signalen kunnen nog veranderen.

## Wat kun je doen? {#wat-kun-je-doen}

- Voeg een bodemanalyse toe met organische stof, totaal stikstof en de C/N-ratio, zodat MINIP met je eigen gegevens rekent.
- Laat Nmin meten voor of in het begin van het seizoen; dat helpt Dyna en het [bemestingsadvies](/manual/background/bemestingsadvies).
- Vul geplande oogstdata en bemestingen in, zodat Dyna het seizoen goed kan doorrekenen.
- Houd rekening met extra mineralisatie na het scheuren van grasland of het onderwerken van een groenbemester.

Hoe je Mineralisatie in {{appName}} gebruikt, lees je in [Labs](/manual/labs#mineralisatie).
