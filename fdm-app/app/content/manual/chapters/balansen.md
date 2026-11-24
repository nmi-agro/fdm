---
title: Balansen
description: Bekijk de stikstof-, organische-stof- en fosfaatbalans van je bedrijf en per perceel, en zie welke gegevens ervoor nodig zijn.
section: Resultaten
order: 1
updated: 2026-11-24
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
  - lachgasemissie
  - fosfaatbalans
  - fosfaattoestand
  - P-AL
  - fosfaatverzadiging
related:
  - background/stikstofbalans
  - background/organische-stofbalans
  - background/fosfaatbalans
  - bodem
---

De balansen laten zien wat er op je bedrijf binnenkomt en weer afgaat. {{appName}} heeft er drie: voor stikstof, voor organische stof en voor fosfaat. Je vindt ze onder **Balans** in de zijbalk, voor het hele bedrijf en per perceel.

## Stikstofbalans {#stikstofbalans}

De stikstofbalans zet de aanvoer af tegen de afvoer en de emissie, in kg N per hectare.

![De stikstofbalans van een bedrijf, met aanvoer, afvoer en emissie](screenshot:balans-stikstof)

| Post    | Wat valt eronder?                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Aanvoer | Kunstmest, dierlijke mest, compost, overige meststoffen, binding door vlinderbloemigen (fixatie), depositie uit de lucht en mineralisatie uit de bodem |
| Afvoer  | Wat je oogst en wat je aan gewasresten afvoert                                                                                                         |
| Emissie | Ammoniakemissie uit mest en gewasresten, lachgasemissie en nitraatuitspoeling. De nitraatuitspoeling telt niet mee in de balans                        |

Bovenaan zie je het overschot naast een doel. Dat doel hangt af van je landgebruik (grasland of bouwland), je grondsoort en je grondwatertrap. Ligt je overschot onder het doel, dan zit je goed. Ligt het erboven, dan is er een risico op verliezen naar het milieu. Daarnaast toont {{appName}} de **Nitraatuitspoeling** en de **Lachgasemissie** in kg N per hectare, bij lachgas met het CO₂-equivalent eronder. Beide tellen mee in de totale emissie. De lachgasemissie telt ook mee in de balans, de nitraatuitspoeling niet: die wordt uit het overschot berekend.

Onder **Percelen** zie je per perceel de balans tegenover het doel, zodat je snel ziet welke percelen eruit springen. Op de pagina van een perceel klap je onder **Posten** elke post open, tot op de afzonderlijke bemesting of oogst. Zo zie je precies waar een overschot vandaan komt.

Hoe de posten en het doel worden bepaald, lees je in [Stikstofbalans](/manual/background/stikstofbalans).

## Organische-stofbalans {#organische-stofbalans}

De organische-stofbalans laat zien of het organischestofgehalte van je bodem op peil blijft. De aanvoer komt uit bemesting (mest, compost), gewassen en gewasresten. Daar staat de afbraak in de bodem tegenover. Is de balans positief, dan bouw je organische stof op; is hij negatief, dan neemt het gehalte af.

![De organische-stofbalans van een bedrijf](screenshot:balans-organische-stof)

Meer over de berekening lees je in [Organische-stofbalans](/manual/background/organische-stofbalans).

## Fosfaatbalans {#fosfaatbalans}

De fosfaatbalans is **Experimenteel**: de rekenregels en grenswaarden worden nog met onderzoekers afgestemd. Gebruik de uitkomsten als richting, niet als vaststaand advies.

![De fosfaatbalans van een bedrijf, met de fosfaattoestand van de percelen](screenshot:balans-fosfaat)

De balans zet de aanvoer af tegen de afvoer, in kg P₂O₅ per hectare:

| Post    | Wat valt eronder?                                                                                |
| ------- | ------------------------------------------------------------------------------------------------ |
| Aanvoer | Kunstmest, dierlijke mest, compost, overige meststoffen, mineralisatie uit de bodem en depositie |
| Afvoer  | Wat je oogst en wat je aan gewasresten afvoert                                                   |

Daarnaast schat {{appName}} de uitspoeling van fosfaat uit het overschot. Die telt, net als de nitraatuitspoeling bij stikstof, niet mee in de balans. De berekening van fosfaatverliezen is een eerste benadering en wordt nog verder ontwikkeld.

Eén jaar zegt weinig over de bodem: in het ene jaar bemest je meer, in het andere minder. Daarom kijkt {{appName}} voor de trend naar de gemiddelde balans over het gekozen jaar en de vier jaren ervoor. Een eerder jaar zonder geregistreerde bemesting en zonder geregistreerde oogst telt niet mee. Telt geen enkel eerder jaar mee, dan gebruikt de trend alleen de balans van het gekozen jaar. Staat er voor een eerder jaar geen gewas in {{appName}}, dan wordt het gewas uit het BRP gebruikt, en als dat er ook niet is het hoofdgewas van het gekozen jaar. Ontbreken voor eerdere jaren de gewassen of de bemesting, dan is de balans op lange termijn alleen indicatief; de app zegt dat erbij. Vul de bemesting en oogsten van eerdere jaren aan voor een betrouwbaardere trend.

### Fosfaattoestand van de bodem {#fosfaattoestand}

De balans krijgt pas betekenis naast de bodem. Per perceel zie je onder **Bodemvoorraad (P-AL)** hoeveel fosfaat er voor het gewas beschikbaar is, en onder **Fosfaatverzadiging (PSD)** hoe vol de bodem al zit ten opzichte van de milieugrens. Daaruit volgt het doel van het perceel:

- **Opbouwen**: P-AL ligt onder 35 en de PSD onder de milieugrens. Er is meer fosfaat nodig voor een goede opbrengst.
- Onderhouden: P-AL ligt tussen 35 en 45 en de PSD onder de milieugrens. De voorraad mag zo blijven.
- **Afbouwen**: de PSD ligt boven de milieugrens (of, zonder PSD, P-AL boven 45). Het milieu gaat dan voor.

Ligt P-AL onder 35 terwijl de PSD boven de milieugrens zit, dan vragen opbrengst en milieu een andere richting. {{appName}} kiest dan geen doel, maar laat zien wat de balans met beide doet: een hogere balans helpt P-AL en laat de PSD verder stijgen, een lagere balans doet het omgekeerde.

Bij **Fosfaattoestand** zie je welke kant het perceel op gaat bij de gemiddelde balans en hoe lang het duurt voordat het doel bereikt is. Het oordeel is **Goed**, **Aandacht**, **Bijsturen** of **Onbekend**. Onder **Mogelijke aanpak** staat welke balans nodig is om bij te sturen. Zijn de bodemgegevens geschat of is de fosfaatverzadiging voor jouw grondsoort minder betrouwbaar, dan staat er bij het oordeel dat het indicatief is.

Op de bedrijfspagina zie je bij **Fosfaattoestand van de percelen** hoeveel hectare elk oordeel heeft, en onder **Percelen** de percelen met hun doel en oordeel. Bufferstroken, natuur en landschapselementen tellen niet mee; die staan apart onder "Niet meegenomen".

Hoe de balans, de fosfaattoestand en het oordeel worden bepaald, lees je in [Fosfaatbalans](/manual/background/fosfaatbalans).

## Wat heb je nodig? {#benodigde-gegevens}

Voor een goede balans heeft {{appName}} per perceel nodig:

- een bodemanalyse met totaal stikstof, bodemtype en organische stof, en voor de fosfaatbalans P-AL en liefst ook P-ox, Fe-ox, Al-ox of de fosfaatverzadiging;
- de gewassen met zaai- en oogstdata;
- de oogsten met opbrengst;
- de bemestingen, voor de fosfaatbalans ook die van de vier jaren ervoor.

Ontbreekt er iets, dan zegt de app dat. Bufferstroken tellen niet mee in de balans.

## Voor organisaties {#organisaties}

Werk je in een organisatie, bijvoorbeeld als adviesbureau of beleidsmaker? Dan kun je de balansen ook bekijken over alle bedrijven van de organisatie samen. Met **Wijzig selectie** kies je welke bedrijven meetellen. Je ziet per bedrijf hoe het afwijkt van het gemiddelde.
