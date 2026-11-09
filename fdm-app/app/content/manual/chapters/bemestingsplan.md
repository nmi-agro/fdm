---
title: Bemestingsplan als PDF
description: Maak een bemestingsplan als PDF met gebruiksruimte, advies, organische-stofbalans en per perceel de geplande bemestingen.
section: Resultaten
order: 5
inApp:
  - Bemestingsplan
routes:
  - farm.$b_id_farm.bemestingsplan*
watch:
  - fdm-app/app/components/blocks/bemestingsplan/**
keywords:
  - bemestingsplan
  - PDF
  - mestplan
related:
  - gebruiksruimte
  - bemestingsadvies
---

Wil je het plan op papier, of meegeven aan een teler of controleur? Maak dan een bemestingsplan als PDF. Heb je nog geen bemestingen ingevoerd? Laat dan [Gerrit](/manual/gerrit) een plan voorstellen.

1. Klik op het bedrijfsdashboard op **Bemestingsplan**.
2. Kies het teeltjaar en genereer het plan.
3. Klik op **PDF downloaden**.

## Wat staat erin? {#inhoud}

- een samenvatting met de bedrijfsgegevens, de gebruiksruimte (gepland tegenover ruimte), het bemestingsadvies (gepland tegenover advies), de organische-stofbalans, een gewasoverzicht en de totale hoeveelheid meststoffen die je nodig hebt;
- een overzicht van alle percelen;
- per perceel een pagina met de bodem, het teeltplan, de normen, het advies en de geplande bemestingen;
- een lijst met bufferstroken.

Maak je een plan voor een jaar waarvoor de gebruiksnormen nog niet zijn gepubliceerd, bijvoorbeeld vanuit [Plan volgend seizoen](/manual/plan-volgend-seizoen#oogst-en-overzicht), dan rekent {{appName}} de gebruiksruimte voorlopig met de normen van het nieuwste jaar. Dat staat dan in de PDF vermeld. Actualiseer het plan als de nieuwe normen bekend zijn.

## Actueel houden {#actueel-houden}

Verander je daarna iets aan de gegevens, dan krijgt het plan de status **Verouderd**. Klik op **Actualiseren** voor een nieuwe versie.

Het bemestingsplan is gebaseerd op de gegevens die je zelf hebt ingevoerd en de regels op het moment van maken. De eindverantwoordelijkheid ligt bij de teler.

> De gebruiksnormen in {{appName}} zijn indicatief en alleen bedoeld ter informatie. Raadpleeg voor de definitieve normen en je verantwoording altijd de officiële publicaties van RVO en je adviseur.
