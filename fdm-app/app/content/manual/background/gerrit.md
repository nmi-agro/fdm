---
title: "Gerrit: zo werkt het"
description: Hoe Gerrit een bemestingsplan maakt, waarom de getallen door vaste rekenregels worden gecontroleerd en welke gegevens het AI-model te zien krijgt.
section: Normen en advies
order: 3
lastReviewed: 2026-11-06
routes: []
watch:
  - fdm-agents/src/agents/gerrit/**
  - fdm-agents/src/tools/fertilizer-planner/**
  - fdm-agents/src/models/**
  - fdm-app/app/lib/gerrit.server.ts
keywords:
  - Gerrit AI
  - AI bemestingsplan
  - hoe werkt Gerrit
  - taalmodel landbouw
  - bemestingsplanning
related:
  - gerrit
  - background/gebruiksruimte
  - background/bemestingsadvies
  - background/stikstofbalans
---

Gerrit combineert een AI-taalmodel met de vaste rekenregels van {{appName}}. Het taalmodel bedenkt een plan: welke meststof, hoeveel, wanneer en hoe. De rekenregels controleren dat plan en rekenen alle getallen uit. Zo krijg je de denkkracht van AI, terwijl de gebruiksruimte, het advies en de balans precies zo worden berekend als in de rest van de app.

## Bedenken en controleren {#bedenken-en-controleren}

Je kunt dit zien als een samenwerking tussen een bedenker en een controleur:

- De bedenker is een taalmodel van Google (Gemini). Het kiest per perceel meststoffen, hoeveelheden, data en toedieningsmethodes, en schrijft de toelichting.
- De controleur is de rekenkern van {{appName}}. Die rekent het voorstel door met dezelfde regels als de rest van de app: de gebruiksruimte, het bemestingsadvies, de stikstofbalans en de organische-stofbalans.

Het taalmodel mag het plan niet zelf goedkeuren. Elk voorstel gaat langs de controleur. Vindt die een probleem, dan krijgt het model een lijst met knelpunten en past het het plan aan. Dat gaat zo een aantal rondes door, tot het plan klopt of een maximum aantal pogingen is bereikt.

## De stappen {#stappen}

1. Inventarisatie: {{appName}} verzamelt je percelen, gewassen, bodemgegevens en de meststoffen die Gerrit mag gebruiken.
2. Verduidelijkende vragen: een eerste ronde van het model bekijkt je bedrijf en stelt zo nodig een paar vragen, bijvoorbeeld over de huiskavel of over je eigen mest.
3. Ontwerpen: het model raadpleegt per gewas een teelthandleiding met de gangbare bemestingspraktijk, haalt het bemestingsadvies en de gebruiksnormen op, en zoekt geschikte meststoffen in je meststoffenlijst.
4. Doorrekenen en bijsturen: het model laat het plan doorrekenen en past het aan op basis van de uitkomst. Daarna rekent {{appName}} het definitieve plan nog een keer zelf door. Die getallen zie je op het scherm; getallen die het model zelf noemt, worden niet gebruikt.

## Waar let de controleur op? {#controles}

Een plan wordt teruggestuurd als:

- de gebruiksruimte van het bedrijf wordt overschreden;
- er een bufferstrook wordt bemest;
- er een toedieningsmethode wordt gebruikt die niet bij de meststof past;
- er kunstmest wordt gebruikt op een biologisch bedrijf;
- er fosfaathoudende kunstmest wordt gebruikt bij derogatie;
- er Renure-producten worden gebruikt terwijl dat niet mag.

Daarnaast krijgt het model richtlijnen mee, zoals de normen op bedrijfsniveau aanhouden, het advies voor stikstof, fosfaat en kali zo dicht mogelijk benaderen, de organische-stofbalans op peil houden, en realistische hoeveelheden en data kiezen.

## Welke gegevens ziet het model? {#gegevens}

Het model krijgt alleen wat nodig is om een plan te maken:

- de naam van het bedrijf en per perceel de naam, de oppervlakte, het gewas, de grondsoort, de grondwatertrap en het organischestofgehalte;
- je strategiekeuzes, je wensen en je antwoorden op de vragen;
- de samenstelling van de meststoffen die je hebt geselecteerd, het bemestingsadvies en de gebruiksnormen.

De ligging van je percelen gaat niet naar het model. Volgens de afspraken met de aanbieder van het model worden je gegevens niet bewaard en niet gebruikt om het model te trainen (Zero Data Retention).

## Beperkingen {#beperkingen}

- Een taalmodel kan zich vergissen of een minder logische keuze maken. Daarom is elk plan een voorstel dat jij of je adviseur controleert.
- De controleur toetst de normen op bedrijfsniveau. Op één perceel kan het plan dus boven de norm voor dat perceel uitkomen, zolang het bedrijf als geheel binnen de ruimte blijft. Een overschrijding wordt rood gemarkeerd, maar niet tegengehouden.
- Gerrit kent alleen de gegevens in {{appName}}: wat er niet is ingevuld, kan Gerrit ook niet meenemen.
- Gerrit werkt alleen voor 2026 en 2025.

> De gebruiksnormen in {{appName}} zijn indicatief en alleen bedoeld ter informatie. Raadpleeg voor de definitieve normen en je verantwoording altijd de officiële publicaties van RVO en je adviseur.

Hoe je Gerrit gebruikt, lees je in [Gerrit, de AI-bemestingsassistent](/manual/gerrit).
