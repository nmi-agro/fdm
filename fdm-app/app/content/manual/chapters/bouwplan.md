---
title: "Bouwplan: meerdere percelen tegelijk"
description: Vul zaaidata, oogsten en bemestingen in één keer in voor alle percelen met hetzelfde gewas, direct in de tabel van het bouwplan.
section: Gegevens vastleggen
order: 2
inApp:
  - Bouwplan
routes:
  - farm.$b_id_farm.$calendar.rotation*
watch:
  - fdm-app/app/components/blocks/rotation/**
keywords:
  - bouwplan
  - teeltplan
  - bulk invoeren
  - grasland sneden
related:
  - percelen
  - bemesting
---

Het bouwplan is dé manier om snel te werken. Heb je tien percelen met consumptieaardappelen of twintig percelen grasland? Dan vul je zaaidatum, oogst of bemesting één keer in voor al die percelen samen, in plaats van perceel voor perceel.

## Zo ziet het eruit {#overzicht}

Open **Bouwplan** in de zijbalk. Je ziet een tabel met per gewas één regel: het gewas, de zaai- en einddatum, de oogst- of maaidata, variëteit, gewasresten, de meststoffen die je hebt gebruikt, het aantal percelen en de totale oppervlakte. Klap een gewas open om de afzonderlijke percelen te zien.

![De bouwplantabel met één gewas opengeklapt](screenshot:bouwplan-tabel)

Met **Bekijk** kies je welke kolommen je wilt zien. Met het zoekveld zoek je op gewas, meststof of datum.

## Gegevens direct in de tabel aanpassen {#tabel-aanpassen}

Klik op een cel, bijvoorbeeld de zaaidatum of de variëteit, en pas de waarde aan. De wijziging geldt dan voor alle percelen met dat gewas. Wil je maar een deel van de percelen aanpassen? Klap het gewas open en pas de waarde per perceel aan.

## Bemesting voor meerdere percelen {#bemesting}

1. Vink een gewas aan, of klap het open en vink de percelen aan die je wilt. Met shift-klik selecteer je in één keer een hele reeks.
2. Klik op **Bemesting**.
3. Kies de meststof, de toedieningsmethode, de hoeveelheid en de datum, en sla op.

De bemesting staat nu op al die percelen. Zie je in de kolom **Bemesting met:** het icoontje van een meststof? Klik erop om alle bemestingen met die meststof in één overzicht te bekijken, aan te passen of te verwijderen.

## Oogst voor meerdere percelen {#oogst}

1. Selecteer één gewas (en eventueel een deel van de percelen).
2. Klik op **Oogst toevoegen**, of bij grasland op **Snede toevoegen**.
3. Vul de oogstdatum en de opbrengstgegevens in en sla op.

Heeft een van de percelen al een oogst, dan vraagt {{appName}} eerst of je die wilt overschrijven. Bij grasland kun je ook overschakelen naar invoer per snede: je vult dan alle sneden van het jaar onder elkaar in en voegt er een toe met **Extra snede toevoegen**.

## Tip: verschillende waarden {#verschillende-waarden}

Pas je de bemesting of oogst van meerdere percelen tegelijk aan en verschillen de waarden per perceel? Dan zie je de melding "Er zijn verschillende waarden ingevuld", met een voorbeeld. Vul je een nieuwe waarde in, dan geldt die voor alle geselecteerde percelen.
