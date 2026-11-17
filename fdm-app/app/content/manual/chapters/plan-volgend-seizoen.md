---
title: Plan volgend seizoen
description: Stel het plan voor een nieuw seizoen samen op basis van eerdere jaren, met percelen, gewassen, vanggewassen, maatregelen, bemesting en oogst.
section: Gegevens vastleggen
order: 8
inApp:
  - Plan volgend seizoen
routes:
  - farm.$b_id_farm.plan-next*
watch:
  - fdm-app/app/components/blocks/plan-next/**
  - fdm-app/app/lib/season-plan.server.ts
  - fdm-core/src/season-plan*.ts
keywords:
  - seizoensplan
  - teeltplan volgend jaar
  - bemestingsplan voorbereiden
  - vorig jaar overnemen
related:
  - bouwplan
  - bemesting
  - gerrit
  - bemestingsplan
  - gebruiksruimte
updated: 2026-11-09
---

Met **Plan volgend seizoen** zet je een nieuw seizoen klaar zonder alles opnieuw in te vullen. {{appName}} gaat uit van wat je in eerdere jaren hebt vastgelegd en stelt per perceel een plan voor. Jij past alleen aan wat anders wordt. Je doorloopt zeven stappen; elke stap wordt apart opgeslagen, dus je kunt stoppen en later verdergaan.

## Zo open je het plan {#openen}

Je opent het plan via **Plan volgend seizoen** in de [zijbalk](/manual/zo-werkt-het#zijbalk) of via de kaart op het bedrijfsdashboard. {{appName}} kiest zelf het jaar: het huidige jaar zolang dat nog niet compleet is, anders volgend jaar. In de stap **Start** kun je wisselen tussen dit jaar en volgend jaar.

Ben je al eerder begonnen? Dan opent het plan bij de eerste stap waar nog iets open staat. Links zie je per stap een vinkje als de stap klaar is, of het aantal open punten. Je kunt elke stap altijd opnieuw openen en aanpassen.

Gegevens die je buiten het plan om vastlegt, bijvoorbeeld in het [bouwplan](/manual/bouwplan), ziet het plan ook. Er wordt niets dubbel aangemaakt.

## De zeven stappen {#stappen}

### Start {#start}

Hier zie je per perceel waar het voorstel op is gebaseerd: de gewassen van de vorige jaren en het uitgangsjaar. Bij een doorlopende teelt, zoals grasland, is dat vorig jaar. Bij een perceel in een vruchtwisseling van 3 tot 5 jaar is het het jaar waarvan het gewas nu weer aan de beurt is. Een rotatieadvies waarschuwt als een gewas te snel terugkomt.

### Percelen {#percelen}

Percelen lopen door naar het nieuwe jaar. Stopt de pacht of verkoop je een perceel, dan kies je **Niet beschikbaar**. Het perceel eindigt dan op 31 december van het jaar ervoor en de lopende maatregelen op dat perceel eindigen op dezelfde dag. De gegevens van eerdere jaren blijven bewaard. Met **Toch behouden** maak je dit ongedaan.

Ga je nieuwe percelen gebruiken? Voeg ze toe met **Kies op de kaart**, **Ophalen bij RVO** of **Shapefile uploaden**. Ze beginnen op 1 januari van het geplande jaar. Let op: bij RVO staat de registratie voor een nieuw jaar meestal pas in het voorjaar klaar.

### Gewassen {#gewassen}

Per perceel kies je de hoofdteelt. Het voorstel komt uit het **Uitgangsjaar**; kies een ander jaar als een eerdere ronde van de vruchtwisseling beter past. Een doorlopende teelt, zoals tijdelijk grasland, kun je met **Beëindigen** stoppen op een datum en vervangen door een ander gewas. Een gewas dat al is vastgelegd voor het geplande jaar pas je aan met **Wijzigen**. Met **Opslaan en verder** worden de gekozen en voorgestelde gewassen opgeslagen met de standaard zaai- en oogstdata; die kun je daarna in het bouwplan aanpassen.

### Vanggewas/groenbemester {#vanggewas}

Voor elk bouwlandperceel kun je een vanggewas of groenbemester na de hoofdteelt vastleggen, met zaaidatum en einddatum. Dat mag ook als het niet verplicht is. Op zand- en lössgrond zie je per perceel de verwachte korting op de stikstofgebruiksnorm van het jaar erna (artikel 28d Uitvoeringsregeling Meststoffenwet): geen vanggewas of inzaai na 1 oktober geeft een korting, net als vernietigen vóór 1 februari.

### Maatregelen {#maatregelen}

Doorlopende maatregelen gaan vanzelf mee. Een maatregel die vorig jaar is geëindigd, kun je verlengen met **Doorlopend verlengen** of tot het einde van het geplande jaar. Doe je niets, dan vervalt de maatregel; dat zie je terug in het overzicht.

### Bemesting {#bemesting}

Op het tabblad **Vorig jaar overnemen** zie je per perceel welke bemesting kan worden overgenomen, met de data verschoven naar het nieuwe jaar. Is het gewas hetzelfde als in het uitgangsjaar, dan is dat de bemesting van hetzelfde perceel. Is het gewas veranderd, dan de bemesting van het meest recente perceel met dat gewas. Is er geen voorbeeld, dan blijft het plan leeg en zie je het resterende bemestingsadvies. Met **Opslaan en verder** neem je de aangevinkte percelen over; nog een keer overnemen maakt geen dubbele bemestingen. Via **Bemesting bewerken** pas je een perceel aan.

Liever een voorstel van de AI-assistent? Op het tabblad **Gerrit** open je [Gerrit](/manual/gerrit) voor het geplande jaar. Let op: als je het plan van Gerrit toepast, vervangt het alle bemestingen van dat jaar op het bedrijf, ook de overgenomen bemestingen. Daarna kom je terug in deze stap.

#### Gebruiksruimte bij het plan {#gebruiksruimte}

Bovenaan de stap zie je hoeveel van de [gebruiksruimte](/manual/gebruiksruimte) van het bedrijf je met de vastgelegde bemesting gebruikt. Boven de norm wordt rood weergegeven, maar niet tegengehouden. Zijn de normen voor het geplande jaar nog niet gepubliceerd, dan rekent {{appName}} voorlopig met de normen van het nieuwste jaar en staat er "voorlopig" bij.

> De gebruiksnormen in {{appName}} zijn indicatief en alleen bedoeld ter informatie. Raadpleeg voor de definitieve normen en je verantwoording altijd de officiële publicaties van RVO en je adviseur.

### Oogst & overzicht {#oogst-en-overzicht}

Ontbrekende oogsten vul je in één keer aan. Een doorlopende teelt, zoals grasland, krijgt de sneden van vorig jaar met dezelfde opbrengst; andere gewassen krijgen de standaardopbrengst uit de gewascatalogus. Pas de verwachte opbrengst aan met **Oogst bewerken**.

Het overzicht laat per stap zien wat klaar is, de gebruiksruimte, de stikstofbalans vergeleken met vorig jaar en de aandachtspunten, zoals vervallen maatregelen. Met **Bemestingsplan (PDF)** maak je een [bemestingsplan](/manual/bemestingsplan) voor het geplande jaar.

## Goed om te weten {#goed-om-te-weten}

- Het plan legt gewone gegevens vast: dezelfde percelen, gewassen, bemestingen en oogsten die je ook op de andere pagina's ziet. Er is geen apart concept-plan.
- Gebruikt een stap de normen of regels van een eerder jaar, omdat die voor het geplande jaar nog niet bekend zijn, dan staat dat er steeds bij. Controleer het plan als de nieuwe normen zijn gepubliceerd.
- Ook met dit hulpmiddel blijft het plan een voorstel: jij of je adviseur controleert het voordat het in de praktijk wordt gebruikt.
