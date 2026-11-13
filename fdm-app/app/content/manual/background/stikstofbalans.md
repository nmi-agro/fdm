---
title: Stikstofbalans
description: Hoe de stikstofbalans per perceel en bedrijf wordt berekend, welke posten meetellen, hoe het doel tot stand komt en hoe je het overschot verlaagt.
section: Balansen
order: 1
inApp:
  - Balans
  - Stikstof
lastReviewed: 2026-11-13
routes: []
watch:
  - fdm-calculator/src/balance/nitrogen/**
  - fdm-calculator/src/balance/farms.ts
keywords:
  - stikstofbalans berekenen
  - stikstofoverschot
  - doelsturing stikstof
  - nitraatuitspoeling
  - ammoniakemissie
  - lachgasemissie
related:
  - balansen
  - background/mineralisatie
  - background/bodemanalyse
  - bemesting
---

De stikstofbalans zet alle stikstof die op een perceel binnenkomt af tegen wat er weer af gaat met de oogst en wat als ammoniak vervliegt. Wat overblijft is het stikstofoverschot, in kg N per hectare. Hoe hoger dat overschot, hoe groter de kans dat stikstof uitspoelt naar grond- en oppervlaktewater. Daarom is de balans een goede maat voor hoe efficiënt je met stikstof omgaat.

## Wat is de stikstofbalans? {#wat-is-het}

{{appName}} rekent de balans per perceel uit voor de periode die je in de kalender kiest, meestal een kalenderjaar. De formule is:

overschot = aanvoer − afvoer − ammoniakemissie

De bedrijfsbalans is het oppervlaktegewogen gemiddelde van de percelen: per perceel worden de posten vermenigvuldigd met de oppervlakte, opgeteld en gedeeld door de totale oppervlakte. Bufferstroken tellen niet mee.

Naast de balans rekent {{appName}} de nitraatuitspoeling en de lachgasemissie uit. Samen met de ammoniakemissie vormen ze de totale emissie. Alleen de ammoniakemissie wordt van het overschot afgetrokken.

## Welke gegevens tellen mee? {#invoer}

| Post                                                    | Waar komt het getal vandaan?                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Kunstmest, dierlijke mest, compost, overige meststoffen | Je bemestingen: hoeveelheid × stikstofgehalte van de meststof                             |
| Fixatie                                                 | Een vaste waarde per gewas voor binding door vlinderbloemigen                             |
| Depositie                                               | Een landelijke kaart van de totale stikstofdepositie (2022), op de locatie van je perceel |
| Mineralisatie                                           | Een vaste waarde per grondsoort en landgebruik (zie hieronder)                            |
| Afvoer via oogst                                        | Opbrengst × stikstofgehalte van het geoogste product                                      |
| Afvoer via gewasresten                                  | Alleen als je de gewasresten van het perceel afvoert                                      |
| Ammoniakemissie                                         | Uit bemesting en uit gewasresten die op het land blijven                                  |

Daarnaast heeft {{appName}} uit je bodemanalyse het bodemtype, de grondwatertrap, organische stof, organische koolstof, totaal stikstof, de C/N-ratio en de dichtheid nodig. Ontbreekt een waarde, dan wordt die waar mogelijk afgeleid uit andere waarden, bijvoorbeeld organische koolstof uit het organischestofgehalte. Lukt dat niet, dan kan de balans voor dat perceel niet worden berekend. Meer hierover lees je in [Bodemanalyse](/manual/background/bodemanalyse).

## Hoe wordt het berekend? {#berekening}

### Aanvoer {#aanvoer}

Voor elke bemesting geldt: aanvoer = hoeveelheid (kg/ha) × stikstofgehalte (g N/kg) / 1000. De depositie is een jaarwaarde die naar rato van het aantal dagen in de periode wordt meegeteld.

Voor de mineralisatie gebruikt de standaardbalans vaste jaarwaarden:

| Grondsoort      | Landgebruik          | Mineralisatie (kg N/ha per jaar) |
| --------------- | -------------------- | -------------------------------- |
| Veen            | Grasland             | 160                              |
| Veen            | Bouwland             | 20                               |
| Dalgrond        | Grasland of bouwland | 20                               |
| Overige gronden | Grasland of bouwland | 0                                |

Een perceel telt als grasland als er tussen 15 mei en 15 juli gras op staat.

### Afvoer {#afvoer}

De afvoer via de oogst is opbrengst × stikstofgehalte van het product. Heb je bij een oogst zelf een opbrengst of stikstofgehalte ingevuld, dan gebruikt {{appName}} die. Anders gebruikt de app standaardwaarden voor het gewas. Gewasresten tellen alleen als afvoer mee als je hebt aangegeven dat je ze afvoert. De hoeveelheid gewasrest wordt dan geschat uit de opbrengst en de oogstindex van het gewas.

### Ammoniakemissie {#ammoniak}

De ammoniakemissie uit dierlijke mest en compost is gebaseerd op het rekenmodel NEMA. De emissie hangt af van het ammoniumgehalte van de mest, de toedieningsmethode en of het land grasland, bouwland of onbegroeid is. Het verschil tussen methoden is groot: bij breedwerpig uitrijden vervliegt ongeveer 68 tot 69% van de ammoniumstikstof, bij injecteren of een zodenbemester op grasland ongeveer 17%. Voor kunstmest volgt de emissiefactor uit de samenstelling van de meststof. Blijven gewasresten op het land, dan rekent {{appName}} ook een emissie uit die resten, afhankelijk van hun stikstofgehalte.

### Nitraatuitspoeling {#nitraatuitspoeling}

Is het overschot positief, dan schat {{appName}} welk deel ervan als nitraat uitspoelt. Dat is een vaste fractie van het overschot:

| Grondsoort | Grasland      | Bouwland      |
| ---------- | ------------- | ------------- |
| Veen       | 0,06          | 0,17          |
| Klei       | 0,11          | 0,33          |
| Löss       | 0,14          | 0,74          |
| Zand       | 0,02 tot 0,32 | 0,04 tot 0,89 |

Op zandgrond hangt de fractie af van de grondwatertrap: hoe droger (hogere Gt), hoe hoger de fractie. De uitspoeling is een gevolg van het overschot en wordt er niet nog eens van afgetrokken.

### Lachgasemissie {#lachgas}

Lachgas (N₂O) is een sterk broeikasgas. {{appName}} rekent de lachgasemissie uit met de rekenregels van het rekenmodel NEMA, dat ook voor de landelijke emissiecijfers wordt gebruikt. De emissie staat in kg N per hectare: de stikstof die als lachgas het perceel verlaat, net als bij ammoniak en nitraat. Net als de nitraatuitspoeling telt lachgas mee in de totale emissie, maar niet in het overschot. De emissie komt uit vier bronnen:

- Bemesting: de stikstof die je toedient × een emissiefactor. Die factor hangt af van de meststof, of het perceel op de dag van toediening grasland of bouwland is en of de grond veen is. Zie de tabel hieronder.
- Gewasresten: 1% van de stikstof in gewasresten die op het land blijven.
- Veen en moerige klei: door afbraak van het veen komt elk jaar lachgas vrij, 4,67 kg N/ha op veen en 4,09 kg N/ha op moerige klei. Voor een kortere periode wordt dat naar rato meegeteld.
- Indirect: een deel van de stikstof die als ammoniak vervliegt (1%) of als nitraat uitspoelt (0,75%) wordt elders alsnog lachgas, door nitrificatie en denitrificatie na depositie en door denitrificatie in grond- en oppervlaktewater. De stikstofdepositie die op je perceel neerkomt telt hier niet mee: die is al meegeteld bij de bron.

| Meststof                       | Grasland, minerale grond | Bouwland, minerale grond | Veen |
| ------------------------------ | ------------------------ | ------------------------ | ---- |
| Kunstmest                      | 0,8%                     | 0,7%                     | 3%   |
| Dierlijke mest, breedwerpig    | 0,1%                     | 0,6%                     | 0,5% |
| Dierlijke mest, emissiearm     | 0,3%                     | 1,3%                     | 1%   |
| Zuiveringsslib                 | 0,9%                     | 0,9%                     | 0,9% |
| Compost en overige meststoffen | 0,4%                     | 0,4%                     | 0,4% |

Onbegroeid land telt als bouwland. Emissiearm toedienen geeft minder ammoniak, maar door de hogere factor iets meer lachgas.

Het CO₂-equivalent laat zien hoe zwaar de emissie als broeikasgas weegt. Daarvoor wordt de stikstof omgerekend naar lachgas (× 44/28) en vermenigvuldigd met het opwarmingsvermogen van lachgas (265). Zo staat 1 kg N als lachgas gelijk aan ongeveer 416 kg CO₂.

### Het doel {#doel}

Het doel is een richtwaarde voor het overschot, afgeleid uit onderzoek naar doelsturing op stikstof (Ros e.a., 2023). Het hangt af van landgebruik, grondsoort en grondwatertrap:

| Landgebruik | Grondsoort        | Grondwatertrap        | Doel (kg N/ha per jaar) |
| ----------- | ----------------- | --------------------- | ----------------------- |
| Grasland    | Zand of löss      | Droog (VII, VIII)     | 80                      |
| Grasland    | Overige situaties |                       | 125                     |
| Bouwland    | Zand of löss      | Droog (VII, VIII)     | 50                      |
| Bouwland    | Zand of löss      | Gemiddeld (V, VI)     | 70                      |
| Bouwland    | Zand of löss      | Nat (I tot en met IV) | 125                     |
| Bouwland    | Klei of veen      | Droog (VII, VIII)     | 115                     |
| Bouwland    | Klei of veen      | Overige               | 125                     |

Kies je een kortere periode dan een jaar, dan wordt het doel naar rato verlaagd.

## Totale of werkzame stikstof {#werkzame-stikstof}

Met de schakelaar _Totale stikstof_ / _Werkzame stikstof_ kies je hoe de bemesting meetelt. Bij werkzame stikstof wordt de stikstof uit elke meststof vermenigvuldigd met de werkingscoëfficiënt. De mineralisatie komt dan niet uit de tabel hierboven, maar wordt berekend met het MINIP-model uit je bodemanalyse (zie [Mineralisatie](/manual/background/mineralisatie)). De nitraatuitspoeling blijft gebaseerd op de balans met totale stikstof. Het doel is bedoeld voor de balans met totale stikstof en wordt bij werkzame stikstof daarom niet getoond.

## Hoe lees je de uitkomst? {#uitkomst-lezen}

- Overschot onder het doel: je zit goed. Er blijft weinig stikstof over die kan uitspoelen.
- Overschot boven het doel: er blijft meer stikstof achter dan de bodem en het water kunnen hebben. Kijk welke posten het verschil maken.
- Een negatief overschot betekent dat je meer afvoert dan je aanvoert. Op korte termijn kan dat, maar op den duur put je de bodem uit.

## Beperkingen {#beperkingen}

- Mest die tijdens het weiden op het land komt en de ammoniak en het lachgas daaruit tellen (nog) niet mee. Alleen ingevoerde bemestingen tellen.
- De lachgasemissie is een schatting met landelijk gemiddelde factoren en heeft een grote onzekerheid. Verschillen tussen kunstmestsoorten, remmers en het tijdstip van bemesten worden (nog) niet meegenomen.
- Mineralisatie, depositie, fixatie en de uitspoelingsfracties zijn vaste of gemiddelde waarden. Het werkelijke jaar kan door weer en beheer flink afwijken.
- Zonder ingevulde opbrengst rekent {{appName}} met een standaardopbrengst. Bij een veel hogere of lagere oogst klopt de afvoer dan niet.
- De balans is een hulpmiddel voor je eigen bedrijfsvoering, geen wettelijke verantwoording.

## Wat kun je doen? {#wat-kun-je-doen}

- Vul de werkelijke opbrengsten in, liefst met een stikstofgehalte uit een analyse.
- Stem de bemesting af op het [bemestingsadvies](/manual/background/bemestingsadvies) en kijk welke percelen ver boven het doel zitten.
- Kies emissiearme toedieningsmethoden en bemest op momenten dat het gewas de stikstof opneemt.
- Een vanggewas of groenbemester na de hoofdteelt houdt stikstof vast die anders uitspoelt.

Hoe je de stikstofbalans in {{appName}} bekijkt, lees je in [Balansen](/manual/balansen#stikstofbalans).
