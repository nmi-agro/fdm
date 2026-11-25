---
title: Fosfaatbalans
description: Hoe de fosfaatbalans per perceel en bedrijf wordt berekend, wat de fosfaattoestand van de bodem zegt en hoe het oordeel per perceel tot stand komt.
section: Balansen
order: 3
inApp:
  - Balans
  - Fosfaat
lastReviewed: 2026-11-24
routes: []
watch:
  - fdm-calculator/src/balance/phosphate/**
keywords:
  - fosfaatbalans berekenen
  - fosfaatoverschot
  - fosfaatverzadiging
  - P-AL
  - milieugrens fosfaat
  - fosfaatuitspoeling
related:
  - balansen
  - background/bodemanalyse
  - background/organische-stofbalans
  - background/gebruiksruimte
---

De fosfaatbalans zet het fosfaat dat op een perceel binnenkomt af tegen wat er met de oogst weer afgaat, in kg P₂O₅ per hectare. Anders dan bij stikstof is een overschot niet altijd slecht en een tekort niet altijd goed. Fosfaat hoopt zich op in de bodem. Of je moet opbouwen, onderhouden of afbouwen, hangt daarom af van hoeveel fosfaat er al in de bodem zit. {{appName}} legt de balans daarom naast de fosfaattoestand van de bodem.

De fosfaatbalans is experimenteel. De rekenregels en grenswaarden op deze pagina zijn een eerste versie en worden nog met onderzoekers verder uitgewerkt. Gebruik de uitkomsten als richting, niet als vaststaand advies.

## Wat is de fosfaatbalans? {#wat-is-het}

{{appName}} rekent de balans per perceel uit voor de periode die je in de kalender kiest, meestal een kalenderjaar:

balans = aanvoer − afvoer

De bedrijfsbalans is het oppervlaktegewogen gemiddelde van de percelen. Bufferstroken en percelen waarvan de hoofdteelt natuur of een landschapselement is, tellen niet mee: daar zeggen een balans en een streefwaarde voor de bodem weinig.

Naast de balans schat {{appName}} de uitspoeling van fosfaat. Die wordt niet van de balans afgetrokken, maar telt wel mee in de verwachting voor de bodem.

## Welke gegevens tellen mee? {#invoer}

| Post                                                    | Waar komt het getal vandaan?                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Kunstmest, dierlijke mest, compost, overige meststoffen | Je bemestingen: hoeveelheid × fosfaatgehalte van de meststof                       |
| Mineralisatie                                           | De afbraak van organische stof in de bodem, of de afbraak van veen (zie hieronder) |
| Depositie                                               | Een vaste waarde van 0,7 kg P₂O₅ per ha per jaar                                   |
| Afvoer via oogst                                        | Opbrengst × fosfaatgehalte van het geoogste product                                |
| Afvoer via gewasresten                                  | Alleen als je de gewasresten van het perceel afvoert                               |

Voor de fosfaattoestand gebruikt {{appName}} uit je bodemanalyse P-AL, P-CaCl₂, P-ox, Fe-ox en Al-ox of de fosfaatverzadigingsgraad, het bodemtype, de grondwatertrap, organische stof, de dichtheid en de bemonsteringsdiepte. Heeft een perceel geen bodemanalyse met P-ox, Fe-ox en Al-ox, dan gebruikt {{appName}} de schatting van NMI BodemSchat voor die locatie. Een gemeten waarde gaat altijd voor. Meer hierover lees je in [Bodemanalyse](/manual/background/bodemanalyse).

## Hoe wordt de balans berekend? {#berekening}

### Aanvoer {#aanvoer}

Voor elke bemesting geldt: aanvoer = hoeveelheid (kg/ha) × fosfaatgehalte (g P₂O₅/kg) / 1000. Fosfaat telt voor 100% mee: werkingscoëfficiënten horen bij het bemestingsadvies, niet bij een balans. Een meststof zonder fosfaat, zoals een stikstofkunstmest, voegt niets toe.

Bij de afbraak van organische stof komt fosfaat vrij. Op minerale gronden gebruikt {{appName}} de afbraak uit de [organische-stofbalans](/manual/background/organische-stofbalans) en rekent die om:

- 0,0046 kg P₂O₅ per kg afgebroken organische stof op grasland, 0,0034 op bouwland;
- daarvan blijft 65% beschikbaar; de rest leggen bodemorganismen weer vast.

Op veen onderschat de organische-stofbalans de afbraak sterk. Daar rekent {{appName}} met de oxidatie van veen: 12 ton organische stof per ha per jaar bij grondwatertrap V, vermenigvuldigd met een factor voor de grondwatertrap (0,3 bij Gt I en II tot 1,4 bij Gt VII en VIII), een temperatuurfactor en 1,7 kg P per ton organische stof. Bij Gt V geeft dat ongeveer 23 kg P₂O₅ per ha per jaar. Is de grondwatertrap van een veenperceel veranderd, dan meldt {{appName}} dat bij vernatting ijzergebonden fosfaat kan vrijkomen. Dat wordt niet berekend.

Ontbreekt het organischestofgehalte, dan is de mineralisatie 0 en meldt de app dat. De depositie is een jaarwaarde die naar rato van het aantal dagen in de periode meetelt.

### Afvoer {#afvoer}

De afvoer via de oogst is opbrengst × fosfaatgehalte van het product. Heb je bij een oogst zelf een opbrengst of fosfaatgehalte ingevuld, dan gebruikt {{appName}} die. Anders gebruikt de app standaardwaarden voor het gewas. Staat er een gewas op het perceel zonder geregistreerde oogst, dan is de afvoer in het gekozen jaar 0 en vraagt de app je de oogst toe te voegen.

Gewasresten tellen alleen als afvoer mee als je hebt aangegeven dat je ze afvoert. De hoeveelheid gewasrest wordt dan geschat uit de opbrengst en de oogstindex van het gewas.

### Uitspoeling {#uitspoeling}

De uitspoeling is een eerste schatting en wordt nog verder ontwikkeld. Is de balans positief, dan spoelt een deel van het overschot uit:

uitspoeling = overschot × fractie × grondwaterfactor

| Fosfaatverzadiging ten opzichte van de milieugrens | Fractie |
| -------------------------------------------------- | ------- |
| Op of onder de milieugrens                         | 0,01    |
| Tot twee keer de milieugrens                       | 0,03    |
| Meer dan twee keer de milieugrens                  | 0,06    |
| Onbekend                                           | 0,03    |

De grondwaterfactor is 2 bij een hoge grondwaterstand (gemiddeld hoogste grondwaterstand tot 25 cm onder maaiveld) en loopt af naar 0,67 bij een grondwaterstand van 100 cm of dieper. Bij een hoge grondwaterstand komt fosfaat sneller in sloten en drains terecht.

## Gemiddelde balans over meer jaren {#gemiddelde-balans}

Eén jaar zegt weinig over de bodem: in het ene jaar bemest je meer, in het andere minder, en gewassen wisselen elkaar af. Voor de verwachting gebruikt {{appName}} daarom de gemiddelde balans over het gekozen jaar en de vier jaren ervoor.

- Een eerder jaar telt alleen mee als er bemesting of een oogst is geregistreerd.
- Staat er voor een eerder jaar geen gewas in {{appName}}, dan wordt het gewas uit het BRP gebruikt, en als dat er ook niet is het hoofdgewas van het gekozen jaar.
- Heeft een gewas in een eerder jaar geen geregistreerde oogst, dan rekent {{appName}} met de standaardopbrengst en het standaardfosfaatgehalte van het gewas.
- De bemesting wordt gemiddeld over de jaren met geregistreerde bemestingen. Het gekozen jaar telt altijd mee.
- Ontbreken voor eerdere jaren de gewassen of de bemesting, dan is de gemiddelde balans alleen indicatief. De app zegt dat erbij.
- Telt geen enkel eerder jaar mee, dan gebruikt {{appName}} alleen de balans van het gekozen jaar.

## De fosfaattoestand van de bodem {#fosfaattoestand}

{{appName}} kijkt naar twee kanten van het bodemfosfaat: wat het gewas nodig heeft en wat het milieu aankan.

### P-AL: fosfaat voor het gewas {#p-al}

P-AL zegt hoeveel fosfaat er voor het gewas beschikbaar is (mg P₂O₅ per 100 g grond). Volgens het Handboek Bodem en Bemesting is een P-AL van 35 tot 45 goed. Onder 35 is er te weinig fosfaat voor een goede opbrengst.

### Fosfaatverzadiging: fosfaat en het milieu {#fosfaatverzadiging}

De fosfaatverzadigingsgraad (PSD) zegt welk deel van de fosfaatbinding van de bodem al bezet is. De binding komt van ijzer- en aluminiumoxiden:

- bindingscapaciteit = 0,5 × (Fe-ox + Al-ox), in mmol per kg;
- fosfaatverzadiging = P-ox / bindingscapaciteit × 100%.

Levert het laboratorium zelf een fosfaatverzadigingsgraad, dan gebruikt {{appName}} die. Hoe voller de bodem, hoe meer fosfaat er in het bodemvocht oplost en naar sloot en grondwater kan gaan.

De fosfaatverzadiging is niet voor elke grond even betrouwbaar. Op kalkrijk zand (duinzand) is fosfaat vooral aan kalk gebonden en gebruikt {{appName}} alleen P-AL. Op veen, dalgrond en moerige klei is de verzadiging waarschijnlijk onderschat, op kalkrijke zeeklei kan ze overschat zijn. De app meldt dat bij het perceel.

### De milieugrens {#milieugrens}

De milieugrens is de fosfaatverzadiging waarboven het bodemvocht te veel fosfaat bevat voor het oppervlaktewater (van Doorn, 2026). {{appName}} rekent die per perceel uit P-CaCl₂, de fosfaatverzadiging en de grondwatertrap. De toegestane concentratie in het bodemvocht is 0,1 mg P per liter bij een gemiddeld hoogste grondwaterstand tot 25 cm en loopt op tot 0,3 mg P per liter bij 100 cm of dieper. De grondwaterstand volgt uit de definitie van de grondwatertrap. Ontbreekt P-CaCl₂, dan is de milieugrens 25%.

### Het doel van het perceel {#doel}

Samen geven P-AL en de fosfaatverzadiging de streefzone: P-AL minstens 35 voor het gewas en de fosfaatverzadiging hoogstens de milieugrens voor het milieu. Daaruit volgt het doel:

| Situatie                                                  | Doel        |
| --------------------------------------------------------- | ----------- |
| P-AL onder 35, fosfaatverzadiging onder de milieugrens    | Opbouwen    |
| P-AL 35 of hoger, fosfaatverzadiging onder de milieugrens | Onderhouden |
| Fosfaatverzadiging boven de milieugrens                   | Afbouwen    |
| P-AL onder 35 en fosfaatverzadiging boven de milieugrens  | Geen doel   |

Zonder bruikbare fosfaatverzadiging is de streefzone P-AL 35 tot 45; boven 45 is het doel dan afbouwen. Ligt P-AL onder 35 terwijl de fosfaatverzadiging boven de milieugrens zit, dan vragen opbrengst en milieu een andere richting. {{appName}} kiest dan geen doel, maar laat zien wat de balans met beide doet.

## Waar gaat de bodem naartoe? {#verwachting}

Met de gemiddelde balans schat {{appName}} hoe P-AL en de fosfaatverzadiging veranderen als die balans elk jaar terugkomt. Dat is een illustratie, geen voorspelling.

- Een deel van het fosfaat raakt elk jaar vastgelegd en is dan niet meer beschikbaar: 20 kg P₂O₅ per ha per jaar op minerale gronden, 0 op veen. Wat telt is de gemiddelde balans plus de uitspoeling min deze vastlegging.
- P-AL verandert met die balans gedeeld door een buffer: de hoeveelheid fosfaat die nodig is om P-AL met 1 te veranderen in de laag van 0 tot 25 cm. Die is 65 kg P₂O₅ per ha op zand en dalgrond, 50 op klei, moerige klei en löss en 45 op veen, met een bandbreedte. De buffer wordt omgerekend naar de bemonsteringsdiepte.
- De fosfaatverzadiging verandert met dezelfde balans, omgerekend via de dichtheid van de grond, de bemonsteringsdiepte en de bindingscapaciteit.

De bemonsteringsdiepte komt uit de meest recente bodemanalyse met een fosfaatwaarde, anders 10 cm op grasland en 25 cm op bouwland. Ontbreekt de dichtheid, dan gebruikt {{appName}} een standaardwaarde voor het bodemtype.

## Het oordeel {#oordeel}

Elk perceel krijgt een oordeel. Binnen 3 punten P-AL of 2 procentpunten fosfaatverzadiging van een grens telt als bereikt. Een balans die minder dan 1 kg P₂O₅ per ha per jaar van de vastlegging afwijkt, telt als stabiel.

| Oordeel   | Buiten de streefzone                                 | In de streefzone                                                     |
| --------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| Goed      | De streefzone wordt binnen 10 jaar bereikt           | De fosfaatverzadiging blijft langer dan 20 jaar onder de milieugrens |
| Aandacht  | De richting klopt, maar het duurt langer dan 10 jaar | De fosfaatverzadiging komt binnen 5 tot 20 jaar boven de milieugrens |
| Bijsturen | De richting klopt niet of er verandert niets         | De fosfaatverzadiging komt binnen 5 jaar boven de milieugrens        |
| Onbekend  | Geen P-AL en geen fosfaatverzadiging bekend          |                                                                      |

Een P-AL in de streefzone die langzaam richting 35 daalt, blijft goed; de app laat wel zien wanneer P-AL onder 35 komt. Zijn de bodemgegevens geschat of is de fosfaatverzadiging voor jouw grond minder betrouwbaar, dan is het oordeel indicatief.

Voor percelen met het oordeel aandacht of bijsturen rekent {{appName}} uit welke gemiddelde balans en welke fosfaatbemesting per jaar nodig zijn om het doel te halen.

Op de bedrijfspagina zie je hoeveel hectare elk oordeel heeft. In een organisatie is een bedrijf goed als minstens de helft van de beoordeelde oppervlakte goed is.

## Beperkingen {#beperkingen}

- De fosfaatbalans is experimenteel. De parameters voor mineralisatie, uitspoeling, buffer en vastlegging zijn eerste schattingen en worden nog verbeterd.
- De uitspoeling wordt geschat uit het overschot. Bij fosfaat hangen verliezen eigenlijk af van de concentratie fosfaat in het bodemvocht en de waterstroom naar sloot en drains, en ze treden ook op bij een tekort. Dat wordt nog niet berekend, net als afspoeling en erosie.
- Mest die tijdens het weiden op het land komt, telt (nog) niet mee. Alleen ingevoerde bemestingen tellen.
- Opbrengsten en fosfaatgehalten variëren. De balans van één perceel is daardoor al gauw 15 tot 25 kg P₂O₅ per ha onzeker.
- De verwachting voor de bodem gaat ervan uit dat de gemiddelde balans elk jaar gelijk blijft.
- De balans is een hulpmiddel voor je eigen bedrijfsvoering, geen wettelijke verantwoording. Voor de fosfaatgebruiksnorm, zie [Gebruiksruimte](/manual/background/gebruiksruimte).

## Wat kun je doen? {#wat-kun-je-doen}

- Vul de werkelijke opbrengsten in, liefst met een fosfaatgehalte uit een analyse, en registreer ook de bemesting en oogsten van eerdere jaren.
- Laat een bodemanalyse doen met P-AL en P-CaCl₂, en zo mogelijk P-ox, Fe-ox en Al-ox.
- Zit een perceel boven de milieugrens, dan helpt minder fosfaatbemesting of meer afvoer, bijvoorbeeld door gewasresten af te voeren.
- Zit P-AL onder 35, dan is opbouwen gunstig voor de opbrengst, zolang de fosfaatverzadiging onder de milieugrens blijft.

Hoe je de fosfaatbalans in {{appName}} bekijkt, lees je in [Balansen](/manual/balansen#fosfaatbalans).
