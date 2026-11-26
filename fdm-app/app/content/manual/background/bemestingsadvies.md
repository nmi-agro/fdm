---
title: Bemestingsadvies
description: Waar het bemestingsadvies op is gebaseerd, welke bodem- en gewasgegevens meetellen en hoe je je bemesting vergelijkt met het advies per nutriënt.
section: Normen en advies
order: 2
inApp:
  - Bemestingsadvies
lastReviewed: 2026-11-05
routes: []
watch:
  - fdm-calculator/src/nutrient-advice/**
  - fdm-calculator/src/doses/**
keywords:
  - bemestingsadvies berekenen
  - Handboek Bodem en Bemesting
  - Adviesbasis Bemesting
  - stikstofadvies grasland
  - bemestingsadvies per perceel
related:
  - bemestingsadvies
  - background/gebruiksruimte
  - background/bodemanalyse
  - bemesting
---

Het bemestingsadvies vertelt je hoeveel van elk nutriënt een gewas nodig heeft voor een goede opbrengst en kwaliteit, gegeven de voorraad in je bodem. Door je bemesting naast het advies te leggen, zie je waar je te weinig geeft en opbrengst laat liggen, en waar je meer geeft dan nodig en dus kosten en verliezen naar het milieu riskeert.

## Waar is het advies op gebaseerd? {#basis}

Het advies volgt de landelijke adviesbases: het Handboek Bodem en Bemesting voor akker- en tuinbouw, en de Adviesbasis Bemesting Grasland en Voedergewassen. {{appName}} rekent het advies niet zelf uit, maar vraagt het per perceel op bij een rekendienst van NMI die deze adviesbases toepast. {{appName}} stuurt daarvoor de gegevens van het perceel mee en toont het advies dat terugkomt.

## Welke gegevens tellen mee? {#invoer}

- Het hoofdgewas: het gewas dat tussen 15 mei en 15 juli het langst op het perceel staat. Het advies geldt voor dat gewas.
- De locatie van het perceel.
- De actuele waarde van alle bodemparameters die voor het perceel bekend zijn, zoals organische stof, pH, P-Al, P-plantbeschikbaar, kalium, magnesium, zwavel, klei en spoorelementen.
- De stikstofvoorraad (Nmin) als je die hebt laten meten, apart voor de laag 0 tot 30 cm en 30 tot 60 cm. Is de bodem in zones bemonsterd, dan wordt per laag het oppervlaktegewogen gemiddelde gebruikt.

Hoe {{appName}} per parameter de actuele waarde bepaalt, lees je in [Bodemanalyse](/manual/background/bodemanalyse).

## Wat komt eruit? {#uitkomst}

Je krijgt een advies per jaar voor veertien nutriënten:

| Groep                                    | Nutriënten                                                          | Eenheid                |
| ---------------------------------------- | ------------------------------------------------------------------- | ---------------------- |
| NPK                                      | Stikstof (werkzaam), fosfaat, kalium                                | kg N, P₂O₅, K₂O per ha |
| Organische stof en secundaire nutriënten | Effectieve organische koolstof, zwavel, magnesium, calcium, natrium | kg per ha              |
| Spoorelementen                           | Koper, zink, kobalt, mangaan, molybdeen, boor                       | kg per ha              |

Voor grasland komt er ook een advies per snede voor stikstof, fosfaat, kalium en zwavel. Dat hangt af van het nummer van de snede en of het om beweiden of maaien gaat, en hoe zwaar de snede is.

## Hoe wordt je bemesting vergeleken? {#berekening}

{{appName}} telt per perceel op wat je met al je bemestingen in het jaar aan elk nutriënt geeft: hoeveelheid × gehalte van de meststof. Voor stikstof telt de werkzame stikstof: de totale stikstof × de werkingscoëfficiënt van de meststof. Dat is de stikstof die het gewas in het jaar van toediening kan benutten. Voor organische koolstof telt de effectieve organische koolstof van de meststof.

Daarna wordt de gift uitgedrukt als percentage van het advies:

| Gift ten opzichte van advies | Betekenis                                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| Minder dan 90%               | Risico voor opbrengst: je geeft minder dan het gewas nodig heeft |
| 90 tot en met 110%           | Op advies                                                        |
| Meer dan 110%                | Risico voor milieu: je geeft meer dan nodig                      |

Voor effectieve organische koolstof bestaat geen risico voor milieu: meer dan het advies telt daar ook als op advies. Is het advies voor een nutriënt 0 en geef je het toch, dan telt dat als meer dan nodig.

## Hoe lees je de uitkomst? {#uitkomst-lezen}

Begin bij de NPK-groep: daar zitten de grootste effecten op opbrengst en milieu. Een tekort aan stikstof zie je meestal snel terug in de opbrengst. Een overschot aan stikstof of fosfaat komt niet in de oogst terecht en kan uitspoelen of zich ophopen in de bodem. Bij de spoorelementen gaat het om kleine hoeveelheden; daar is een advies vaak een signaal om de bodemvoorraad in de gaten te houden.

Het advies kan hoger zijn dan wat je volgens de gebruiksnormen mag geven. De wettelijke norm gaat dan altijd voor. Hoe de normen worden bepaald, lees je in [Gebruiksruimte](/manual/background/gebruiksruimte).

## Beperkingen {#beperkingen}

- Het advies gaat over het hoofdgewas. Volgteelten en groenbemesters krijgen geen eigen advies.
- De kwaliteit van het advies hangt sterk af van je bodemgegevens. Zijn waarden geschat met NMI BodemSchat in plaats van gemeten, dan is het advies minder nauwkeurig.
- Heb je geen Nmin laten meten, dan rekent het stikstofadvies niet met jouw gemeten stikstofvoorraad in de bodem.
- De werkingscoëfficiënt in de vergelijking is die van de meststof zelf. Die kan afwijken van de coëfficiënt die voor de gebruiksnorm geldt.
- Bij een bufferstrook is het advies 0. Zonder gewas, zonder locatie of als de rekendienst niet bereikbaar is, kan er geen advies worden berekend; {{appName}} laat dan zien waarom.

## Wat kun je doen? {#wat-kun-je-doen}

- Laat een recente bodemanalyse doen en voeg die toe, zodat het advies op meetwaarden draait.
- Laat in het voorjaar Nmin meten voor een nauwkeuriger stikstofadvies.
- Verdeel je mest over de percelen naar behoefte: geef meer waar je onder het advies zit en minder waar je erboven zit.
- Gebruik een meststof met een eigen analyse als je mest sterk afwijkt van de standaardsamenstelling.

Hoe je het bemestingsadvies in {{appName}} bekijkt, lees je in [Bemestingsadvies](/manual/bemestingsadvies).
