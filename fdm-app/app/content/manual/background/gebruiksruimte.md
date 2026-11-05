---
title: Gebruiksruimte
description: Hoe de gebruiksnormen voor stikstof, fosfaat, dierlijke mest en Renure per perceel worden bepaald en hoe je bemesting meetelt in de opvulling.
section: Normen en advies
order: 1
inApp:
  - Gebruiksruimte
lastReviewed: 2026-11-05
routes: []
watch:
  - fdm-calculator/src/norms/**
keywords:
  - gebruiksruimte berekenen
  - gebruiksnormen 2026
  - fosfaatgebruiksnorm
  - stikstofgebruiksnorm
  - werkingscoëfficiënt
  - Renure
related:
  - gebruiksruimte
  - background/bemestingsadvies
  - background/bodemanalyse
  - bemesting
---

De gebruiksruimte is hoeveel stikstof en fosfaat je volgens de Meststoffenwet op je bedrijf mag gebruiken. Ze is de optelsom van gebruiksnormen per perceel, die afhangen van het gewas, de ligging en de bodem. Als je de gebruiksruimte kent, kun je je bemesting zo plannen dat je binnen de regels blijft en de ruimte goed benut. {{appName}} rekent de gebruiksruimte uit voor 2025 en 2026.

## Welke normen zijn er? {#normen}

| Norm                     | Eenheid          | Waar hangt hij van af?                                  |
| ------------------------ | ---------------- | ------------------------------------------------------- |
| Stikstofgebruiksnorm     | kg werkzame N/ha | Gewas, grondsoortregio, NV-gebied en kortingen          |
| Fosfaatgebruiksnorm      | kg P₂O₅/ha       | Grasland of bouwland en de fosfaattoestand van de bodem |
| Dierlijke-mestnorm       | kg N/ha          | In 2025 derogatie en ligging; in 2026 voor iedereen 170 |
| Renure-norm (vanaf 2026) | kg N/ha          | Vast: 80                                                |

Een bufferstrook krijgt voor alle normen 0. De ruimte voor het bedrijf is per norm de som van norm × oppervlakte over alle percelen. De wettelijke toets gebeurt op bedrijfsniveau: een perceel mag dus meer krijgen dan zijn eigen norm, zolang het bedrijf als geheel binnen de ruimte blijft.

## Welke gegevens tellen mee? {#invoer}

- Het hoofdgewas: het gewas dat tussen 15 mei en 15 juli het langst op het perceel staat. Staat er in die periode niets, dan geldt groene braak.
- Volgteelten en groenbemesters na de hoofdteelt, en voor tijdelijk grasland de zaai- en einddatum.
- Voor aardappelen en bloemen soms het ras, en voor sommige bladgewassen en kruiden het aantal oogsten.
- De ligging van het perceel: de grondsoortregio (klei, veen, löss, zand) en of het in een NV-gebied, grondwaterbeschermingsgebied of Natura 2000-gebied ligt.
- De fosfaattoestand uit je meest recente bodemanalyse: P-plantbeschikbaar (P-CaCl₂) en P-Al.
- De gewassen van het vorige jaar, voor de regels over vanggewassen.
- Of je grasland beweidt of alleen maait, en voor 2025 of je bedrijf derogatie had.

## Hoe wordt het berekend? {#berekening}

### Stikstof {#stikstof}

Elk gewas krijgt de norm uit de RVO-tabel voor zijn grondsoortregio. In een NV-gebied is de norm voor veel gewassen lager. Staan er meerdere gewassen in een jaar op het perceel, zoals een volgteelt of een groenbemester die aan de voorwaarden voldoet, dan worden de normen opgeteld. Daarna gaan de kortingen eraf. In 2026 gelden ze alleen op zand- en lössgrond; in 2025 golden de graslandkortingen voor derogatiebedrijven ook op klei en veen.

- Vanggewas te laat gezaaid na de hoofdteelt van vorig jaar: 5 kg N/ha (2 tot en met 14 oktober), 10 kg N/ha (15 tot en met 31 oktober) of 20 kg N/ha (vanaf 1 november, geen vanggewas, of vernietigd vóór 1 februari). Een wintergewas kan dit voorkomen.
- Grasland vernieuwd tussen 1 juni en 31 augustus: 50 kg N/ha.
- Grasland gescheurd voor maïs of consumptie- of fabrieksaardappelen tussen 1 februari en 10 mei: 65 kg N/ha.

Kortingen tellen bij elkaar op; de norm wordt nooit lager dan 0.

### Fosfaat {#fosfaat}

Op basis van P-CaCl₂ en P-Al krijgt de bodem een fosfaatklasse. Die bepaalt de norm:

| Klasse   | Grasland (kg P₂O₅/ha) | Bouwland (kg P₂O₅/ha) |
| -------- | --------------------- | --------------------- |
| Arm      | 120                   | 120                   |
| Laag     | 105                   | 80                    |
| Neutraal | 95                    | 70                    |
| Ruim     | 90                    | 60                    |
| Hoog     | 75                    | 40                    |

### Dierlijke mest en Renure {#dierlijke-mest}

In 2025 was de norm 170 kg N/ha zonder derogatie. Met derogatie was hij 200 kg N/ha, 190 kg N/ha in een NV-gebied, en 170 kg N/ha in of nabij Natura 2000, in een grondwaterbeschermingsgebied of in een derogatievrije zone. Vanaf 2026 is derogatie afgelopen en geldt overal 170 kg N/ha.

Vanaf 2026 heeft Renure (stikstof teruggewonnen uit mest, mestcodes 130 tot en met 134) een eigen plafond van 80 kg N/ha bovenop de 170. Renure telt wel volledig mee voor de stikstof- en fosfaatnorm. Wat boven de 80 kg uitkomt, telt mee voor de dierlijke-mestnorm.

## Hoe telt je bemesting mee? {#opvulling}

De opvulling is wat je bemesting van de ruimte gebruikt. Per norm werkt dat anders:

- Stikstofnorm: telt werkzame stikstof, dus totale stikstof × werkingscoëfficiënt. Kunstmest telt voor 100%. Voor dierlijke mest hangt het percentage af van mestsoort, herkomst, beweiding en soms grondsoort en seizoen; drijfmest van graasdieren van het eigen bedrijf telt bijvoorbeeld voor 45% met beweiding en 60% zonder. Compost telt voor 10%.
- Fosfaatnorm: telt de fosfaat van alle meststoffen. Voor organischestofrijke meststoffen telt een lager deel mee, als je er minstens 20 kg P₂O₅/ha van geeft: 25% voor GFT- en groencompost, 75% voor onder andere strorijke vaste mest en champost. Boven de norm telt het weer voor 100%.
- Dierlijke-mestnorm en Renure-norm: tellen de totale stikstof, zonder werkingscoëfficiënt.

Is er geen eigen analyse van de meststof, dan gebruikt {{appName}} de forfaitaire gehalten van RVO.

## Hoe lees je de uitkomst? {#uitkomst-lezen}

Per norm zie je de ruimte, de opvulling en het percentage dat je hebt gebruikt. Zit je op bedrijfsniveau onder de 100%, dan blijf je binnen de norm. Gaat één perceel over zijn eigen norm heen, dan is dat niet direct een overtreding, maar het geeft wel aan waar je bemesting scheef verdeeld is.

## Beperkingen {#beperkingen}

Niet alles uit de regelgeving zit in {{appName}}. Niet ondersteund zijn onder meer: opbrengstafhankelijke stikstofdifferentiatie, fritesaardappelen op klei, de vaste bedrijfsnorm van 110 kg N/ha, mengteelt en onderzaai als aparte norm, graszaad met voedersnede, en de aparte normen voor wortel- en zaadkruiden. Ontbreken de gewassen van vorig jaar, dan kan {{appName}} niet zien of je aan de vanggewasplicht hebt voldaan en kan de maximale korting worden toegepast.

De gebruiksruimte in {{appName}} is indicatief. Voor je officiële verantwoording gelden altijd de regels en publicaties van RVO. Overleg bij twijfel met je adviseur.

## Wat kun je doen? {#wat-kun-je-doen}

- Zorg dat je bouwplan compleet is, ook voor het vorige jaar, met de juiste zaai- en einddata.
- Houd je bodemanalyse actueel: de fosfaatklasse uit die analyse bepaalt je fosfaatruimte.
- Gebruik waar het kan een eigen mestanalyse in plaats van forfaitaire waarden.
- Zaai vanggewassen op tijd, uiterlijk 1 oktober, om kortingen te voorkomen.

Hoe je de gebruiksruimte in {{appName}} bekijkt, lees je in [Gebruiksruimte](/manual/gebruiksruimte).
