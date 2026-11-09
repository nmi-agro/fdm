---
title: Organische-stofbalans
description: Hoe de organische-stofbalans aanvoer van effectieve organische stof afzet tegen afbraak in de bodem, en wat je doet als de balans negatief is.
section: Balansen
order: 2
inApp:
  - Balans
  - Organische stof
lastReviewed: 2026-11-05
routes: []
watch:
  - fdm-calculator/src/balance/organic-matter/**
  - fdm-calculator/src/balance/farms.ts
keywords:
  - organische stofbalans berekenen
  - effectieve organische stof
  - EOS
  - afbraak organische stof
  - bodemvruchtbaarheid
related:
  - balansen
  - background/stikstofbalans
  - background/bodemanalyse
  - bemesting
---

De organische-stofbalans laat zien of het organischestofgehalte van je bodem op peil blijft. Organische stof breekt elk jaar voor een deel af; met mest, compost, gewassen en gewasresten vul je dat weer aan. Een gezond organischestofgehalte zorgt voor een goede bodemstructuur, houdt water en nutriënten vast en voedt het bodemleven.

## Wat is de organische-stofbalans? {#wat-is-het}

{{appName}} rekent de balans per perceel uit voor de periode die je in de kalender kiest, in kg organische stof per hectare:

balans = aanvoer van effectieve organische stof − afbraak

Is de balans positief, dan bouw je organische stof op. Is hij negatief, dan neemt het gehalte langzaam af. De bedrijfsbalans is het oppervlaktegewogen gemiddelde van de percelen waarvoor de balans kon worden berekend. Bufferstroken tellen niet mee.

## Welke gegevens tellen mee? {#invoer}

| Onderdeel   | Waar komt het getal vandaan?                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Bemesting   | Hoeveelheid × gehalte effectieve organische stof (EOS) van de meststof, apart voor dierlijke mest, compost en overige meststoffen |
| Gewassen    | Een vaste EOS-waarde per jaar per gewas, voor wortels en wortelresten                                                             |
| Gewasresten | Een vaste EOS-waarde per gewas, als de resten op het land blijven                                                                 |
| Afbraak     | Organischestofgehalte en dichtheid uit je bodemanalyse, en of het perceel grasland of bouwland is                                 |

Ontbreekt de dichtheid in je bodemanalyse, dan schat {{appName}} die uit het organischestofgehalte en het bodemtype.

## Hoe wordt het berekend? {#berekening}

### Aanvoer {#aanvoer}

Niet alle organische stof die je aanvoert blijft in de bodem. Een groot deel wordt binnen een jaar door het bodemleven afgebroken. Daarom telt de balans alleen de effectieve organische stof (EOS): het deel dat na een jaar nog over is.

- Bemesting: aanvoer = hoeveelheid (kg/ha) × EOS-gehalte (g/kg) / 1000. Kunstmest bevat geen organische stof en telt dus niet mee.
- Gewassen: elk gewas in de periode levert zijn vaste EOS-waarde per jaar.
- Gewasresten: tellen mee als je hebt aangegeven dat ze op het land blijven, of als je dat niet hebt ingevuld, en als het gewas binnen de gekozen periode eindigt.

### Afbraak {#afbraak}

De afbraak volgt een rekenregel waarin het organischestofgehalte, de dichtheid van de grond en de dikte van de bouwvoor zitten, met een correctie voor temperatuur:

- Voor grasland rekent {{appName}} met de bovenste 10 cm, voor bouwland met 30 cm.
- De temperatuur is een vaste jaargemiddelde waarde van 9,3 °C.
- Het afbraakpercentage daalt licht naarmate het organischestofgehalte hoger is.
- De afbraak is begrensd op maximaal 3.500 kg organische stof per hectare per jaar.
- Is de periode korter of langer dan een jaar, dan wordt de afbraak naar rato meegeteld.

Een voorbeeld: bouwland met 3% organische stof en een dichtheid van 1,3 g/cm³ heeft in de bovenste 30 cm zo'n 117.000 kg organische stof per hectare. Volgens de rekenregel breekt daarvan ongeveer 2,2% per jaar af, dus ruim 2.500 kg. Op grasland met dezelfde bodem rekent {{appName}} met 10 cm, en komt de afbraak uit op ongeveer een derde daarvan.

## Hoe lees je de uitkomst? {#uitkomst-lezen}

- Een positieve balans: je voert meer effectieve organische stof aan dan er afbreekt. Het gehalte stijgt op termijn.
- Een balans rond nul: het gehalte blijft ongeveer gelijk.
- Een negatieve balans: er breekt meer af dan je aanvoert. Een jaar met een negatieve balans is geen probleem, maar blijft het jaren zo, dan daalt het gehalte.

Kijk bij de posten welke bijdrage het grootst is. Vaak maken gewasresten en het bouwplan een groter verschil dan je verwacht.

## Beperkingen {#beperkingen}

- De afbraak is een vereenvoudigde rekenregel met een vaste temperatuur. Weer, grondbewerking en bodemleven kunnen de werkelijke afbraak flink beïnvloeden.
- Gewassen leveren altijd hun volledige jaarwaarde, ook als ze maar een deel van het jaar op het perceel staan.
- Aanvoer en afbraak hebben een andere tijdschaal: de EOS-waarde gaat over één jaar, terwijl organische stof in de bodem over vele jaren verandert. Zie de balans als een trend, niet als een exacte voorspelling van je gehalte.
- Ontbreken het organischestofgehalte of de dichtheid en kunnen ze niet worden geschat, dan rekent {{appName}} geen afbraak.

## Wat kun je doen? {#wat-kun-je-doen}

- Laat gewasresten zoals stro op het land als dat in je bedrijfsvoering past.
- Neem gewassen met veel wortelmassa op in het bouwplan, zoals granen en grasland, en zaai na de hoofdteelt een groenbemester.
- Gebruik meststoffen met veel effectieve organische stof, zoals vaste mest en compost. Let daarbij op de fosfaatruimte (zie [Gebruiksruimte](/manual/background/gebruiksruimte)).
- Laat je bodemanalyse regelmatig vernieuwen, zodat de afbraak op je actuele gehalte is gebaseerd.

Hoe je de organische-stofbalans in {{appName}} bekijkt, lees je in [Balansen](/manual/balansen#organische-stofbalans).
