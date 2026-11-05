---
title: BLN3-bodemkwaliteit
description: Wat BLN3 is, welke thema's en indicatoren de bodemkwaliteit beschrijven, welke gegevens meetellen en hoe je de scores van 0 tot 100 leest.
section: Bodem
order: 3
inApp:
  - Indicatoren
lastReviewed: 2026-11-05
routes: []
watch:
  - fdm-calculator/src/bln3/**
keywords:
  - BLN3 bodemkwaliteit
  - bodemindicatoren landbouwgronden
  - bodemkwaliteit meten
  - Open Bodem Index
  - bodemmaatregelen
related:
  - bodemkwaliteit
  - background/bodemanalyse
  - background/organische-stofbalans
  - bodem
---

BLN3 staat voor Bodemindicatoren voor Landbouwgronden in Nederland, versie 3. Het is een systeem om de kwaliteit van een landbouwbodem te beoordelen met 27 indicatoren, die samen laten zien hoe goed je bodem functioneert voor productie, water, klimaat en de nutriëntenkringloop. Zo zie je niet alleen of je bodem vruchtbaar is, maar ook waar je met maatregelen de meeste winst kunt halen.

## Wat meet BLN3? {#wat-is-het}

De indicatoren zijn gegroepeerd in thema's, die weer samenkomen in een totaalscore:

| Thema                         | Waar gaat het over?                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| Productie (Open Bodem Index)  | De bodem als basis voor gewasproductie, verdeeld in chemische, fysische en biologische bodemkwaliteit |
| Water                         | Infiltratie en grondwateraanvulling, uitspoeling naar grondwater en afspoeling naar oppervlaktewater  |
| Nutriëntenkringloop           | Hoe goed de bodem stikstof, fosfaat en kalium vasthoudt en benut                                      |
| Klimaat                       | Het vermogen van de bodem om koolstof vast te leggen                                                  |
| BedrijfsBodemWaterPlan (BBWP) | Een aparte index, gericht op beleidsdoelen voor bodem en water                                        |

Elke indicator en elk thema krijgt een score van 0 tot 100.

## Welke gegevens tellen mee? {#invoer}

- De locatie van het perceel.
- Het bodemtype en de grondwatertrap.
- Bodemwaarden uit je analyses, waaronder organische stof, de C/N-ratio, totaal stikstof, P-Al, P-plantbeschikbaar, het Pw-getal, kalium, magnesium, calcium, zwavel, pH, CEC en de verdeling over klei, silt en zand. Per parameter telt de meest recente labwaarde tot en met het gekozen jaar. Alleen als er geen labwaarde is, wordt een schatting van NMI BodemSchat gebruikt.
- De BodemConditieScore, als je die hebt ingevuld: beoordelingen van onder meer bodemstructuur, beworteling, regenwormen, verdichting en plasvorming.
- De volledige teeltgeschiedenis van het perceel, over alle jaren die bekend zijn.
- De maatregelen die je hebt vastgelegd en die in het gekozen jaar lopen.

## Hoe wordt het berekend? {#berekening}

De BLN3-berekening zelf gebeurt bij een rekendienst van NMI. {{appName}} verzamelt per perceel de gegevens hierboven, stuurt ze naar die dienst en krijgt de scores per indicator en per thema terug, elk tussen 0 en 1. {{appName}} toont die scores op een schaal van 0 tot 100.

Op bedrijfsniveau is elke score het oppervlaktegewogen gemiddelde van de percelen. Een groot perceel weegt dus zwaarder dan een klein perceel. Percelen zonder oppervlakte of zonder score voor een indicator tellen voor die indicator niet mee.

### Maatregelen {#maatregelen}

Voor elk perceel bepaalt een tweede berekening welke maatregelen toepasbaar zijn en welk effect ze naar verwachting hebben. Daarvoor gebruikt de dienst ook gegevens over grondwaterstanden, drainage, de toedieningsmethode van je mest en het potentiële organischestofgehalte. Alleen maatregelen die op het perceel toepasbaar zijn en nog niet lopen, worden aanbevolen. De verwachte impact is een relatieve maat van 0 tot 1 ten opzichte van andere maatregelen, geen score.

Met de schakelaar met of zonder maatregelen zie je hoe de scores zouden veranderen als je de aanbevolen maatregelen neemt.

## Hoe lees je de uitkomst? {#uitkomst-lezen}

| Score       | Betekenis                |
| ----------- | ------------------------ |
| 70 of hoger | Goed tot uitstekend      |
| 40 tot 70   | Matig, aandacht gewenst  |
| Onder 40    | Onvoldoende, actie nodig |

Kijk eerst naar de thema's met de laagste score en daarna naar de indicatoren daaronder. Een lage score betekent niet altijd dat je iets fout doet: sommige indicatoren hangen vooral af van eigenschappen die je niet of nauwelijks kunt veranderen, zoals de grondsoort of de grondwaterstand. Op bedrijfsniveau zie je ook welke percelen het meest bijdragen aan een lage score.

## Beperkingen {#beperkingen}

- BLN3 is nog in ontwikkeling. De scores, de indicatoren en de lijst met maatregelen zijn nog niet definitief en kunnen veranderen.
- De berekening van de impact van maatregelen is experimenteel.
- Bufferstroken en percelen met een natuur- of niet-landbouwkundig hoofdgewas, zoals sloten en natuurterreinen, krijgen geen score. BLN3 is ontworpen voor productieve landbouwgrond.
- Geschatte bodemwaarden maken de scores minder zeker dan gemeten waarden.
- Als de rekendienst niet bereikbaar is, kunnen er geen scores worden berekend.

## Wat kun je doen? {#wat-kun-je-doen}

- Voeg een volledige labanalyse toe, met in elk geval organische stof, de C/N-ratio, fosfaat, kalium, pH en textuur.
- Vul de BodemConditieScore in. Die voegt veldwaarnemingen toe die een labanalyse niet geeft, zoals structuur en regenwormen.
- Zorg dat je bouwplan over meerdere jaren compleet is; de teeltgeschiedenis telt mee.
- Leg de maatregelen vast die je al neemt, zodat ze meetellen in de scores.
- Werk aan organische stof: dat werkt door in meerdere thema's. Zie [Organische-stofbalans](/manual/background/organische-stofbalans).

Hoe je de BLN3-scores en maatregelen in {{appName}} bekijkt, lees je in [Bodemkwaliteit](/manual/bodemkwaliteit).
